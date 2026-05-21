/*
 * Shared wikilink utilities — used by both the sync pipeline (to
 * populate the wikilinks table for backlink rendering) and the
 * markdown renderer (to rewrite [[slug]] into anchor tags during
 * post body conversion).
 *
 * Wikilink syntax (Obsidian-native):
 *   [[some-slug]]               → link with the target's title as text
 *   [[some-slug|custom text]]   → link with custom display text
 *   [[some-slug#heading]]       → link to a heading inside the target
 *
 * For cross-surface resolution we keep a single global slug → (table,
 * title, url) registry built from the current DB state. Lookups are
 * unique-slug-wins; on collision (same slug across tables) we prefer
 * a same-surface resolution if one is provided.
 */

/* Negative lookbehind on `!` so we don't match `![[image.png]]` —
   that's Obsidian's image-embed syntax, handled separately by
   lib/markdown.ts. Catching it here as a wikilink would log a
   spurious "unresolved" warning every sync. */
const WIKILINK = /(?<!!)\[\[([^|\]\n]+)(?:\|([^\]\n]+))?\]\]/g;

export interface WikilinkRef {
  /** The slug portion of the [[...]] target, anchor stripped. */
  target: string;
  /** Optional #heading anchor on the target, without the leading #. */
  anchor: string | null;
  /** Display text override, or null to use the resolved target title. */
  display: string | null;
}

/** Scan a body of markdown / plain text for every wikilink reference.
 *  Order is preserved; duplicates ARE returned (caller dedupes if needed). */
export function extractWikilinks(text: string): WikilinkRef[] {
  if (!text) return [];
  const refs: WikilinkRef[] = [];
  WIKILINK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WIKILINK.exec(text)) !== null) {
    const raw = m[1].trim();
    const display = m[2]?.trim() || null;
    const hashIdx = raw.indexOf('#');
    const target = (hashIdx === -1 ? raw : raw.slice(0, hashIdx)).trim();
    const anchor = hashIdx === -1 ? null : raw.slice(hashIdx + 1).trim() || null;
    if (!target) continue;
    refs.push({ target, anchor, display });
  }
  return refs;
}

export interface SlugRegistryEntry {
  table: string;
  slug: string;
  title: string;
  url: string;
}

/** Map a (table, slug) into the public site URL. Centralised so the
 *  whole link mechanic agrees on one URL shape per surface. */
export function urlFor(table: string, slug: string): string | null {
  switch (table) {
    case 'notebook_posts':       return `/notebook/${slug}`;
    case 'notebook_threads':     return `/notebook/threads/${slug}`;
    case 'library_books':        return `/library/${slug}`;
    case 'projects':             return `/projects/${slug}`;
    case 'mental_models':        return `/mental-models/${slug}`;
    case 'courses':              return `/courses/${slug}`;
    case 'writeups':             return `/writeups/${slug}`;
    case 'credentials':          return `/credentials/${slug}`;
    case 'study_credentials':    return `/study/credentials/${slug}`;
    case 'study_domains':        return `/study/domains/${slug}`;
    case 'life_principles':      return `/life#principle-${slug}`;
    case 'life_changed_mind':    return `/life/changed-my-mind#${slug}`;
    case 'life_story_vignettes': return `/life#story-${slug}`;
    /* These don't have their own pages and aren't link targets: */
    case 'life_motto':
    case 'life_goals':
    case 'life_journey_entries':
      return null;
    default: return null;
  }
}

/** Build the global slug-to-entry registry from a flat list of every
 *  parsed row. On slug collision across tables, the first occurrence
 *  wins for the unscoped registry; surface-scoped resolution
 *  (resolveTarget) then refines it. */
export function buildRegistry(entries: SlugRegistryEntry[]): {
  bySlug: Map<string, SlugRegistryEntry[]>;
} {
  const bySlug = new Map<string, SlugRegistryEntry[]>();
  for (const e of entries) {
    const list = bySlug.get(e.slug) ?? [];
    list.push(e);
    bySlug.set(e.slug, list);
  }
  return { bySlug };
}

/** Resolve a wikilink target slug against the registry, preferring a
 *  same-surface match when both source surface and a collision exist. */
export function resolveTarget(
  registry: { bySlug: Map<string, SlugRegistryEntry[]> },
  slug: string,
  preferTable?: string,
): SlugRegistryEntry | null {
  const matches = registry.bySlug.get(slug);
  if (!matches || matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  if (preferTable) {
    const same = matches.find((m) => m.table === preferTable);
    if (same) return same;
  }
  return matches[0];
}
