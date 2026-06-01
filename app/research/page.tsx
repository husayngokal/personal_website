import Link from 'next/link';
import { Eyebrow } from '@/components/Primitives';
import { getResearchTopics } from '@/lib/content/research';
import type { ResearchStatus } from '@/lib/types';
import styles from './research.module.css';

/*
 * Research index — list of active topics the author is gathering
 * material around. The doctrine: each topic is the resource cluster
 * that will eventually compress into a notebook essay, a writeup, or
 * a more structured paper entry.
 *
 * Sort comes from getResearchTopics (status priority + recency); the
 * list page just renders. Status chip leads each card so the visitor
 * can see at a glance which topics are still in the gathering stage
 * vs already producing output.
 */

export const revalidate = 60;

export const metadata = {
  title: 'Research',
  description:
    'Topic-level research log. Live bookmarks plus working notes for the topics the author is actively gathering resources around, on the way to written output.',
};

const STATUS_LABEL: Record<ResearchStatus, string> = {
  gathering: 'gathering',
  exploring: 'exploring',
  writing:   'writing',
  shipped:   'shipped',
  dormant:   'dormant',
};

export default async function ResearchIndex() {
  const topics = await getResearchTopics();
  const counts: Record<ResearchStatus, number> = {
    gathering: 0, exploring: 0, writing: 0, shipped: 0, dormant: 0,
  };
  for (const t of topics) counts[t.status]++;

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="17">Research</Eyebrow>
        <h1 className={styles.title}>Research</h1>
        <p className={styles.dek}>
          Topic-level research log. Each entry is a live cluster of
          resources (papers, articles, videos, repos, podcasts) plus
          working notes for one subject the author is actively gathering
          material around. Resources go in here instead of into a
          browser tab group, on the way to becoming notebook essays,
          writeups, or, eventually, a proper paper library.
        </p>
        <p className={styles.counts}>
          {(['gathering','exploring','writing','shipped','dormant'] as ResearchStatus[])
            .filter((s) => counts[s] > 0)
            .map((s, i, arr) => (
              <span key={s}>
                {counts[s]} {STATUS_LABEL[s]}
                {i < arr.length - 1 && <span className={styles.countSep}> · </span>}
              </span>
            ))}
        </p>
      </header>

      {topics.length === 0 ? (
        <p className={styles.empty}>No research topics yet.</p>
      ) : (
        <ol className={styles.list}>
          {topics.map((t) => (
            <li key={t.slug} className={`${styles.item} ${styles[`status-${t.status}`] ?? ''}`}>
              <Link href={`/research/${t.slug}`} className={styles.link}>
                <div className={styles.itemHead}>
                  <span className={styles.itemTitle}>{t.title}</span>
                  <span className={`${styles.statusChip} ${styles[`chip-${t.status}`] ?? ''}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>
                {t.summary && <p className={styles.itemSummary}>{t.summary}</p>}
                <p className={styles.itemMeta}>
                  {t.started && <span>started {t.started}</span>}
                  {t.tags && t.tags.length > 0 && (
                    <span className={styles.tagList}>
                      {t.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>{tag}</span>
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
