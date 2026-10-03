/*
 * Hand-drawn "currently building" mark — the small bespoke icon to the left
 * of the projects / currently-building rail on the homepage (Part V, Rail 2),
 * so the rail carries a leading mark like reading (book cover) and studying
 * (calendar tile) already do.
 *
 * An isometric frame under construction, drawn in the established line
 * language: 1.6px ink #111, warm beige face fill #F8F2E3, deliberately
 * asymmetric, round joins. The one orange element is the central beam
 * (var(--accent)) — the load-bearing edge being raised — which echoes the
 * rail's own pulsing orange "active now" dot. Orange is the only colour that
 * moves on this site, and building is the active slot, so the accent belongs
 * here.
 */

const INK = '#111111';
const PAPER = '#F8F2E3';

export function ProjectMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * (64 / 56)}
      viewBox="0 0 56 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Top face (rhombus). Slight vertex jitter keeps it hand-drawn. */}
      <path
        d="M28 7 L49 18 L28 31 L7 19 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Front-left face. */}
      <path
        d="M7 19 L28 31 L28 55 L8 44 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Front-right face. */}
      <path
        d="M28 31 L49 18 L49 43 L28 55 Z"
        fill={PAPER}
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Construction hatch on the left face — faint, under-construction feel. */}
      <line x1="12" y1="26" x2="12" y2="40" stroke={INK} strokeWidth="0.9" opacity="0.35" />
      <line x1="18" y1="29" x2="18" y2="45" stroke={INK} strokeWidth="0.9" opacity="0.3" />
      {/* Central beam — the one orange edge, the load-bearing member being
          raised. Sits on top of the face strokes so it reads clean. */}
      <path
        d="M28 31 L28 55"
        stroke="var(--accent)"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
