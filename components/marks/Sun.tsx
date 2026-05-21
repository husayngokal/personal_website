/*
 * Sun mark — small hand-line celestial body, paired with Moon and
 * picked by StatusPulse based on the author's local hour. Inherits
 * currentColor so it tones with the surrounding nav text rather
 * than competing for attention.
 *
 * Hand-line aesthetic per Part II — slight imperfections in ray
 * lengths and stroke endings; no perfect symmetry. 16-unit viewBox
 * so the four cardinal + four diagonal rays sit on a clean grid.
 */

export function Sun({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      style={{ overflow: 'visible' }}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="2.7" />
        {/* Cardinal rays — slightly varied lengths for hand-line feel */}
        <line x1="8"   y1="1.6"  x2="8"   y2="3.6" />
        <line x1="8"   y1="12.6" x2="8"   y2="14.4" />
        <line x1="1.6" y1="8"    x2="3.6" y2="8" />
        <line x1="12.6" y1="8"   x2="14.4" y2="8" />
        {/* Diagonal rays */}
        <line x1="3.4" y1="3.4"  x2="4.7" y2="4.7" />
        <line x1="11.3" y1="11.3" x2="12.6" y2="12.6" />
        <line x1="12.6" y1="3.4" x2="11.3" y2="4.7" />
        <line x1="4.7" y1="11.3" x2="3.4" y2="12.6" />
      </g>
    </svg>
  );
}
