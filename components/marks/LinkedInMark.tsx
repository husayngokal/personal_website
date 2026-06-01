/*
 * LinkedIn mark — hand-line interpretation of LinkedIn's "in" badge,
 * drawn in the same stroke-only language as ModelMark / OpenBookMark /
 * CalendarTile. Recognizable as the LinkedIn glyph at a glance, but
 * in the site's monochrome visual register rather than the brand blue.
 *
 * Uses `currentColor` so the surrounding link controls hue: muted in
 * rest, orange on hover (per Part V's "orange is the only colour that
 * moves" rule).
 */

export function LinkedInMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      fill="none"
    >
      {/* Rounded-square frame */}
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* lowercase 'i' — dot + stem */}
      <circle cx="10" cy="11" r="1.2" fill="currentColor" />
      <line
        x1="10"
        y1="14.5"
        x2="10"
        y2="23"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* lowercase 'n' — left stem */}
      <line
        x1="16"
        y1="23"
        x2="16"
        y2="14.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* lowercase 'n' — arch into right stem */}
      <path
        d="M16 16.5 Q19 14 22 16.5 L22 23"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
