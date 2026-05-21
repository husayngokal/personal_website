import { CrossLinkStrip } from './Primitives';
import { getBacklinks } from '@/lib/content/links';

/*
 * Backlinks server component — one of the brief's "one mechanic, all
 * surfaces" payoffs (BRIEF Part IV / Part XIII). Renders a uniform
 * "Referenced by" strip beneath any detail page. The connective tissue
 * is the same on every surface so the encyclopedia reads as one place.
 *
 * Returns null when nothing references the page yet — empty
 * connective tissue is worse than no connective tissue, and the strip
 * grows organically as new posts cross-link in.
 */

const SURFACE_LABEL: Record<string, string> = {
  notebook_posts:       'Notebook',
  notebook_threads:     'Notebook · thread',
  library_books:        'Library',
  projects:             'Projects',
  mental_models:        'Mental Models',
  courses:              'Courses',
  writeups:             'Writeups',
  credentials:          'Credentials',
  study_credentials:    'Study · credential',
  study_domains:        'Study · domain',
  life_principles:      'Life Plan · principle',
  life_changed_mind:    'Life Plan · changed my mind',
  life_story_vignettes: 'Life Plan · story',
};

export async function Backlinks({ table, slug }: { table: string; slug: string }) {
  const refs = await getBacklinks(table, slug);
  if (refs.length === 0) return null;
  return (
    <CrossLinkStrip
      title="Referenced by"
      items={refs.map((r) => ({
        href: r.source_url,
        label: r.source_title,
        sub: SURFACE_LABEL[r.source_table] ?? r.source_table,
      }))}
    />
  );
}
