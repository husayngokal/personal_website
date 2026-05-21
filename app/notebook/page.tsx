import Link from 'next/link';
import { Eyebrow, Chip } from '@/components/Primitives';
import { getNotebookPosts, getNotebookThreads } from '@/lib/content/notebook';
import styles from './notebook.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

/*
 * Notebook index — thread map first, recent posts second, archive link
 * third. The reverse-chronological feed is reference; the thread map is
 * the foreground (Part VI). This inversion is structural.
 */

export const metadata = {
  title: 'Notebook',
  description:
    'Long-form essays, short notes, and named threads. Messy by design in spirit, editorial-grade in execution.',
};

export default async function NotebookIndex() {
  const [NOTEBOOK_POSTS, NOTEBOOK_THREADS] = await Promise.all([
    getNotebookPosts(), getNotebookThreads(),
  ]);
  const active   = NOTEBOOK_THREADS.filter((t) => t.state === 'active');
  const dormant  = NOTEBOOK_THREADS.filter((t) => t.state === 'dormant');
  const recent   = [...NOTEBOOK_POSTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="06">Notebook</Eyebrow>
        <h1 className={styles.title}>Notebook</h1>
        <p className={styles.dek}>
          Long-form essays, short notes, and named threads.
        </p>
      </header>

      {/* Thread map */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Active threads</h2>
        <div className={styles.threadMap}>
          {active.map((t) => {
            const postCount = NOTEBOOK_POSTS.filter((p) => p.thread === t.slug).length;
            return (
              <Link key={t.slug} href={`/notebook/threads/${t.slug}`} className={styles.threadCard}>
                <p className={styles.threadName}>{t.name}</p>
                <p className={styles.threadSummary}>{t.summary}</p>
                <p className={styles.threadMeta}>
                  {postCount} {postCount === 1 ? 'post' : 'posts'}
                </p>
              </Link>
            );
          })}
        </div>
        {dormant.length > 0 && (
          <>
            <h3 className={styles.subTitle}>Dormant threads</h3>
            <div className={styles.threadMap}>
              {dormant.map((t) => {
                const postCount = NOTEBOOK_POSTS.filter((p) => p.thread === t.slug).length;
                return (
                  <Link
                    key={t.slug}
                    href={`/notebook/threads/${t.slug}`}
                    className={`${styles.threadCard} ${styles.threadCardDormant}`}
                  >
                    <p className={styles.threadName}>{t.name}</p>
                    <p className={styles.threadSummary}>{t.summary}</p>
                    <p className={styles.threadMeta}>
                      {postCount} {postCount === 1 ? 'post' : 'posts'} · dormant
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Recent posts */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent</h2>
        <ul className={styles.recentList}>
          {recent.map((p) => (
            <li key={p.slug} className={styles.recentItem}>
              <Link href={`/notebook/${p.slug}`} className={styles.recentLink}>
                <p className={styles.recentMeta}>
                  <span className={styles.recentKind}>{p.kind}</span>
                  <span className={styles.recentDot}>·</span>
                  <span>{p.date}</span>
                  {p.thread && (
                    <>
                      <span className={styles.recentDot}>·</span>
                      <Chip>{NOTEBOOK_THREADS.find((t) => t.slug === p.thread)?.name ?? p.thread}</Chip>
                    </>
                  )}
                </p>
                <p className={styles.recentTitle}>{p.title}</p>
                {p.dek && <p className={styles.recentDek}>{p.dek}</p>}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
