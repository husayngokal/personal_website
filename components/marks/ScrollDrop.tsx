'use client';

/*
 * Scroll indicator — the word "Scroll" in mono-small with letter-spacing
 * in muted gray, a single 32px vertical muted-gray line, and a small
 * orange dot that animates down the line on a two-second loop. (Part V)
 *
 * The dot uses the same orange-dot motion vocabulary as the live tiles
 * and the navigation status — orange = something happens.
 */

import styles from './ScrollDrop.module.css';

export function ScrollDrop() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <span className={styles.label}>Scroll</span>
      <span className={styles.line}>
        <span className={styles.dot} />
      </span>
    </div>
  );
}
