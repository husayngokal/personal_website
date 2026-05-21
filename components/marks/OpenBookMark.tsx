/*
 * Hand-drawn open book — the small bespoke icon to the left of the
 * Library year-plan progress bar (Part VII). Drawn in the established
 * line language: 1.6px stroke #111, warm beige page fill, deliberately
 * asymmetric.
 */

export function OpenBookMark({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.75}
      viewBox="0 0 64 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Spine V */}
      <path
        d="M32 10 L32 44"
        stroke="#111111"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      {/* Left page */}
      <path
        d="M32 10 Q22 6 8 8 Q4 8 4 12 L4 40 Q4 44 8 44 Q22 42 32 44"
        fill="#F8F2E3"
        stroke="#111111"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Right page (slightly asymmetric for hand-drawn feel) */}
      <path
        d="M32 10 Q42 6 58 8 Q62 8 62 12 L62 40 Q62 44 58 44 Q42 42 32 44"
        fill="#F8F2E3"
        stroke="#111111"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Page lines */}
      <line x1="10" y1="18" x2="28" y2="18" stroke="#111111" strokeWidth="0.9" opacity="0.55" />
      <line x1="10" y1="24" x2="26" y2="24" stroke="#111111" strokeWidth="0.9" opacity="0.4" />
      <line x1="10" y1="30" x2="28" y2="30" stroke="#111111" strokeWidth="0.9" opacity="0.45" />
      <line x1="36" y1="18" x2="54" y2="18" stroke="#111111" strokeWidth="0.9" opacity="0.55" />
      <line x1="36" y1="24" x2="56" y2="24" stroke="#111111" strokeWidth="0.9" opacity="0.4" />
      <line x1="36" y1="30" x2="52" y2="30" stroke="#111111" strokeWidth="0.9" opacity="0.45" />
    </svg>
  );
}
