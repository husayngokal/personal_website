/*
 * reMarkable → library importer.
 *
 *   npm run remarkable:import
 *
 * Walks the reMarkable USB Web Interface (http://10.11.99.1 when the
 * device is plugged in with a wire and the interface is toggled on
 * in Settings → Storage → USB web interface), grabs every PDF and
 * ePub on the device, and writes one library/<slug>.md per file into
 * the vault. Notebooks (handwritten) are filtered out.
 *
 * No cloud sync, no SSH password sharing, no premium subscription
 * required — the USB Web Interface ships on every reMarkable and is
 * free.
 *
 * Workflow:
 *   1. Plug reMarkable into the Mac
 *   2. On device: Settings → Storage → USB web interface → ON
 *   3. Visit http://10.11.99.1 in a browser once to confirm it loads
 *   4. Run this script
 *   5. Review generated library/<slug>.md files, fill in author /
 *      year / status / rating where you care
 *   6. Commit the vault and push — vault sync upserts to Postgres
 *
 * The generated files are deliberately minimal:
 *   - title from the reMarkable metadata
 *   - tags from the source folder path (flat-with-folder-as-tag)
 *   - author: 'Unknown' (you fill in)
 *   - status: 'wishlist' (you change to 'reading' / 'finished' etc.)
 *   - source: 'remarkable'
 *
 * This is intentional — better to have 200 partial entries you can
 * promote one by one than to fake author / year from filename heuristics.
 */

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const HOST = process.env.REMARKABLE_HOST ?? 'http://10.11.99.1';
const VAULT_LIBRARY = process.env.VAULT_LIBRARY
  ?? '/Users/husayngokal/Documents/obsidian_vault/library';

interface DocItem {
  ID: string;
  Type: 'CollectionType' | 'DocumentType';
  VissibleName: string;        // sic — typo in the reMarkable API
  Parent: string;
  ModifiedClient?: string;
  fileType?: 'pdf' | 'epub' | 'notebook' | '';
  CurrentPage?: number;
  Pages?: number;
  Bookmarked?: boolean;
}

interface Resolved extends DocItem {
  folderPath: string[];   // parent chain ['Books', 'Philosophy']
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/* The USB Web Interface returns the children of a folder ID at
 * `/documents/{id}`. Empty id is the root. */
async function listChildren(parentId: string): Promise<DocItem[]> {
  return fetchJson<DocItem[]>(`${HOST}/documents/${parentId}`);
}

async function walkAll(): Promise<DocItem[]> {
  const all: DocItem[] = [];
  const queue: string[] = [''];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const kids = await listChildren(id);
    for (const k of kids) {
      all.push(k);
      if (k.Type === 'CollectionType') queue.push(k.ID);
    }
  }
  return all;
}

function buildFolderPaths(all: DocItem[]): Map<string, string[]> {
  /* For each ID, resolve the chain of parent folder names to the
     root. Used to derive tags. */
  const byId = new Map(all.map((d) => [d.ID, d]));
  const pathCache = new Map<string, string[]>();
  function pathOf(id: string): string[] {
    if (!id) return [];
    const cached = pathCache.get(id);
    if (cached) return cached;
    const node = byId.get(id);
    if (!node) return [];
    const parents = pathOf(node.Parent);
    const path = node.Type === 'CollectionType'
      ? [...parents, node.VissibleName]
      : parents;
    pathCache.set(id, path);
    return path;
  }
  const result = new Map<string, string[]>();
  for (const d of all) result.set(d.ID, pathOf(d.ID));
  return result;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function yamlList(items: string[]): string {
  if (items.length === 0) return '[]';
  return `[${items.map((t) => JSON.stringify(t)).join(', ')}]`;
}

async function existingFile(path: string): Promise<boolean> {
  try { await stat(path); return true; }
  catch { return false; }
}

async function writeBookFile(
  item: Resolved,
  takenSlugs: Set<string>,
): Promise<{ written: boolean; path: string; reason?: 'existing' | 'collision-resolved'; suffix?: number }> {
  const baseSlug = slugify(item.VissibleName);
  if (!baseSlug) return { written: false, path: '' };

  /* Two reasons to suffix the slug:
     1. A file already exists on disk (hand-edited or written by a
        previous import run) — preserve it, but still emit this new
        book under -2 / -3 / ... so nothing on the device is dropped.
     2. Two books on the device slugify to the same value within this
        same run — the second through Nth get suffixed.
     Both cases now land instead of being silently skipped, which
     was confusing ("9 files already exist" with no list). */
  let slug = baseSlug;
  let suffix = 1;
  let collision: 'existing' | 'collision-resolved' | null = null;
  while (takenSlugs.has(slug) || await existingFile(join(VAULT_LIBRARY, `${slug}.md`))) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
    collision = takenSlugs.has(`${baseSlug}`) ? 'collision-resolved' : 'existing';
  }
  takenSlugs.add(slug);
  const path = join(VAULT_LIBRARY, `${slug}.md`);

  const tags = item.folderPath.map((p) => slugify(p)).filter(Boolean);
  const fileType = item.fileType === 'epub' ? 'ePub' : 'PDF';

  const frontmatter = `---
title: ${JSON.stringify(item.VissibleName)}
author: "Unknown"
status: wishlist
year: ${new Date().getFullYear()}
source: "reMarkable (${fileType})"
genre: ${yamlList(tags)}
---

Imported from reMarkable on ${new Date().toISOString().slice(0, 10)}.
Fill in author, year, status, and rating before committing.

## Notes

## Review

## Passages
`;

  await writeFile(path, frontmatter, 'utf8');
  return { written: true, path, reason: collision ?? undefined, suffix: suffix > 1 ? suffix : undefined };
}

async function main() {
  console.log(`Importing from reMarkable USB Web Interface at ${HOST}\n`);

  /* Quick capability check — if the device isn't plugged in / web
     interface is off, fail with a useful message rather than a
     mysterious fetch error. */
  try {
    await fetchJson<DocItem[]>(`${HOST}/documents/`);
  } catch (err) {
    console.error('Could not reach the USB Web Interface.');
    console.error('Check that:');
    console.error('  1. The reMarkable is connected via USB');
    console.error('  2. Settings → Storage → USB web interface is ON');
    console.error('  3. http://10.11.99.1 loads in your browser');
    console.error(`\nFetch error: ${(err as Error).message}`);
    process.exit(1);
  }

  await mkdir(VAULT_LIBRARY, { recursive: true });

  const all = await walkAll();
  const folders = buildFolderPaths(all);

  const books = all.filter((d) => {
    if (d.Type !== 'DocumentType') return false;
    /* Drop handwritten notebooks — only consumed material. */
    if (d.fileType === 'notebook' || d.fileType === '') return false;
    return d.fileType === 'pdf' || d.fileType === 'epub';
  });

  console.log(`Found ${books.length} books (${all.length - books.length} folders + notebooks skipped)\n`);

  let written = 0;
  const suffixed: { title: string; slug: string; suffix: number; reason?: string }[] = [];
  const takenSlugs = new Set<string>();
  for (const b of books) {
    const item: Resolved = { ...b, folderPath: folders.get(b.ID) ?? [] };
    const { written: w, path, suffix, reason } = await writeBookFile(item, takenSlugs);
    if (w) {
      written++;
      const slug = path.split('/').pop()?.replace(/\.md$/, '') ?? '';
      if (suffix && suffix > 1) {
        suffixed.push({ title: b.VissibleName, slug, suffix, reason });
        console.log(`  + ${b.VissibleName}  ↑ ${slug}.md  (suffix -${suffix}, ${reason ?? 'duplicate'})`);
      } else {
        console.log(`  + ${b.VissibleName}  (tags: ${item.folderPath.join(' / ')})`);
      }
    }
  }

  console.log(`\nWrote ${written} new file${written === 1 ? '' : 's'} to ${VAULT_LIBRARY}`);
  if (suffixed.length > 0) {
    console.log(`\n${suffixed.length} file${suffixed.length === 1 ? '' : 's'} got a numeric suffix because the natural slug was already taken:`);
    for (const s of suffixed) {
      console.log(`  · ${s.title}`);
      console.log(`     → library/${s.slug}.md`);
    }
    console.log('\n  Either: leave them (the suffix is harmless), or rename one of each pair\n  in the vault to something more distinct before committing.');
  }
  console.log('\nNext steps:');
  console.log('  1. Open the new files, fill in author / year / status / rating');
  console.log('  2. cd to the vault, git add library/, commit, push');
  console.log('  3. Vault webhook syncs to Postgres; library page updates');
}

main().catch((err) => {
  console.error('\nImport failed:', err);
  process.exit(1);
});

/* Silence the unused-import warning when resolve isn't used. */
void resolve;
void readFile;
