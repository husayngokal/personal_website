import Link from 'next/link';
import { Eyebrow } from '@/components/Primitives';
import { getNotebookPosts } from '@/lib/content/notebook';
import styles from './notebook.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

/*
 * Notebook index — one reverse-chronological list of essays, and
 * nothing else. The thread map and the note kind were removed in
 * August 2026: three filing options meant nothing got filed. The feed
 * is the surface now, and wikilinks carry every cross-reference.
 */

export const metadata = {
  title: 'Notebook',
  description: 'Long-form essays. Messy by design in spirit, editorial-grade in execution.',
};

export default async function NotebookIndex() {
  const posts = await getNotebookPosts();

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="06">Notebook</Eyebrow>
        <h1 className={styles.title}>Notebook</h1>
        <p className={styles.dek}>Long-form essays.</p>
      </header>

      <section className={styles.section}>
        {posts.length === 0 ? (
          <p className="empty-note">No essays yet.</p>
        ) : (
          <ul className={styles.recentList}>
            {posts.map((p) => (
              <li key={p.slug} className={styles.recentItem}>
                <Link href={`/notebook/${p.slug}`} className={styles.recentLink}>
                  <p className={styles.recentMeta}>
                    <span>{p.date}</span>
                    {p.wordCount && (
                      <>
                        <span className={styles.recentDot}>·</span>
                        <span>{p.wordCount.toLocaleString()} words</span>
                      </>
                    )}
                  </p>
                  <p className={styles.recentTitle}>{p.title}</p>
                  {p.dek && <p className={styles.recentDek}>{p.dek}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
