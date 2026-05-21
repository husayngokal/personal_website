/*
 * Component vocabulary — Part III of BRIEF.md.
 *
 * Every surface assembles from these primitives. No surface introduces
 * new component types; all variation happens in composition. The
 * discipline of working only within this vocabulary is what makes the
 * site read as coherent across its six bespoke surfaces.
 */

import Link from 'next/link';
import styles from './Primitives.module.css';

/* -- Eyebrow ----------------------------------------------------------
 * Small mono label, sentence case with letter-spacing, often prefixed
 * by an orange numeric ("01 ·"). Section markers without competing.
 */
export function Eyebrow({
  number,
  children,
}: {
  number?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={styles.eyebrow}>
      {number && <span className={styles.eyebrowNumber}>{number}</span>}
      {number && <span className={styles.eyebrowSep}> · </span>}
      <span>{children}</span>
    </p>
  );
}

/* -- Chip -------------------------------------------------------------
 * Monospace label in a small cream box with thin border.
 */
export function Chip({
  children,
  href,
  tone = 'default',
}: {
  children: React.ReactNode;
  href?: string;
  tone?: 'default' | 'accent';
}) {
  const cls = `${styles.chip} ${tone === 'accent' ? styles.chipAccent : ''}`;
  if (href) {
    return <Link href={href} className={cls}>{children}</Link>;
  }
  return <span className={cls}>{children}</span>;
}

/* -- Status pill ------------------------------------------------------
 * Colored dot + label. Orange = active, gray = inactive, pulsing = live.
 */
export type StatusKind =
  | 'active'
  | 'paused'
  | 'dormant'
  | 'concluded'
  | 'shipped'
  | 'dead'
  | 'live'
  | 'planned'
  | 'reading'
  | 'finished'
  | 'abandoned'
  | 're-reading'
  | 'wishlist'
  | 'dabbled'
  | 'learning'
  | 'working-in'
  | 'teaching-from'
  | 'decayed'
  /* Writeup statuses + difficulty (BRIEF Part XVII — /writeups surface) */
  | 'rooted'
  | 'foothold'
  | 'attempted'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'insane';

const STATUS_DOT_KIND: Record<StatusKind, 'active' | 'live' | 'inactive'> = {
  active: 'active',
  paused: 'inactive',
  dormant: 'inactive',
  concluded: 'inactive',
  shipped: 'active',
  dead: 'inactive',
  live: 'live',
  planned: 'inactive',
  reading: 'active',
  finished: 'inactive',
  abandoned: 'inactive',
  're-reading': 'active',
  wishlist: 'inactive',
  dabbled: 'inactive',
  learning: 'active',
  'working-in': 'active',
  'teaching-from': 'active',
  decayed: 'inactive',
  /* Writeups: rooted/foothold are wins; attempted is in-flight */
  rooted: 'active',
  foothold: 'live',
  attempted: 'inactive',
  /* Difficulty pills are passive descriptors — use the neutral dot */
  easy: 'inactive',
  medium: 'inactive',
  hard: 'inactive',
  insane: 'inactive',
};

export function StatusPill({
  status,
  label,
}: {
  status: StatusKind;
  label?: string;
}) {
  const kind = STATUS_DOT_KIND[status];
  return (
    <span className={styles.pill}>
      <span
        className={`${styles.pillDot} ${
          kind === 'active' ? styles.pillDotActive :
          kind === 'live'   ? styles.pillDotLive   :
                              styles.pillDotInactive
        }`}
        aria-hidden="true"
      />
      <span>{label ?? status}</span>
    </span>
  );
}

/* -- Card -------------------------------------------------------------
 * Raised cream surface, no border, 4px radius. Padding 24 or 32.
 */
export function Card({
  children,
  padding = 24,
  className = '',
}: {
  children: React.ReactNode;
  padding?: 24 | 32;
  className?: string;
}) {
  return (
    <div
      className={`${styles.card} ${className}`}
      style={{ padding: `${padding}px` }}
    >
      {children}
    </div>
  );
}

/* -- Manifesto callout ------------------------------------------------
 * The most visually weighted component. Cream raised, orange left border,
 * italic serif body. Used sparingly — never more than one or two per page.
 */
export function ManifestoCallout({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={styles.manifesto}>
      {label && <p className={styles.manifestoLabel}>{label}</p>}
      <div className={styles.manifestoBody}>{children}</div>
    </aside>
  );
}

/* -- Pull quote -------------------------------------------------------
 * Italic serif passage, breaks measure to 90%, orange one-pixel rules.
 * No quotation marks — typography carries the gesture.
 */
export function PullQuote({ children }: { children: React.ReactNode }) {
  return <blockquote className={styles.pullQuote}>{children}</blockquote>;
}

/* -- Sidenote ---------------------------------------------------------
 * Margin annotation in the right gutter with numbered reference.
 * Used inline within prose; renders both the inline superscript and the
 * floated gutter note in one element to keep authoring simple.
 */
export function Sidenote({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <sup className={styles.sidenoteRef}>{n}</sup>
      <span className={styles.sidenote} aria-label={`Sidenote ${n}`}>
        <span className={styles.sidenoteN}>{n}</span>
        {children}
      </span>
    </>
  );
}

/* -- Decision log entry ----------------------------------------------- */
export function DecisionLogEntry({
  date,
  title,
  children,
}: {
  date: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className={styles.decision}>
      <p className={styles.decisionDate}>{date}</p>
      <h3 className={styles.decisionTitle}>{title}</h3>
      <div className={styles.decisionBody}>{children}</div>
    </article>
  );
}

/* -- Timeline entry ---------------------------------------------------
 * Date on left in fixed-width mono column, content in serif on right.
 */
export function TimelineEntry({
  date,
  title,
  reflection,
}: {
  date: string;
  title: string;
  reflection?: React.ReactNode;
}) {
  return (
    <article className={styles.timeline}>
      <div className={styles.timelineDate}>{date}</div>
      <div className={styles.timelineContent}>
        <p className={styles.timelineTitle}>{title}</p>
        {reflection && <div className={styles.timelineReflection}>{reflection}</div>}
      </div>
    </article>
  );
}

/* -- Progress bar -----------------------------------------------------
 * Thin 3px orange fill on a divider-beige track. Animates from 0 to its
 * value on first paint (1.2s ease-out) when 'animate' is set.
 */
export function ProgressBar({
  pct,
  showLabel = true,
  width = '100%',
  animate = false,
}: {
  pct: number;
  showLabel?: boolean;
  width?: string;
  animate?: boolean;
}) {
  const safe = Math.max(0, Math.min(100, pct));
  /* Rendered with spans (not divs) so the component is safe inside a
     <p>. The CSS module uses display:inline-flex / inline-block to
     reproduce the block-like geometry without violating phrasing content. */
  return (
    <span className={styles.progressRow}>
      <span className={styles.progressTrack} style={{ width }}>
        <span
          className={`${styles.progressFill} ${animate ? styles.progressFillAnimate : ''}`}
          style={{ width: `${safe}%` }}
          role="progressbar"
          aria-valuenow={safe}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </span>
      {showLabel && <span className={styles.progressLabel}>{safe}%</span>}
    </span>
  );
}

/* -- Cross-link strip -------------------------------------------------
 * Connective tissue between surfaces. Small linked items with thumbnails.
 */
export function CrossLinkStrip({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string; sub?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.strip}>
      <p className={styles.stripTitle}>{title}</p>
      <ul className={styles.stripList}>
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} className={styles.stripItem}>
              <span className={styles.stripItemLabel}>{it.label}</span>
              {it.sub && <span className={styles.stripItemSub}>{it.sub}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -- Section rule -----------------------------------------------------
 * Thin one-pixel divider-beige rule with generous breathing room.
 */
export function SectionRule() {
  return <hr className={styles.sectionRule} aria-hidden="true" />;
}

/* -- Skip link --------------------------------------------------------
 * Hidden until keyboard-focused. Accessibility first.
 */
export function SkipLinkStyles() { return null; /* applied via globals */ }
