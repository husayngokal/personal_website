/*
 * Mental Model marks — bespoke hand-line SVG marks per Part IX.
 *
 * The current six are diagrammatic rather than figurative. Diagrams are
 * the right register for the framework set — Eisenhower's matrix is
 * literally a matrix; a feedback loop is literally a loop. The marks
 * read at small index-card size (80×80) and at detail-page size (96+).
 *
 * Line language per Part II: ~1.6 px stroke #111, fills from the palette,
 * deliberately slight asymmetry to read as hand-drawn rather than CAD.
 * Orange used sparingly — on the load-bearing element of each mark only,
 * so the eye locks onto what the model is about.
 */

const STROKE = '#111111';
const CREAM  = '#F8F2E3';
const ORANGE = '#F26B1F';

export function ModelMark({ slug, size = 80 }: { slug: string; size?: number }) {
  const draw = MARKS[slug] ?? MARKS.__default;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {draw}
    </svg>
  );
}

const MARKS: Record<string, React.ReactNode> = {
  /* -- Eisenhower Matrix --------------------------------------------
     2×2 grid with the Q2 (important, not urgent) quadrant in orange —
     the leverage zone the model exists to push you toward. */
  'eisenhower-matrix': (
    <>
      {/* Faint axis indications outside the box */}
      <path d="M16 14 L16 70" stroke={STROKE} strokeWidth="1" opacity="0.35" />
      <path d="M10 64 L72 64" stroke={STROKE} strokeWidth="1" opacity="0.35" />
      {/* Outer matrix */}
      <rect x="20" y="14" width="48" height="48" fill="#FFFFFF" stroke={STROKE} strokeWidth="1.6" />
      {/* Q2 (top-left, important + not urgent) — orange leverage zone */}
      <rect x="20" y="14" width="24" height="24" fill={ORANGE} opacity="0.88" />
      {/* Quadrant dividers — slightly off-center for hand-drawn feel */}
      <path d="M44 14 L44 62" stroke={STROKE} strokeWidth="1.4" />
      <path d="M20 38 L68 38" stroke={STROKE} strokeWidth="1.4" />
    </>
  ),

  /* -- Iceberg Model ------------------------------------------------
     A small visible peak above the waterline, a much larger irregular
     mass below. Waterline drawn in orange dash to mark the boundary
     the model warns about. */
  'iceberg-model': (
    <>
      {/* Submerged mass — drawn first so the waterline cuts over it */}
      <path
        d="M16 40 L62 40 L58 56 L50 68 L36 73 L24 65 L18 52 Z"
        fill={CREAM}
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
        opacity="0.55"
      />
      {/* Visible peak */}
      <path
        d="M28 40 L40 10 L52 40 Z"
        fill={CREAM}
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Waterline */}
      <path d="M4 40 L76 40" stroke={ORANGE} strokeWidth="1.4" strokeDasharray="3,3" />
    </>
  ),

  /* -- Decision Matrix ----------------------------------------------
     Small scoring table. The winning cell per row is orange — surfacing
     the comparison the model exists to make. */
  'decision-matrix': (
    <>
      <rect x="14" y="18" width="52" height="44" fill="#FFFFFF" stroke={STROKE} strokeWidth="1.6" />
      {/* Column dividers */}
      <line x1="28" y1="18" x2="28" y2="62" stroke={STROKE} strokeWidth="1" />
      <line x1="42" y1="18" x2="42" y2="62" stroke={STROKE} strokeWidth="1" />
      <line x1="56" y1="18" x2="56" y2="62" stroke={STROKE} strokeWidth="1" />
      {/* Row dividers */}
      <line x1="14" y1="32" x2="66" y2="32" stroke={STROKE} strokeWidth="1" />
      <line x1="14" y1="47" x2="66" y2="47" stroke={STROKE} strokeWidth="1" />
      {/* Score dots — each row has one orange "winner" */}
      <circle cx="21" cy="25" r="2"   fill={STROKE} opacity="0.4" />
      <circle cx="35" cy="25" r="2"   fill={STROKE} opacity="0.4" />
      <circle cx="49" cy="25" r="2"   fill={STROKE} opacity="0.4" />
      <circle cx="61" cy="25" r="3"   fill={ORANGE} />
      <circle cx="21" cy="40" r="2"   fill={STROKE} opacity="0.4" />
      <circle cx="35" cy="40" r="3"   fill={ORANGE} />
      <circle cx="49" cy="40" r="2"   fill={STROKE} opacity="0.4" />
      <circle cx="61" cy="40" r="2"   fill={STROKE} opacity="0.4" />
      <circle cx="21" cy="55" r="2"   fill={STROKE} opacity="0.4" />
      <circle cx="35" cy="55" r="2"   fill={STROKE} opacity="0.4" />
      <circle cx="49" cy="55" r="3"   fill={ORANGE} />
      <circle cx="61" cy="55" r="2"   fill={STROKE} opacity="0.4" />
    </>
  ),

  /* -- Concept Map --------------------------------------------------
     Five nodes; the central one orange and slightly larger. Edges are
     thin black lines to suggest the labeled-relationship structure
     without text getting in the way at this size. */
  'concept-map': (
    <>
      {/* Edges */}
      <line x1="22" y1="22" x2="40" y2="40" stroke={STROKE} strokeWidth="1.2" />
      <line x1="58" y1="22" x2="40" y2="40" stroke={STROKE} strokeWidth="1.2" />
      <line x1="40" y1="40" x2="22" y2="58" stroke={STROKE} strokeWidth="1.2" />
      <line x1="40" y1="40" x2="58" y2="58" stroke={STROKE} strokeWidth="1.2" />
      <line x1="22" y1="22" x2="58" y2="22" stroke={STROKE} strokeWidth="1.2" opacity="0.35" />
      <line x1="22" y1="58" x2="58" y2="58" stroke={STROKE} strokeWidth="1.2" opacity="0.35" />
      {/* Nodes */}
      <circle cx="22" cy="22" r="6" fill={CREAM}  stroke={STROKE} strokeWidth="1.6" />
      <circle cx="58" cy="22" r="6" fill={CREAM}  stroke={STROKE} strokeWidth="1.6" />
      <circle cx="40" cy="40" r="8" fill={ORANGE} stroke={STROKE} strokeWidth="1.6" />
      <circle cx="22" cy="58" r="6" fill={CREAM}  stroke={STROKE} strokeWidth="1.6" />
      <circle cx="58" cy="58" r="6" fill={CREAM}  stroke={STROKE} strokeWidth="1.6" />
    </>
  ),

  /* -- First Principles ---------------------------------------------
     A compound shape at the top (dashed, faint) decomposing via orange
     arrows into three solid primitive blocks at the bottom. */
  'first-principles': (
    <>
      {/* Compound at top (dashed outline + light internal hint) */}
      <path
        d="M14 10 L66 10 L66 28 L14 28 Z"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.2"
        strokeDasharray="3,2"
      />
      <circle cx="24" cy="19" r="3" fill={STROKE} opacity="0.3" />
      <rect   x="34" y="16" width="10" height="6" fill={STROKE} opacity="0.3" />
      <circle cx="56" cy="19" r="3" fill={STROKE} opacity="0.3" />
      {/* Decomposition arrows */}
      <path d="M25 32 L25 40" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M40 32 L40 40" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M55 32 L55 40" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22 38 L25 41 L28 38" fill="none" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M37 38 L40 41 L43 38" fill="none" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M52 38 L55 41 L58 38" fill="none" stroke={ORANGE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {/* Three primitives at bottom */}
      <rect x="14" y="46" width="16" height="20" fill={CREAM} stroke={STROKE} strokeWidth="1.6" />
      <rect x="32" y="46" width="16" height="20" fill={CREAM} stroke={STROKE} strokeWidth="1.6" />
      <rect x="50" y="46" width="16" height="20" fill={CREAM} stroke={STROKE} strokeWidth="1.6" />
    </>
  ),

  /* -- Reinforcing Feedback Loop ------------------------------------
     A near-complete circle showing the loop direction, with an orange
     "+" in the centre marking the reinforcing (not balancing) nature.
     The arrowhead closes the loop. */
  'reinforcing-feedback-loop': (
    <>
      {/* Arc — most of a circle, small gap at the top for the arrowhead */}
      <path
        d="M44 12 A28 28 0 1 1 36 12"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Arrowhead at the start of the arc, pointing along the flow */}
      <path
        d="M40 6 L36 12 L42 14"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Orange + in the centre — reinforcing marker */}
      <line x1="31" y1="40" x2="49" y2="40" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="31" x2="40" y2="49" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" />
    </>
  ),

  __default: (
    <>
      <rect x="14" y="14" width="52" height="52" rx="2" fill={CREAM} stroke={STROKE} strokeWidth="1.6" />
      <circle cx="40" cy="40" r="6" fill={ORANGE} />
    </>
  ),
};
