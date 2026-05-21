import Link from 'next/link';
import styles from './Logo.module.css';

/*
 * Wordmark — "husayn gokal." set in serif lowercase with tight tracking
 * and an orange period at the end. Rendered in real type (not a vector
 * file) per Part II — the typeface is part of the brand language and
 * the period is a real period rendered in the accent color via CSS.
 *
 * Locked: not redesigned, not animated, not seasonally varied, not used
 * in alternate colorways, not abbreviated to an icon mark. One rendering,
 * in one place, repeated.
 */

export function Logo({ size = 18 }: { size?: number }) {
  return (
    <Link href="/" className={styles.logo} style={{ fontSize: size }} aria-label="husayn gokal — home">
      <span className={styles.wordmark}>husayn gokal</span>
      <span className={styles.dot} aria-hidden="true">.</span>
    </Link>
  );
}
