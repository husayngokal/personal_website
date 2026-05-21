/*
 * Moon mark — small hand-line crescent, paired with Sun and picked
 * by StatusPulse based on the author's local hour. Inherits
 * currentColor so it tones with surrounding nav text.
 *
 * The crescent is drawn as a single path: large arc for the outer
 * edge, slightly smaller arc for the inner edge, joined at top and
 * bottom. Faces away from the city label (opening on the right)
 * to feel like a waxing moon — visual default in the Northern
 * hemisphere reading order.
 */

export function Moon({ size = 14 }: { size?: number }) {
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
      <path
        d="M 11.4 2.6 A 6.2 6.2 0 1 0 11.4 13.4 A 4.9 4.9 0 1 1 11.4 2.6 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
