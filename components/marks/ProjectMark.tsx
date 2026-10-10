/*
 * Hand-line isometric frame — the "currently building" mark on the
 * homepage plates. Sibling of BookMark and CalendarMark (same ink line,
 * cream fill, rendered height, one orange detail). Here the orange is the
 * central beam, the load-bearing edge being raised.
 *
 * The viewBox is cropped tight to the drawing (geometry spans x 7..49,
 * y 7..55, plus a stroke margin) so the SVG box carries no dead space and
 * the mark lines up with its siblings by its visible edges.
 *
 * `size` is the rendered height in px; width follows the 44:50 box.
 */

const INK = '#111111';
const PAPER = '#F8F2E3';

export function ProjectMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size * (44 / 50)}
      height={size}
      viewBox="6 6 44 50"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M28 7 L49 18 L28 31 L7 19 Z" fill={PAPER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M7 19 L28 31 L28 55 L8 44 Z" fill={PAPER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M28 31 L49 18 L49 43 L28 55 Z" fill={PAPER} stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M28 31 L28 55" stroke="var(--accent)" strokeWidth="3.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
