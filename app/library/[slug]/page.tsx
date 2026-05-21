import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Chip, StatusPill, ProgressBar, CrossLinkStrip } from '@/components/Primitives';
import { Backlinks } from '@/components/Backlinks';
import { BookCover } from '@/components/BookCover';
import { getBooks, getBook } from '@/lib/content/library';
import { getNotebookPosts } from '@/lib/content/notebook';
import { renderMarkdown } from '@/lib/markdown';
import styles from './book.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

/*
 * Book detail (Part VII). Two-column on desktop — cover on left, metadata
 * on right. Below the header: notes, review, threads, passages. Each
 * section is optional.
 */

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBook(slug);
  return b ? { title: `${b.title} — Library` } : {};
}

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();

  const notesHtml  = book.notes  ? await renderMarkdown(book.notes,  'library_books') : null;
  const reviewHtml = book.review ? await renderMarkdown(book.review, 'library_books') : null;

  // Threads from this book — find Notebook posts mentioning the book by slug/title
  const allPosts = await getNotebookPosts();
  const threadsFromBook = allPosts.filter((p) =>
    p.body.toLowerCase().includes(book.title.toLowerCase().split(':')[0].slice(0, 20))
  ).slice(0, 3);

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <div className={styles.headLayout}>
        <div className={styles.cover}>
          <BookCover url={book.coverUrl} width={180} height={252} alt={`${book.title} cover`} />
        </div>
        <div className={styles.metaCol}>
          <h1 className={styles.title}>{book.title}</h1>
          <p className={styles.author}>{book.author}</p>
          <ul className={styles.metaList}>
            <li>
              <span className={styles.metaLabel}>Status</span>
              <span><StatusPill status={book.status} label={book.status} /></span>
            </li>
            {book.started && (
              <li><span className={styles.metaLabel}>Started</span><span className={styles.metaValue}>{book.started}</span></li>
            )}
            {book.finished && (
              <li><span className={styles.metaLabel}>Finished</span><span className={styles.metaValue}>{book.finished}</span></li>
            )}
            {typeof book.progressPct === 'number' && (
              <li>
                <span className={styles.metaLabel}>Progress</span>
                <span><ProgressBar pct={book.progressPct} width="120px" /></span>
              </li>
            )}
            {book.rating && (
              <li><span className={styles.metaLabel}>Rating</span><span className={styles.metaValue}>{'★'.repeat(book.rating)}</span></li>
            )}
            {book.genre && (
              <li>
                <span className={styles.metaLabel}>Genre</span>
                <span className={styles.chips}>{book.genre.map((g) => <Chip key={g}>{g}</Chip>)}</span>
              </li>
            )}
            {book.source && (
              <li><span className={styles.metaLabel}>Source</span><span className={styles.metaValue}>{book.source}</span></li>
            )}
            {book.isbn && (
              <li><span className={styles.metaLabel}>ISBN</span><span className={styles.metaValue}>{book.isbn}</span></li>
            )}
          </ul>
        </div>
      </div>

      {notesHtml && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Notes</h2>
          <div className={styles.notes} dangerouslySetInnerHTML={{ __html: notesHtml }} />
        </section>
      )}

      {reviewHtml && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Review</h2>
          <div className={styles.review} dangerouslySetInnerHTML={{ __html: reviewHtml }} />
        </section>
      )}

      {book.passages && book.passages.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Passages</h2>
          {book.passages.map((p, i) => (
            <blockquote key={i} className={styles.passage}>
              <p>{p.text}</p>
              {p.page && <cite className={styles.passagePage}>p.{p.page}</cite>}
            </blockquote>
          ))}
        </section>
      )}

      {threadsFromBook.length > 0 && (
        <CrossLinkStrip
          title="Threads from this book"
          items={threadsFromBook.map((t) => ({ href: `/notebook/${t.slug}`, label: t.title, sub: t.date }))}
        />
      )}

      <Backlinks table="library_books" slug={book.slug} />
    </div>
  );
}
