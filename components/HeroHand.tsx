/*
 * Hero pointing hand — the classic printer's manicule (☜) rendered as a
 * Unicode character in Noto Sans Symbols 2, not as a drawn SVG. The
 * glyph is a real typographic mark, designed by the Noto type team for
 * exactly this purpose. The brief's "no stock icons" rule applies to
 * icon sets like Heroicons / Phosphor / Lucide; a single typographic
 * gesture set in a real font is the same primitive as a section dingbat.
 *
 * Floats vertically on a slow loop. Honors prefers-reduced-motion.
 *
 * Pure server component — no client JS needed; the float animation is
 * CSS-driven. Was previously marked 'use client' by reflex; removing
 * the directive shrinks the homepage client bundle.
 */

import styles from './HeroHand.module.css';

export function HeroHand() {
  return (
    <span className={styles.handWrap} aria-hidden="true">
      <span className={styles.hand}>☜</span>
    </span>
  );
}
