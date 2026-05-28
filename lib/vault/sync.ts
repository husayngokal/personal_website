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
 *   - GET /git/trees/{branch}?recursive=1 → all paths + SHAs
 *   - Filter to .md files
 *   - GET /git/blobs/{sha} in batches (concurrency-limited so we
 *     don't spike GitHub's secondary rate limit)
 *   - Parse each via lib/vault/parse.ts
 *   - Group rows by table, batch upsert via the service-role client
 *   - Delete rows whose slug is no longer present in the vault — but
 *     only if there were zero parse errors, to prevent a broken file
 *     from silently deleting its DB row on the next sync
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
import { parseFile, ParseError, type ParsedFile } from './parse';
import { getServerAdminClient } from '../supabase';
import { deriveAndWriteLiveState } from '../content/derive';
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

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

const CONCURRENCY = 12;

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

  /* 1. Get the recursive tree */
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const treeRes = await fetch(treeUrl, { headers, cache: 'no-store' });
  if (!treeRes.ok) {
    throw new Error(`GitHub trees API failed (${treeRes.status}): ${await treeRes.text()}`);
  }
  const treeJson = (await treeRes.json()) as { tree: TreeEntry[]; truncated: boolean };
  if (treeJson.truncated) {
    result.warnings.push('Tree response was truncated by GitHub — vault has grown past 100k entries or 7MB. Switch to paged tree walk.');
  }

  const mdFiles = treeJson.tree.filter(
    (e) => e.type === 'blob' && e.path.endsWith('.md'),
  );

  /* 2. Fetch every .md blob in parallel, batched for rate-limit safety.
     Per-file commits API is intentionally NOT called here — see the
     header comment. last_edited_at comes from opts.fileTimestamps. */
  const contents: { path: string; content: string; lastEditedAt: string | null }[] = [];
  for (let i = 0; i < mdFiles.length; i += CONCURRENCY) {
    const batch = mdFiles.slice(i, i + CONCURRENCY);
    const fetched = await Promise.all(batch.map(async (f) => {
      const blobUrl = `https://api.github.com/repos/${owner}/${repo}/git/blobs/${f.sha}`;
      const bRes = await fetch(blobUrl, { headers, cache: 'no-store' });
      if (!bRes.ok) {
        result.errors.push({ path: f.path, message: `blob fetch failed (${bRes.status})` });
        return null;
      }
      const j = (await bRes.json()) as { content: string; encoding: string };
      const content = j.encoding === 'base64'
        ? Buffer.from(j.content, 'base64').toString('utf8')
        : j.content;
      const lastEditedAt = opts.fileTimestamps?.get(f.path) ?? null;
      return { path: f.path, content, lastEditedAt };
    }));
    for (const item of fetched) if (item) contents.push(item);
  }

  /* 3. Parse each + attach last_edited_at into the row payload */
  const parsed: ParsedFile[] = [];
  for (const { path, content, lastEditedAt } of contents) {
    try {
      const p = parseFile(path, content);
      if (!p) continue;
      if (p.ignored) continue;
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
     FK references resolve. notebook_threads MUST come before
     notebook_posts (posts.thread → threads.slug), and similarly any
     future parent/child pairs go here. Tables not listed sort
     alphabetically at the end. */
  const UPSERT_ORDER = [
    'notebook_threads',
    'notebook_posts',
  ];
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
      'notebook_posts', 'notebook_threads', 'library_books', 'projects',
      'mental_models', 'courses', 'writeups', 'credentials',
      'study_credentials', 'study_domains',
      'life_principles', 'life_story_vignettes', 'life_changed_mind',
      'life_goals', 'life_master_plan', 'tasks', 'ideas', 'living_entries',
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
      { index: '/notebook',            detail: '/notebook/threads/[name]' },
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
     parsed rows. notebook_threads uses `name` instead of `title`; all
     others fall back to slug if no title surface exists. Comments
     are excluded — readers' wikilinks shouldn't pollute the graph. */
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
