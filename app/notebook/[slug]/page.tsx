import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Chip, CrossLinkStrip, PullQuote } from '@/components/Primitives';
import { Backlinks } from '@/components/Backlinks';
import { ReaderNotes } from '@/components/ReaderNotes';
import {
  getNotebookPost, getNotebookPosts, getNotebookThread,
} from '@/lib/content/notebook';
import { renderMarkdown } from '@/lib/markdown';
import styles from './post.module.css';

/*
 * Notebook post detail page (Part VI). Single-column reading surface
 * with optional drop cap, sidenotes in the right gutter (rendered inline
 * for now), and the PR-style submission form at the bottom.
 */

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

export async function generateStaticParams() {
  const posts = await getNotebookPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getNotebookPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.dek ?? post.title,
  };
}

export default async function NotebookPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getNotebookPost(slug);
  if (!post) notFound();

  const html = await renderMarkdown(post.body, 'notebook_posts');
  const thread = post.thread ? await getNotebookThread(post.thread) : null;

  /* Related: other posts in the same thread, then a generic backlink stand-in */
  const allPosts = await getNotebookPosts();
  const related = thread
    ? allPosts.filter((p) => p.thread === thread.slug && p.slug !== post.slug).slice(0, 4)
    : [];

  return (
    <article className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <p className={styles.kind}>{post.kind}</p>
        <h1 className={styles.title}>{post.title}</h1>
        {post.dek && <p className={styles.dek}>{post.dek}</p>}
        <p className={styles.meta}>
          <span>{post.date}</span>
          {post.wordCount && (
            <>
              <span className={styles.metaDot}>·</span>
              <span>{post.wordCount.toLocaleString()} words</span>
            </>
          )}
          {thread && (
            <>
              <span className={styles.metaDot}>·</span>
              <Chip href={`/notebook/threads/${thread.slug}`}>{thread.name}</Chip>
            </>
          )}
        </p>
        {post.epistemicStatus && (
          <p className={styles.epistemic}>
            <span className={styles.epistemicLabel}>epistemic status:</span> {post.epistemicStatus}
          </p>
        )}
        <hr className={styles.headRule} />
      </header>

      {/* Body — rendered markdown */}
      <div
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Decorative pull quote sample on the first essay only, to show the
          component on the reading surface */}
      {post.slug === 'on-certifying-and-learning' && (
        <PullQuote>
          The question is not <em>did I pass?</em> — the question is <em>what stuck?</em>
        </PullQuote>
      )}

      {/* Cross-link strip */}
      {related.length > 0 && (
        <CrossLinkStrip
          title="More in this thread"
          items={related.map((r) => ({ href: `/notebook/${r.slug}`, label: r.title, sub: r.date }))}
        />
      )}

      {/* Wikilink backlinks (BRIEF Part IV — the one mechanic) */}
      <Backlinks table="notebook_posts" slug={post.slug} />

      {/* Accepted reader notes (BRIEF Part VI) */}
      <ReaderNotes postSlug={post.slug} />

      {/* PR-style comment submission (Part VI) */}
      <section className={styles.submit}>
        <h2 className={styles.submitTitle}>Submit a note on this post</h2>
        <p className={styles.submitBlurb}>
          Notes go to a moderation queue, not a public comment thread. The author
          reviews them in Obsidian. Substantive notes appear on the post under a{' '}
          <em>reader notes</em> section; drive-by complaints do not.
        </p>
        <form
          className={styles.submitForm}
          action="/api/notebook/submit"
          method="post"
        >
          <input type="hidden" name="post" value={post.slug} />
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Your note</span>
            <textarea
              name="note"
              rows={5}
              required
              placeholder="A substantive thought on this post."
            />
          </label>
          <div className={styles.row}>
            <label className={`${styles.field} ${styles.fieldHalf}`}>
              <span className={styles.fieldLabel}>Email (required)</span>
              <input type="email" name="email" required />
            </label>
            <label className={`${styles.field} ${styles.fieldHalf}`}>
              <span className={styles.fieldLabel}>Name (optional)</span>
              <input type="text" name="name" />
            </label>
          </div>
          <button type="submit" className={styles.submitButton}>
            Submit for review →
          </button>
        </form>
      </section>
    </article>
  );
}
