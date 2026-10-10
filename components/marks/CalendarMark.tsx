/*
 * Hand-line calendar page — the "currently studying" mark on the homepage
 * plates. Sibling of BookMark and ProjectMark (same ink line, cream fill,
 * rendered height, one orange detail). Here the orange is the rule under
 * the binder header.
 *
 * The viewBox is cropped tight to the drawing (see BookMark for why).
 * `size` is the rendered height in px; width follows the 35:38 box.
 */

const INK = '#111111';
const PAPER = '#F8F2E3';

export function CalendarMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size * (35 / 38)}
      height={size}
      viewBox="4.5 2.5 35 38"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="6" y="8" width="32" height="31" rx="2" fill={PAPER} stroke={INK} strokeWidth="1.85" />
      <line x1="7" y1="18" x2="37" y2="18" stroke="var(--accent)" strokeWidth="2.6" />
      <line x1="14" y1="4" x2="14" y2="11" stroke={INK} strokeWidth="1.85" strokeLinecap="round" />
      <line x1="30" y1="4" x2="30" y2="11" stroke={INK} strokeWidth="1.85" strokeLinecap="round" />
      <line x1="13" y1="25" x2="31" y2="25" stroke={INK} strokeWidth="1.1" opacity="0.45" />
      <line x1="13" y1="31" x2="25" y2="31" stroke={INK} strokeWidth="1.1" opacity="0.35" />
    </svg>
  );
}
