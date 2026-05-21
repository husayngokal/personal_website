import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip } from '@/components/Primitives';
import { getNotebookThreads, getNotebookThread, getPostsInThread } from '@/lib/content/notebook';
import styles from '../../notebook.module.css';

/*
 * Thread landing page — rendered automatically from posts tagged with
 * this thread's slug. Editorial summary + chronological list of posts
 * with essays/notes distinguishable. (Part VI)
 */

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

export async function generateStaticParams() {
  const threads = await getNotebookThreads();
  return threads.map((t) => ({ name: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const t = await getNotebookThread(name);
  return { title: t ? `${t.name} — thread` : 'Thread' };
}

export default async function ThreadPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const thread = await getNotebookThread(name);
  if (!thread) notFound();
  const posts = (await getPostsInThread(name)).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--type-mono-s)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 'var(--space-m)' }}>
          Thread · {thread.state}
        </p>
        <h1 className={styles.title}>{thread.name}</h1>
        <p className={styles.dek}>{thread.summary}</p>
      </header>

      <ul className={styles.recentList}>
        {posts.map((p) => (
          <li key={p.slug} className={styles.recentItem}>
            <Link href={`/notebook/${p.slug}`} className={styles.recentLink}>
              <p className={styles.recentMeta}>
                <span className={styles.recentKind}>{p.kind}</span>
                <span className={styles.recentDot}>·</span>
                <span>{p.date}</span>
              </p>
              <p className={styles.recentTitle}>{p.title}</p>
              {p.dek && <p className={styles.recentDek}>{p.dek}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
