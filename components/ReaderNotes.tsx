import { getApprovedComments } from '@/lib/content/comments';
import styles from './ReaderNotes.module.css';

/*
 * Reader notes section — the moderated, accepted comments below a
 * Notebook post (BRIEF Part VI). Renders nothing when empty so the
 * post page's footer stays clean for posts no one has noted on yet.
 *
 * Voice: each note in serif body, attributed in monospace eyebrow
 * format ("Name · date"). No threading, no reactions, no replies — a
 * note is a contribution, not a chat turn.
 */

export async function ReaderNotes({ postSlug }: { postSlug: string }) {
  const notes = await getApprovedComments(postSlug);
  if (notes.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Reader notes">
      <h2 className={styles.heading}>Reader notes</h2>
      <ol className={styles.list}>
        {notes.map((n) => {
          const date = n.reviewed_at ?? n.created_at;
          const author = n.name?.trim() || 'Anonymous';
          return (
            <li key={n.id} className={styles.note}>
              <p className={styles.meta}>
                <span className={styles.author}>{author}</span>
                <span className={styles.dot}>·</span>
                <time dateTime={date}>{formatDate(date)}</time>
              </p>
              <div className={styles.body}>
                {n.body.split(/\n\n+/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
    });
  } catch {
    return iso.slice(0, 10);
  }
}
