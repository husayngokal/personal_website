/*
 * Hand-line book — the "currently reading" mark on the homepage plates.
 *
 * One of three plate marks (BookMark, ProjectMark, CalendarMark) drawn as
 * a family: the same ink line, the same cream fill, the same rendered
 * height, and exactly one orange detail each. Here the orange is the
 * ribbon bookmark hanging from the top edge.
 *
 * The viewBox is cropped tight to the drawing so the SVG box has no dead
 * space: the plate pins each mark to its top-right corner, and the three
 * only line up if their boxes end where their ink ends.
 *
 * `size` is the rendered height in px; width follows the 30:37 box. The
 * stroke is authored to land at roughly 1.3px, matching its siblings.
 */

const INK = '#111111';
const PAPER = '#F8F2E3';

export function BookMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size * (30 / 37)}
      height={size}
      viewBox="7.5 3.5 30 37"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="9" y="5" width="27" height="34" rx="1.5" fill={PAPER} stroke={INK} strokeWidth="1.8" />
      <line x1="15" y1="5" x2="15" y2="39" stroke={INK} strokeWidth="1.4" />
      <line x1="20" y1="26" x2="31" y2="26" stroke={INK} strokeWidth="1.1" opacity="0.5" />
      <line x1="20" y1="31" x2="27" y2="31" stroke={INK} strokeWidth="1.1" opacity="0.4" />
      <path d="M25 5 V18 L28.5 14.5 L32 18 V5 Z" fill="var(--accent)" />
    </svg>
  );
}
