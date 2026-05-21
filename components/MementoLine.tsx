import Link from 'next/link';
import styles from './MementoLine.module.css';

/*
 * MementoLine — the footer mounted on every page from the root
 * layout. Two lines:
 *
 *   - the memento mori line (BRIEF Part I): the foundational stance,
 *     linked to /life/calendar where the fuller treatment lives.
 *   - the contact email: the only way visitors reach the author.
 *
 * Both quiet, both mono, both centred. The point is that this is
 * site-wide infrastructure, not chrome — the email lives here
 * because every page needs a way out, and the calendar link lives
 * here because every page sits underneath the same clock.
 */

const CONTACT_EMAIL = 'husayn@husayngokal.com';

export function MementoLine() {
  return (
    <footer className={styles.footer}>
      <p className={styles.line}>
        <Link href="/life/calendar" className={styles.link}>
          the work is temporary. memento mori.
        </Link>
      </p>
      <p className={styles.contact}>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className={styles.link}
          aria-label={`Email Husayn at ${CONTACT_EMAIL}`}
        >
          {CONTACT_EMAIL}
        </a>
      </p>
    </footer>
  );
}
