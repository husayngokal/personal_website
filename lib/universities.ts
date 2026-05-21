/*
 * Universities — the canonical list of institutions whose courses
 * appear on /courses. The `short` field is what shows on the uni chip
 * next to each course card. `slug` is what the frontmatter sets.
 *
 * Add a new institution by appending an entry. The /courses filter
 * sidebar populates automatically from courses that actually exist
 * (no empty buckets shown).
 *
 * Brand colours intentionally NOT included — the brief's single-accent
 * rule (orange-only) means no Harvard crimson, Yale blue, Stanford red.
 * Differentiation is purely through the short text.
 */

export interface University {
  slug: string;
  name: string;
  short: string;             // shown on chips
}

export const UNIVERSITIES: Record<string, University> = {
  mit:       { slug: 'mit',       name: 'Massachusetts Institute of Technology', short: 'MIT' },
  stanford:  { slug: 'stanford',  name: 'Stanford University',                    short: 'Stanford' },
  yale:      { slug: 'yale',      name: 'Yale University',                        short: 'Yale' },
  harvard:   { slug: 'harvard',   name: 'Harvard University',                     short: 'Harvard' },
  cornell:   { slug: 'cornell',   name: 'Cornell University',                     short: 'Cornell' },
  nyu:       { slug: 'nyu',       name: 'New York University',                    short: 'NYU' },
  coursera:  { slug: 'coursera',  name: 'Coursera (mixed providers)',             short: 'Coursera' },
};

export function getUniversity(slug: string): University {
  return UNIVERSITIES[slug] ?? { slug, name: slug, short: slug };
}
