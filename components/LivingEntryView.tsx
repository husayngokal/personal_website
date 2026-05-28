import { renderMarkdown } from '@/lib/markdown';
import type { LivingEntry } from '@/lib/types';
import styles from './LivingEntryView.module.css';

/*
 * Living entry view — shared header + body treatment for every page
 * in the Living menu group (currently bucket list and field atlas).
 *
 * Each Living route is its own server component that fetches one entry
 * by slug and hands it here. This keeps the routes thin, gives every
 * Living page a consistent feel, and means style adjustments land in
 * one place rather than drifting across the surfaces.
 *
 * Markdown body is rendered through the standard pipeline (wikilink
 * rewrite, editorial table treatment, image embeds).
 */

interface LivingEntryViewProps {
  entry: LivingEntry;
  /** Number under the title, e.g. "17" in "17. Living · Bucket List".
   *  Optional — when omitted, just the title row prints. */
  kicker?: string;
}

export async function LivingEntryView({ entry, kicker }: LivingEntryViewProps) {
  const html = await renderMarkdown(entry.body, 'living_entries');
  return (
    <article className={styles.page}>
      {kicker && <p className={styles.kicker}>{kicker}</p>}
      <h1 className={styles.title}>{entry.title}</h1>
      {entry.summary && <p className={styles.dek}>{entry.summary}</p>}
      <div className={styles.body} dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
