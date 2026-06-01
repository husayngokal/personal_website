import Link from 'next/link';
import { GitHubMark } from './marks/GitHubMark';
import { LinkedInMark } from './marks/LinkedInMark';
import styles from './MementoLine.module.css';

/*
 * MementoLine — the footer mounted on every page from the root
 * layout. Three lines:
 *
 *   - the memento mori line (BRIEF Part I): the foundational stance,
 *     linked to /life/calendar where the fuller treatment lives.
 *   - the contact email: the primary way visitors reach the author.
 *   - elsewhere marks: GitHub + LinkedIn. Same affordance as the
 *     email — every page needs a way out, including to the author's
 *     external profiles.
 *
 * All quiet, all centred. The point is that this is site-wide
 * infrastructure, not chrome.
 */

const CONTACT_EMAIL = 'husayn@husayngokal.com';
const GITHUB_URL    = 'https://github.com/husayngokal';
const LINKEDIN_URL  = 'https://linkedin.com/in/husayn-gokal';

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
      <p className={styles.elsewhere} aria-label="Elsewhere">
        <a
          href={GITHUB_URL}
          className={styles.markLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Husayn on GitHub (opens in a new tab)"
          title="GitHub"
        >
          <GitHubMark />
        </a>
        <a
          href={LINKEDIN_URL}
          className={styles.markLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Husayn on LinkedIn (opens in a new tab)"
          title="LinkedIn"
        >
          <LinkedInMark />
        </a>
      </p>
    </footer>
  );
}
