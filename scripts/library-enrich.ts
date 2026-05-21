/*
 * Library enrichment — fill in author, year, ISBN, cover image, and
 * description for every book in vault/library/*.md by:
 *
 *   1. Querying the Open Library Search API with the existing title
 *      (no key, no quota, ~free at the scale of a personal library).
 *      Google Books was the obvious first choice but their anonymous
 *      quota is now 0/day, so it's effectively unusable without a
 *      cloud project.
 *   2. Downloading the matched cover from covers.openlibrary.org and
 *      uploading it to R2 at library/covers/<slug>.jpg via rclone
 *      (the same rclone remote the vault repo's pre-push hook uses).
 *   3. Optionally falling back to the PDF's first page as a cover
 *      when Open Library has no match and the reMarkable is plugged
 *      in over USB.
 *   4. Rewriting the frontmatter with the canonical values, keeping
 *      any field the user has already filled in (never overwrites a
 *      manually-set author, year, ISBN, or cover-url).
 *
 * Usage:
 *   npm run library:enrich              # Open Library only, ~5 min
 *   npm run library:enrich -- --device  # also use reMarkable for covers on misses
 *   npm run library:enrich -- --slug atomic-habits  # one specific book
 *
 * Resume-friendly: a JSON cache at /tmp/library-enrich-cache.json
 * stores Open Library responses by slug, so re-running picks up
 * where it left off without re-querying.
 */

import { mkdir, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';

const exec = promisify(execFile);

const VAULT = '/Users/husayngokal/Documents/obsidian_vault';
const LIBRARY = join(VAULT, 'library');
const REMARKABLE_HOST = 'http://10.11.99.1';
const R2_REMOTE = 'r2:husayngokal-media';
const COVER_URL_BASE = 'https://media.husayngokal.com/library/covers';
const CACHE_PATH = join(tmpdir(), 'library-enrich-cache.json');

/* Open Library returns rich book metadata for free. We normalise its
   per-doc fields into this shape so the rest of the script doesn't
   care what source the data came from. */
interface BookMatch {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publishedYear?: number;
  isbn?: string;             // prefer 13, fall back to 10
  coverUrl?: string;         // already upgraded to a full-size URL
  categories?: string[];
  language?: string;
}

/* Subset of Open Library Search API doc fields we care about. */
interface OLDoc {
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  cover_i?: number;
  cover_edition_key?: string;
  subject?: string[];
  language?: string[];
  edition_count?: number;
}

interface OLResp {
  docs?: OLDoc[];
  numFound?: number;
}

interface CacheEntry {
  volume: BookMatch | null;
  fetchedAt: string;
}

async function loadCache(): Promise<Record<string, CacheEntry>> {
  try { return JSON.parse(await readFile(CACHE_PATH, 'utf8')); }
  catch { return {}; }
}
async function saveCache(c: Record<string, CacheEntry>): Promise<void> {
  await writeFile(CACHE_PATH, JSON.stringify(c, null, 2));
}

/* Normalise reMarkable's auto-titles into something Google Books can
   actually match. The PDF titles arrive in shapes like:
     "Atomic Habits_ An Easy _ Proven Way ... - James Clear"
     "12 Rules for Life - Jordan B Peterson"
     "The Selfish Gene"
     "Quantum Computing Explained (z-lib.org).pdf"
   Strategy: pull the author guess off the end first, then collapse
   the title to just the part before the first underscore (which
   represented a colon in the original filename — keeping the
   subtitle confused Google Books with its repeated colons). */
function normaliseTitle(raw: string): { title: string; authorGuess?: string } {
  let work = raw.trim();

  /* Pull a trailing " - Firstname [M.] Lastname [Lastname]" off the
     end and treat it as the author guess. Must run BEFORE we touch
     underscores so the dash is intact. */
  const authorRe = /\s+[-–]\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z]\.?)?\s+[A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+)*)\s*$/u;
  const am = work.match(authorRe);
  let authorGuess: string | undefined;
  if (am) {
    authorGuess = am[1];
    work = work.slice(0, am.index).trim();
  }

  /* Title is just the first underscore-separated chunk (the main
     title); subsequent chunks were the subtitle and lost their
     punctuation in the PDF→filename conversion. */
  if (work.includes('_')) work = work.split('_')[0].trim();

  /* Strip the usual scraping detritus. */
  work = work.replace(/\.(pdf|epub)$/i, '');
  work = work.replace(/\s*\(z-?lib\.?\w*\)\s*$/i, '');
  work = work.replace(/\s*\(libgen\.?\w*\)\s*$/i, '');
  work = work.replace(/\s+(pdf|epub)$/i, '');
  work = work.replace(/\s*\(\d+\)\s*$/, '');
  work = work.replace(/^the\s+/i, (m) => m);  // keep "The" — Google Books indexes it

  if (work.length > 90) work = work.slice(0, 90);
  return { title: work, authorGuess };
}

function pickIsbn(d: OLDoc): string | undefined {
  /* Open Library returns all ISBNs ever associated with the work
     across every edition. Prefer 13-digit (modern), then 10. */
  const isbns = d.isbn ?? [];
  return isbns.find((i) => i.replace(/-/g, '').length === 13)
      ?? isbns.find((i) => i.replace(/-/g, '').length === 10);
}

function coverUrlFor(d: OLDoc): string | undefined {
  /* Prefer the per-edition cover_i (specific edition's cover) over
     ISBN lookup, since the same ISBN can resolve to wrong editions
     when the OL data is messy. -L = ~500-600px wide. */
  if (d.cover_i) return `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`;
  const isbn = pickIsbn(d);
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn.replace(/-/g, '')}-L.jpg`;
  return undefined;
}

function docToMatch(d: OLDoc): BookMatch {
  return {
    title: d.title,
    subtitle: d.subtitle,
    authors: d.author_name,
    publishedYear: d.first_publish_year,
    isbn: pickIsbn(d),
    coverUrl: coverUrlFor(d),
    categories: d.subject?.slice(0, 5),  // OL returns hundreds; trim
    language: d.language?.[0],
  };
}

async function openLibraryLookup(title: string, authorGuess?: string): Promise<BookMatch | null> {
  /* Try with author qualifier first (precise), then title-only (broad).
     OL Search supports `title=` + `author=` query params. Take the
     first doc that has authors AND a cover_i — filters out the
     metadata-only stubs OL accumulates. */
  const attempts: { title: string; author?: string }[] = [];
  if (authorGuess) attempts.push({ title, author: authorGuess });
  attempts.push({ title });

  for (const a of attempts) {
    const params = new URLSearchParams({
      title: a.title,
      limit: '5',
      fields: 'title,subtitle,author_name,first_publish_year,isbn,cover_i,cover_edition_key,subject,language,edition_count',
    });
    if (a.author) params.set('author', a.author);
    const url = `https://openlibrary.org/search.json?${params.toString()}`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'husayngokal.com library enrich (husayn@husayngokal.com)' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as OLResp;
      const docs = json.docs ?? [];
      /* Prefer a doc with both author + cover. If none, take the first
         with at least one of them — better than nothing. */
      const withBoth = docs.find((d) => d.author_name?.length && d.cover_i);
      const withCover = docs.find((d) => d.cover_i);
      const withAuthor = docs.find((d) => d.author_name?.length);
      const pick = withBoth ?? withCover ?? withAuthor;
      if (pick) return docToMatch(pick);
    } catch { /* network blip — try the next attempt shape */ }
  }
  return null;
}

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const ab = await res.arrayBuffer();
  await writeFile(dest, Buffer.from(ab));
}

async function uploadToR2(localPath: string, r2Path: string): Promise<string> {
  /* Single-file upload via rclone copyto. The vault's pre-push hook
     uses the same remote so the credentials are already configured.
     --s3-no-check-bucket is essential: the R2 credentials are scoped
     to read/write objects, not CreateBucket, so rclone's default
     "ensure bucket exists" probe 403s and the whole upload fails. */
  await exec('rclone', ['copyto', localPath, `${R2_REMOTE}/${r2Path}`, '--s3-no-check-bucket']);
  return `${COVER_URL_BASE}/${r2Path.split('/').pop()}`;
}

async function renderPdfFirstPage(pdfPath: string, outNoExt: string): Promise<string | null> {
  /* pdftocairo writes <outNoExt>.jpg. Width 600px is a fine library
     thumbnail at @2x retina. Returns the JPG path or null on failure. */
  try {
    await exec('pdftocairo', ['-jpeg', '-singlefile', '-f', '1', '-l', '1', '-scale-to-x', '600', '-scale-to-y', '-1', pdfPath, outNoExt]);
    return `${outNoExt}.jpg`;
  } catch { return null; }
}

interface DeviceItem {
  ID: string;
  Type: string;
  VissibleName: string;
  fileType?: string;
}

async function listDeviceDocs(): Promise<Map<string, DeviceItem> | null> {
  /* Returns { slug → DeviceItem } when the reMarkable is reachable,
     else null. We slugify the title the same way the importer did
     so we can match library files back to their UUIDs. */
  try {
    const queue = [''];
    const all: DeviceItem[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      const res = await fetch(`${REMARKABLE_HOST}/documents/${id}`, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) return null;
      const list = (await res.json()) as DeviceItem[];
      for (const it of list) {
        all.push(it);
        if (it.Type === 'CollectionType') queue.push(it.ID);
      }
    }
    const byBaseSlug = new Map<string, DeviceItem>();
    for (const it of all) {
      if (it.Type !== 'DocumentType') continue;
      const slug = it.VissibleName.toLowerCase()
        .replace(/['']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      if (!byBaseSlug.has(slug)) byBaseSlug.set(slug, it);
    }
    return byBaseSlug;
  } catch { return null; }
}

interface EnrichResult {
  slug: string;
  status: 'enriched' | 'no-match' | 'unchanged' | 'error';
  detail?: string;
}

async function enrichBook(
  slug: string,
  cache: Record<string, CacheEntry>,
  deviceDocs: Map<string, DeviceItem> | null,
  useDevice: boolean,
): Promise<EnrichResult> {
  const path = join(LIBRARY, `${slug}.md`);
  const raw = await readFile(path, 'utf8');
  const fm = matter(raw);
  const data = fm.data as Record<string, unknown>;

  const currentTitle = String(data.title ?? slug);
  const currentAuthor = String(data.author ?? '');
  const currentCover = data['cover-url'] ? String(data['cover-url']) : undefined;

  /* No early-return on "already enriched" — the title-cleanup pass
     (below, where v.title replaces the noisy auto-import title) needs
     to run on previously-enriched books too, where author / isbn /
     cover were filled in but the title still carries the "<Title> -
     <Author>" tail. OL lookups are cached on disk so subsequent runs
     don't re-hit the API. */

  /* Open Library lookup (cached on disk so re-runs are free). */
  let entry = cache[slug];
  if (!entry) {
    const { title, authorGuess } = normaliseTitle(currentTitle);
    const guess = currentAuthor && currentAuthor !== 'Unknown' ? currentAuthor : authorGuess;
    const volume = await openLibraryLookup(title, guess);
    entry = { volume, fetchedAt: new Date().toISOString() };
    cache[slug] = entry;
    await saveCache(cache);
    /* OL is generous but be polite: 200ms between requests keeps us
       far under any reasonable rate limit. */
    await new Promise((r) => setTimeout(r, 200));
  }

  const v = entry.volume;
  let coverUrl = currentCover;

  /* Try the Open Library cover first. */
  if (!coverUrl && v?.coverUrl) {
    try {
      const localPath = join(tmpdir(), `cover-${slug}.jpg`);
      await downloadToFile(v.coverUrl, localPath);
      /* OL returns a 1×1 transparent GIF (~807 bytes) when a cover
         doesn't actually exist for the ID. Detect those and skip. */
      const st = await stat(localPath);
      if (st.size < 1500) {
        /* No real cover — leave coverUrl undefined so the device
           fallback can try, if enabled. */
      } else {
        coverUrl = await uploadToR2(localPath, `library/covers/${slug}.jpg`);
      }
    } catch (err) {
      console.warn(`  ${slug}: cover download/upload failed — ${(err as Error).message}`);
    }
  }

  /* Fall back to PDF first-page render if the reMarkable is plugged
     in and we still don't have a cover. Notebooks + ePubs are skipped
     here since pdftocairo can only handle PDFs. */
  if (!coverUrl && useDevice && deviceDocs?.has(slug)) {
    const doc = deviceDocs.get(slug)!;
    if (doc.fileType === 'pdf') {
      try {
        const tmpPdf = join(tmpdir(), `book-${slug}.pdf`);
        const dlRes = await fetch(`${REMARKABLE_HOST}/download/${doc.ID}/placeholder`, { signal: AbortSignal.timeout(60_000) });
        if (!dlRes.ok) throw new Error(`reMarkable download → ${dlRes.status}`);
        await writeFile(tmpPdf, Buffer.from(await dlRes.arrayBuffer()));
        const jpgPath = await renderPdfFirstPage(tmpPdf, join(tmpdir(), `cover-${slug}`));
        if (jpgPath) {
          coverUrl = await uploadToR2(jpgPath, `library/covers/${slug}.jpg`);
        }
      } catch (err) {
        console.warn(`  ${slug}: device fallback failed — ${(err as Error).message}`);
      }
    }
  }

  /* Build the new frontmatter — preserve user edits, fill in gaps.
     Treat the import-time placeholder values as missing so a real
     value from Open Library can replace them. */
  const updated: Record<string, unknown> = { ...data };
  const PLACEHOLDER_YEAR = 2026;          // set by remarkable-import.ts at import time
  const isImportPlaceholder = String(data.source ?? '').startsWith('reMarkable');
  const setIfMissing = <T,>(key: string, value: T | undefined): void => {
    if (value === undefined || value === null) return;
    const cur = updated[key];
    const isMissing = cur === undefined || cur === null || cur === '' || cur === 'Unknown';
    /* For auto-imported books only: also overwrite the placeholder
       year (== current year at import time) so the real publication
       year takes hold without erasing user-set years. */
    const isPlaceholderYear = key === 'year' && isImportPlaceholder && cur === PLACEHOLDER_YEAR;
    if (isMissing || isPlaceholderYear) updated[key] = value;
  };

  /* Title gets special treatment. The auto-imported titles have
     underscores from PDF-filename conversion (`Atomic Habits_ An
     Easy _ Proven Way ...`) — replacing those with the clean OL
     title is a clear win. But only do it for auto-imports, never
     overwrite a user-cleaned title. */
  if (v?.title && isImportPlaceholder) {
    const cur = currentTitle.toLowerCase();
    const ol = v.title.toLowerCase();
    const currentLooksAuto = currentTitle.includes('_')
      || /\.(pdf|epub)/i.test(currentTitle)
      || currentTitle === slug
      /* "Atomic Habits - James Clear" — OL title is a substring of the
         current title and OL's shorter. Strong signal that the current
         title has the author suffix tacked on and we should use OL's. */
      || (v.title.length < currentTitle.length * 0.9 && cur.includes(ol));
    if (currentLooksAuto) {
      updated.title = v.title && v.subtitle ? `${v.title}: ${v.subtitle}` : v.title;
    }
  }

  if (v) {
    setIfMissing('author', v.authors?.join(', '));
    setIfMissing('isbn', v.isbn);
    setIfMissing('year', v.publishedYear);
    /* Skip language — OL's per-doc language field is genuinely
       unreliable (returns the language of one indexed edition,
       often a foreign translation). Better to leave blank than
       lie. */
    setIfMissing('genre', v.categories?.map((c) => c.toLowerCase()));
  }
  if (coverUrl) {
    updated['cover-url'] = coverUrl;
  }

  /* Skip the rewrite if nothing semantic changed. Otherwise gray-
     matter will re-format the YAML (single-quotes, indented arrays)
     and create a diff on every file even when no data moved. */
  const sameKeys = Object.keys(updated).length === Object.keys(data).length;
  const noFieldChanged = sameKeys && Object.keys(updated).every((k) => {
    const a = updated[k], b = data[k];
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
    return a === b;
  });
  if (noFieldChanged) return { slug, status: 'unchanged' };

  const newRaw = matter.stringify(fm.content, updated, { lineWidth: -1 } as Parameters<typeof matter.stringify>[2]);
  await writeFile(path, newRaw);
  return {
    slug,
    status: v ? 'enriched' : (coverUrl ? 'enriched' : 'no-match'),
    detail: v
      ? `${v.authors?.[0] ?? '?'} · ${v.isbn ?? 'no-isbn'} · ${coverUrl ? 'cover✓' : 'cover✗'}`
      : (useDevice && deviceDocs?.has(slug)
          ? 'no OL match, device fallback also failed'
          : 'no Open Library match (try --device for PDF cover)'),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const useDevice = args.includes('--device');
  const onlySlug = args.includes('--slug')
    ? args[args.indexOf('--slug') + 1]
    : null;

  console.log(`Enriching library at ${LIBRARY}`);
  console.log(`Mode: Google Books${useDevice ? ' + reMarkable PDF fallback' : ' only'}`);
  if (onlySlug) console.log(`Only: ${onlySlug}`);

  let deviceDocs: Map<string, DeviceItem> | null = null;
  if (useDevice) {
    deviceDocs = await listDeviceDocs();
    if (!deviceDocs) {
      console.warn('reMarkable not reachable — falling back to Google Books only.');
    } else {
      console.log(`reMarkable connected: ${deviceDocs.size} documents indexed.`);
    }
  }

  const files = (await readdir(LIBRARY))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''))
    .filter((slug) => !onlySlug || slug === onlySlug)
    .sort();

  console.log(`\n${files.length} book${files.length === 1 ? '' : 's'} to process.\n`);

  const cache = await loadCache();
  const counts = { enriched: 0, 'no-match': 0, unchanged: 0, error: 0 };

  for (let i = 0; i < files.length; i++) {
    const slug = files[i];
    process.stdout.write(`[${String(i + 1).padStart(4)}/${files.length}] ${slug.slice(0, 60).padEnd(60)} `);
    try {
      const r = await enrichBook(slug, cache, deviceDocs, useDevice);
      counts[r.status]++;
      const icon = r.status === 'enriched' ? '✓'
                 : r.status === 'no-match' ? '·'
                 : r.status === 'unchanged' ? '=' : '✗';
      console.log(`${icon} ${r.detail ?? ''}`);
    } catch (err) {
      counts.error++;
      console.log(`✗ ${(err as Error).message}`);
    }
  }

  console.log('\nSummary:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(10)} ${v}`);
  console.log(`\nCache: ${CACHE_PATH}`);
  console.log('Covers uploaded to:', COVER_URL_BASE);
  console.log('\nNext: review the changes, then commit + push the vault.');
}

void stat;  // silence unused import
main().catch((err) => { console.error('\nFailed:', err); process.exit(1); });
