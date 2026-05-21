import Link from 'next/link';
import { Eyebrow } from '@/components/Primitives';
import { getIdeas } from '@/lib/content/ideas';
import type { IdeaStatus } from '@/lib/types';
import styles from './ideas.module.css';

/*
 * Ideas — public ideation log for the website itself and adjacent
 * projects. Sorting puts the live ones (open, exploring, building)
 * before the historical ones (shipped, dropped). Everything is one
 * row per idea with the status chip, a one-sentence summary, the
 * date it landed, and a link to the full writeup.
 */

export const revalidate = 60;

export const metadata = {
  title: 'Ideas',
  description:
    'Live ideation log. Proposals for the website itself and adjacent projects, with status. Open thinking in public so the wrong ones can be killed faster.',
};

const STATUS_LABEL: Record<IdeaStatus, string> = {
  open:       'open',
  exploring:  'exploring',
  building:   'building',
  shipped:    'shipped',
  dropped:    'dropped',
};

export default async function IdeasIndex() {
  const ideas = await getIdeas();
  const counts: Record<IdeaStatus, number> = {
    open: 0, exploring: 0, building: 0, shipped: 0, dropped: 0,
  };
  for (const i of ideas) counts[i.status]++;

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="15">Ideas</Eyebrow>
        <h1 className={styles.title}>Ideas</h1>
        <p className={styles.dek}>
          Live ideation log. Proposals for the website itself and the
          projects spun out of it. Open thinking in public so the wrong
          ones can be killed faster and the right ones can find a builder
          earlier. Status flips happen in the vault.
        </p>
        <p className={styles.counts}>
          {(['open','exploring','building','shipped','dropped'] as IdeaStatus[])
            .filter((s) => counts[s] > 0)
            .map((s, i, arr) => (
              <span key={s}>
                {counts[s]} {STATUS_LABEL[s]}
                {i < arr.length - 1 && <span className={styles.countSep}> · </span>}
              </span>
            ))}
        </p>
      </header>

      {ideas.length === 0 ? (
        <p className={styles.empty}>No ideas published yet.</p>
      ) : (
        <ol className={styles.list}>
          {ideas.map((i) => (
            <li key={i.slug} className={`${styles.item} ${styles[`status-${i.status}`] ?? ''}`}>
              <Link href={`/ideas/${i.slug}`} className={styles.link}>
                <div className={styles.itemHead}>
                  <span className={styles.itemTitle}>{i.title}</span>
                  <span className={`${styles.statusChip} ${styles[`chip-${i.status}`] ?? ''}`}>
                    {STATUS_LABEL[i.status]}
                  </span>
                </div>
                <p className={styles.itemSummary}>{i.summary}</p>
                <p className={styles.itemMeta}>
                  proposed {i.proposed}
                  {i.tags && i.tags.length > 0 && (
                    <span className={styles.tagList}>
                      {i.tags.map((t) => (
                        <span key={t} className={styles.tag}>{t}</span>
                      ))}
                    </span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
