/*
 * Vault syncer — fetches the Obsidian vault state from GitHub via the
 * REST API, parses every .md file, upserts to Postgres.
 *
 * Used by both:
 *   - scripts/vault-sync.ts (manual CLI for local dev)
 *   - app/api/vault/webhook/route.ts (production webhook on push)
 *
 * Implementation note: we deliberately do NOT shell out to `git clone`
 * here. Vercel's serverless runtime has no git binary, and even on
 * machines with git the API approach avoids a transient working tree.
 *
 * Strategy:
 *   - GET /tarball/{branch} → the whole repo as one gzipped tar, in a
 *     SINGLE GitHub API call. This replaced a per-file blob fetch (1
 *     tree call + one /git/blobs/{sha} call per .md file). At 549 files
 *     that was ~550 requests per sync against the author's shared
 *     5,000 req/hr budget — ~9 syncs exhausted it, and since every
 *     Studio save commits (→ webhook → full sync), an editing session
 *     starved its own reads into 403s. The tarball is ~1 request.
 *   - Untar in memory, filter to .md files
 *   - Parse each via lib/vault/parse.ts
 *   - Group rows by table, batch upsert via the service-role client
 *   - Delete rows whose slug is no longer present in the vault — but
 *     only if there were zero parse errors, to prevent a broken file
 *     from silently deleting its DB row on the next sync
 *
 * The tarball still yields EVERY file's bytes, so the parse, wikilink-
 * graph and safe-delete passes are unchanged — they need the complete
 * file set, and an incremental (changed-files-only) fetch would have
 * broken both (a partial parse set wipes untouched tables in the
 * empty-folder sweep and drops backlink edges). Cheaper fetch, same
 * semantics.
 *
 * last_edited_at: the caller (webhook route) extracts per-path
 * timestamps from GitHub's push-event payload — `commits[].timestamp`
 * keyed by `commits[].added/modified` — and passes them in as
 * `opts.fileTimestamps`. We do NOT fetch the commits API per file
 * (the original implementation did; 136 files × 1 commit call each
 * was tipping over Vercel's 60s function limit and causing 504s).
 * If no hint map is provided (CLI manual sync), we leave the column
 * unset in the upsert payload, preserving existing values for known
 * slugs; brand-new slugs get NULL until their next webhook bump.
 */

import { revalidatePath } from 'next/cache';
import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { extract as tarExtract } from 'tar-stream';
import { parseFile, ParseError, type ParsedFile } from './parse';
import { getServerAdminClient } from '../supabase';
import { deriveAndWriteLiveState } from '../content/derive';
import { authorDay } from '../content/streak';
import { ACTIVITY_KEY, PATHS_KEY, writeStateIfChanged } from '../content/vault-state';
import {
  buildRegistry, extractWikilinks, resolveTarget, urlFor,
  type SlugRegistryEntry,
} from '../wikilinks';

export interface SyncResult {
  parsed: number;
  upserted: Record<string, number>;
  deleted: Record<string, number>;
  errors: { path: string; message: string }[];
  warnings: string[];
}

export interface SyncOptions {
  /** Map from vault-relative path → ISO 8601 timestamp of the most recent
   *  commit touching that path in the triggering push. Pass-through from
   *  the GitHub webhook payload's `commits` array. When provided, we
   *  populate `last_edited_at` from this map and skip the per-file
   *  commits API call entirely. */
  fileTimestamps?: Map<string, string>;
}

export async function syncVault(opts: SyncOptions = {}): Promise<SyncResult> {
  const owner  = process.env.VAULT_REPO_OWNER;
  const repo   = process.env.VAULT_REPO_NAME;
  const branch = process.env.VAULT_REPO_BRANCH || 'main';
  const pat    = process.env.GITHUB_PAT;

  if (!owner || !repo || !pat) {
    throw new Error('VAULT_REPO_OWNER, VAULT_REPO_NAME, GITHUB_PAT must be set');
  }

  const result: SyncResult = {
    parsed: 0, upserted: {}, deleted: {}, errors: [], warnings: [],
  };

  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'husayngokal-vault-sync',
  };

  /* 1+2. Fetch the whole repo as a single gzipped tarball and untar it in
     memory. One GitHub request regardless of file count (see header). The
     tarball endpoint 302s to a pre-signed codeload URL; fetch follows it,
     and undici drops the Authorization header on that cross-origin hop —
     which is fine, the signed URL needs no auth. last_edited_at still
     comes from opts.fileTimestamps (the webhook's push payload). */
  const tarUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${branch}`;
  const tarRes = await fetch(tarUrl, { headers, cache: 'no-store' });
  if (!tarRes.ok) {
    throw new Error(`GitHub tarball API failed (${tarRes.status}): ${await tarRes.text()}`);
  }
  const tarballGz = Buffer.from(await tarRes.arrayBuffer());

  const contents: { path: string; content: string; lastEditedAt: string | null }[] = [];
  await new Promise<void>((resolve, reject) => {
    const extract = tarExtract();
    extract.on('entry', (header, stream, next) => {
      /* Every entry is under a top-level `<owner>-<repo>-<sha>/` directory
         GitHub adds; strip that first segment for the vault-relative path. */
      const rel = header.name.replace(/^[^/]+\//, '');
      if (header.type !== 'file' || !rel.endsWith('.md')) {
        stream.on('end', next);
        stream.resume();               // drain + skip non-markdown entries
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c) => { chunks.push(c as Buffer); });
      stream.on('end', () => {
        contents.push({
          path: rel,
          content: Buffer.concat(chunks).toString('utf8'),
          lastEditedAt: opts.fileTimestamps?.get(rel) ?? null,
        });
        next();
      });
      stream.on('error', reject);
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    const gunzip = createGunzip();
    gunzip.on('error', reject);
    Readable.from(tarballGz).pipe(gunzip).pipe(extract);
  });

  /* 3. Parse each + attach last_edited_at into the row payload */
  const parsed: ParsedFile[] = [];
  /* slug -> vault path, for the tables Studio's one-tap updates edit. A
     task's slug comes from its frontmatter and its file sits in a nested
     folder, so the path cannot be rebuilt from the slug; record it here
     while both are in hand. */
  const pathIndex: Record<string, Record<string, string>> = {};
  for (const { path, content, lastEditedAt } of contents) {
    try {
      const p = parseFile(path, content);
      if (!p) continue;
      if (p.ignored) continue;
      if (INDEXED_TABLES.has(p.table) && p.slug) {
        (pathIndex[p.table] ??= {})[p.slug] = path;
      }
      if (lastEditedAt && p.row && typeof p.row === 'object') {
        (p.row as Record<string, unknown>).last_edited_at = lastEditedAt;
      }
      parsed.push(p);
      result.parsed++;
    } catch (err) {
      if (err instanceof ParseError) {
        result.errors.push({ path, message: err.message });
      } else {
        result.errors.push({ path, message: (err as Error).message });
      }
    }
  }

  /* 4. Group + upsert */
  const byTable = new Map<string, Record<string, unknown>[]>();
  for (const p of parsed) {
    if (!p.table) continue;
    const list = byTable.get(p.table) ?? [];
    list.push(p.row);
    byTable.set(p.table, list);
  }

  /* If any file failed to parse, skip deletion entirely — otherwise a
     broken file would silently delete its corresponding DB row, losing
     data we might still recover after the bug fix. Errors block deletes;
     upserts still go through. */
  const safeToDelete = result.errors.length === 0;
  if (!safeToDelete) {
    result.warnings.push(
      `${result.errors.length} parse error${result.errors.length === 1 ? '' : 's'} — skipping deletion of missing rows to prevent data loss`,
    );
  }

  const db = getServerAdminClient();

  /* Deterministic upsert order — parent tables before child tables so
     FK references resolve. Empty today: the notebook_posts → threads FK
     was the only parent/child pair and threads are gone. Kept because
     the next FK pair will need it, and the sort below already handles
     the empty case by falling through to alphabetical. */
  const UPSERT_ORDER: string[] = [];
  const orderedEntries = Array.from(byTable.entries()).sort(([a], [b]) => {
    const ia = UPSERT_ORDER.indexOf(a);
    const ib = UPSERT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  for (const [table, rows] of orderedEntries) {
    /* Tables with non-stable identity: full replace */
    if (table === 'life_journey_entries') {
      await db.from(table).delete().not('id', 'is', null);
      const { error } = await db.from(table).insert(rows);
      if (error) throw error;
      result.upserted[table] = rows.length;
      continue;
    }
    if (table === 'life_motto') {
      await db.from('life_motto').update({ active: false }).eq('active', true);
      const { error } = await db.from('life_motto').insert(rows);
      if (error) throw error;
      result.upserted[table] = rows.length;
      continue;
    }

    /* current_state rows (e.g. now/working.md → current_working) are
       keyed by `key` and hold a JSON `value`; they must never be touched
       by the slug-based delete sweep. Strip any last_edited_at the step-3
       injector added — current_state has updated_at, not last_edited_at. */
    if (table === 'current_state') {
      const clean = rows.map((r) => ({
        key: r.key as string,
        value: (r.value ?? {}) as object,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await db
        .from('current_state')
        .upsert(clean, { onConflict: 'key' });
      if (error) throw error;
      result.upserted[table] = rows.length;
      continue;
    }

    /* Comments are keyed by `id` (uuid), not `slug`. Status changes
       round-trip through the vault — never delete rows missing from
       the vault, because the row appears in DB before the file lands
       (the GitHub push is async). */
    if (table === 'comments') {
      const { error: upErr } = await db
        .from('comments')
        .upsert(rows, { onConflict: 'id' });
      if (upErr) throw upErr;
      result.upserted[table] = rows.length;
      continue;
    }

    const { error: upErr } = await db
      .from(table)
      .upsert(rows, { onConflict: 'slug' });
    if (upErr) throw upErr;
    result.upserted[table] = rows.length;

    if (!safeToDelete) continue;
    const liveSlugs = rows.map((r) => r.slug as string).filter(Boolean);
    const { data: existing, error: selErr } = await db.from(table).select('slug');
    if (selErr) {
      result.warnings.push(`could not enumerate ${table} for deletion: ${selErr.message}`);
      continue;
    }
    const toDelete = (existing ?? [])
      .map((r: { slug: string }) => r.slug)
      .filter((s) => !liveSlugs.includes(s));
    if (toDelete.length > 0) {
      const { error: delErr } = await db.from(table).delete().in('slug', toDelete);
      if (delErr) {
        result.warnings.push(`could not delete from ${table}: ${delErr.message}`);
      } else {
        result.deleted[table] = toDelete.length;
      }
    }
  }

  /* 4b. Sweep tables that went to zero — if the author deleted every
         file in a folder (e.g. emptying notebook/ during a content
         migration), the per-table loop above never iterated for that
         table, so its existing rows would stick around as ghosts on
         the live site. Only runs when safeToDelete is true (no parse
         errors), so a transient parser failure can't wipe content. */
  if (safeToDelete) {
    const SLUG_TABLES_WITH_DELETE = [
      'notebook_posts', 'library_books', 'projects',
      'mental_models', 'courses', 'writeups', 'credentials',
      'study_credentials', 'study_domains',
      'life_principles', 'life_story_vignettes', 'life_changed_mind',
      'life_goals', 'life_master_plan', 'tasks', 'ideas', 'living_entries',
      'research_topics',
    ];
    for (const t of SLUG_TABLES_WITH_DELETE) {
      if (byTable.has(t)) continue;          // already handled above
      const { count } = await db.from(t).select('slug', { count: 'exact', head: true });
      if (!count) continue;
      const { error: delErr } = await db.from(t).delete().not('slug', 'is', null);
      if (delErr) {
        result.warnings.push(`could not wipe empty table ${t}: ${delErr.message}`);
      } else {
        result.deleted[t] = count;
      }
    }
  }

  /* 5. Populate missing book covers from Open Library, one HEAD per
        ISBN. Skipped once a row already has cover_url (manual or
        previously-probed), so steady-state syncs do zero network. */
  try {
    await populateBookCovers(db, result);
  } catch (err) {
    result.warnings.push(`book cover discovery failed: ${(err as Error).message}`);
  }

  /* 6. Rebuild the wikilink graph from every parsed body. This powers
        backlink rendering on detail pages — BRIEF Part IV's "one
        mechanic, all surfaces" rule. We do it after upserts so the
        registry reflects post-sync titles, then full-replace the
        edges (sync runs at content-edit speed, not request speed). */
  try {
    await rebuildWikilinkGraph(db, parsed, result);
  } catch (err) {
    result.warnings.push(`wikilink graph rebuild failed: ${(err as Error).message}`);
  }

  /* 6a. Bookkeeping rows in current_state (key/value, so no migration):
        the slug -> path index, and the list of days the vault changed,
        which drives the activity streak. Both are written only when they
        actually differ, because every write to current_state is broadcast
        to open homepages over Realtime. Never fatal. */
  try {
    await writeStateIfChanged(db, PATHS_KEY, { paths: sortKeys(pathIndex) });
    const days = await fetchActivityDays(owner, repo, branch, headers);
    if (days) await writeStateIfChanged(db, ACTIVITY_KEY, { days });
  } catch (err) {
    result.warnings.push(`vault bookkeeping failed: ${(err as Error).message}`);
  }

  /* 6. Re-derive currently_* live-state rows from the freshly-upserted
        content. Realtime broadcasts to subscribers. */
  try {
    await deriveAndWriteLiveState(db);
  } catch (err) {
    result.warnings.push(`live-state derivation failed: ${(err as Error).message}`);
  }

  /* 7. Bust the ISR cache for every surface so visitors see new
        content within seconds, not after the 60s revalidate window.
        revalidatePath('/notebook/[slug]', 'page') invalidates ALL
        notebook detail pages at once; same trick for every other
        surface. Cheap. */
  try {
    const surfaces: { index: string; detail?: string }[] = [
      { index: '/',                    detail: undefined            },
      { index: '/notebook',            detail: '/notebook/[slug]'   },
      { index: '/library',             detail: '/library/[slug]'    },
      { index: '/projects',            detail: '/projects/[slug]'   },
      { index: '/mental-models',       detail: '/mental-models/[slug]' },
      { index: '/courses',             detail: '/courses/[slug]'    },
      { index: '/writeups',            detail: '/writeups/[slug]'   },
      { index: '/credentials',         detail: '/credentials/[slug]' },
      { index: '/study',               detail: undefined            },
      { index: '/study/credentials',   detail: '/study/credentials/[slug]' },
      { index: '/study/domains',       detail: '/study/domains/[slug]' },
      { index: '/life',                detail: undefined            },
      { index: '/life/changed-my-mind', detail: undefined           },
      { index: '/life/plan',           detail: '/life/plan/[slug]'  },
      { index: '/life/tasks',          detail: undefined            },
      { index: '/ideas',               detail: '/ideas/[slug]'      },
      { index: '/sitemap.xml',         detail: undefined            },
    ];
    for (const s of surfaces) {
      revalidatePath(s.index);
      if (s.detail) revalidatePath(s.detail, 'page');
    }
  } catch (err) {
    result.warnings.push(`revalidatePath failed: ${(err as Error).message}`);
  }

  return result;
}

const INDEXED_TABLES = new Set(['library_books', 'tasks', 'projects', 'living_entries']);

function sortKeys(index: Record<string, Record<string, string>>): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const table of Object.keys(index).sort()) {
    out[table] = Object.fromEntries(Object.entries(index[table]).sort(([a], [b]) => a.localeCompare(b)));
  }
  return out;
}

/* Days (author's timezone) on which the vault received a commit, over the
   last ~13 months. One or two GitHub requests per sync; the streak maths
   lives in lib/content/streak.ts. Returns null if GitHub refuses, so a
   bad response never overwrites a good stored list. */
async function fetchActivityDays(
  owner: string, repo: string, branch: string, headers: Record<string, string>,
): Promise<string[] | null> {
  const since = new Date(Date.now() - 400 * 86_400_000).toISOString();
  const days = new Set<string>();
  for (let page = 1; page <= 5; page++) {
    const url = `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&since=${since}&per_page=100&page=${page}`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const commits = (await res.json()) as Array<{ commit?: { author?: { date?: string } } }>;
    for (const c of commits) {
      const at = c.commit?.author?.date;
      if (at) days.add(authorDay(new Date(at)));
    }
    if (commits.length < 100) break;
  }
  return [...days].sort();
}

async function populateBookCovers(
  db: ReturnType<typeof getServerAdminClient>,
  result: SyncResult,
): Promise<void> {
  const { data, error } = await db
    .from('library_books')
    .select('slug, isbn, cover_url')
    .is('cover_url', null)
    .not('isbn', 'is', null);
  if (error || !data || data.length === 0) return;

  /* Probe Open Library in parallel batches of 6 — friendly to their
     CDN and well under any per-host concurrency limit we'd see from
     Vercel's edge. ?default=false makes them 404 instead of returning
     a "no cover" placeholder; we treat anything <2KB as missing. */
  const CONC = 6;
  const MIN_BYTES = 2_000;
  const found: { slug: string; url: string }[] = [];
  const missed: string[] = [];

  for (let i = 0; i < data.length; i += CONC) {
    const batch = data.slice(i, i + CONC);
    await Promise.all(batch.map(async (b) => {
      const isbn = (b.isbn as string).replace(/[^0-9Xx]/g, '');
      if (!isbn) { missed.push(b.slug as string); return; }
      const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
      try {
        const res = await fetch(url, { method: 'GET', redirect: 'follow' });
        if (!res.ok) { missed.push(b.slug as string); return; }
        const len = Number(res.headers.get('content-length') ?? 0);
        if (len > 0 && len < MIN_BYTES) { missed.push(b.slug as string); return; }
        /* When content-length is absent (some CDNs strip it on
           redirected responses) we accept the URL anyway — the
           browser will get the same payload. */
        found.push({ slug: b.slug as string, url });
      } catch {
        missed.push(b.slug as string);
      }
    }));
  }

  for (const { slug, url } of found) {
    await db.from('library_books').update({ cover_url: url }).eq('slug', slug);
  }
  if (found.length > 0)  result.warnings.push(`book covers found: ${found.length}`);
  if (missed.length > 0) result.warnings.push(`book covers missing: ${missed.length}`);
}

async function rebuildWikilinkGraph(
  db: ReturnType<typeof getServerAdminClient>,
  parsed: ParsedFile[],
  result: SyncResult,
): Promise<void> {
  /* Build the slug → (table, title, url) registry from this run's
     parsed rows. Tables that title their rows with `name` rather than
     `title` are covered by the fallback below; anything with neither
     falls back to slug. Comments are excluded — readers' wikilinks
     shouldn't pollute the graph. */
  const flat: SlugRegistryEntry[] = [];
  for (const p of parsed) {
    if (!p.table || !p.slug || p.table === 'comments') continue;
    const url = urlFor(p.table, p.slug);
    if (!url) continue;
    const r = p.row as Record<string, unknown>;
    const title = (r.title as string) || (r.name as string) || p.slug;
    flat.push({ table: p.table, slug: p.slug, title, url });
  }
  const registry = buildRegistry(flat);

  /* Resolve every wikilink in every body, dedupe per source/target
     pair, denormalise titles + URLs for cheap rendering. */
  type Row = {
    source_table: string; source_slug: string; source_title: string; source_url: string;
    target_table: string; target_slug: string; target_title: string; target_url: string;
    link_text: string | null;
  };
  const edges = new Map<string, Row>();
  const unresolved: string[] = [];
  for (const p of parsed) {
    if (!p.table || !p.bodyText || p.table === 'comments') continue;
    const sourceUrl = urlFor(p.table, p.slug);
    if (!sourceUrl) continue;
    const sourceTitle =
      ((p.row as Record<string, unknown>).title as string) ||
      ((p.row as Record<string, unknown>).name as string) ||
      p.slug;
    for (const ref of extractWikilinks(p.bodyText)) {
      const target = resolveTarget(registry, ref.target, p.table);
      if (!target) { unresolved.push(`${p.slug} → [[${ref.target}]]`); continue; }
      /* Skip self-links. */
      if (target.table === p.table && target.slug === p.slug) continue;
      const key = `${p.table}|${p.slug}|${target.table}|${target.slug}`;
      if (edges.has(key)) continue;
      edges.set(key, {
        source_table: p.table, source_slug: p.slug,
        source_title: sourceTitle, source_url: sourceUrl,
        target_table: target.table, target_slug: target.slug,
        target_title: target.title, target_url: target.url,
        link_text: ref.display,
      });
    }
  }

  /* Full replace: wipe + bulk insert. Wikilinks isn't on the Realtime
     publication so the gap window is fine — and any incoming reader
     sees stale-but-consistent state, never a partial graph. */
  const { error: delErr } = await db.from('wikilinks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) throw delErr;
  if (edges.size > 0) {
    const rows = Array.from(edges.values());
    /* Batch in case Supabase enforces a row-count cap on inserts. */
    for (let i = 0; i < rows.length; i += 500) {
      const { error: insErr } = await db.from('wikilinks').insert(rows.slice(i, i + 500));
      if (insErr) throw insErr;
    }
  }
  if (unresolved.length > 0) {
    result.warnings.push(
      `${unresolved.length} unresolved wikilink${unresolved.length === 1 ? '' : 's'}: ` +
      unresolved.slice(0, 10).join(', ') + (unresolved.length > 10 ? ', …' : ''),
    );
  }
}
