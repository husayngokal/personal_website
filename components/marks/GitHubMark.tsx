/*
 * GitHub mark — a stripped-back Octocat in the site's hand-line
 * register: cat-head silhouette, two ear tufts, eye dots, a single
 * tentacle curl below. Reads as the GitHub glyph without copying the
 * brand mark wholesale, and stays in the stroke-only visual family
 * of the other marks.
 *
 * Uses `currentColor` so the link can tint it orange on hover.
 */

export function GitHubMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      fill="none"
    >
      {/* Head — slight oval so the mark sits closer to a real cat head
         than a perfect circle. Hand-drawn feel via the asymmetric ears. */}
      <ellipse
        cx="16"
        cy="14"
        rx="9"
        ry="8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* Left ear tuft */}
      <path
        d="M9 7.5 L10.5 4 L13 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right ear tuft (slightly different angle for the asymmetric feel) */}
      <path
        d="M19 8 L21.5 4 L23 7.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Eye dots */}
      <circle cx="12.5" cy="14" r="1" fill="currentColor" />
      <circle cx="19.5" cy="14" r="1" fill="currentColor" />
      {/* Tentacle curl trailing below — the Octocat signature */}
      <path
        d="M16 22 Q14 25 16.5 26.5 Q19 28 17 30"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
