/*
 * Book spine — a small CSS/SVG element rendered on the homepage
 * Currently-Reading rail. Dark spine on the left, lighter cover front,
 * subtle title-line indicators. Per Part V, Rail 1.
 *
 * Not a real cover image. The visual register stays book-like without
 * pretending to be a thumbnail of a specific book.
 */

export function BookSpine({
  width = 40,
  height = 56,
  spineColor = '#8B6A3B',
  coverColor = '#C9A87C',
}: {
  width?: number;
  height?: number;
  spineColor?: string;
  coverColor?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 40 56"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      {/* Spine — left edge */}
      <rect x="0" y="0" width="8" height="56" fill={spineColor} />
      {/* Cover front */}
      <rect x="8" y="0" width="32" height="56" fill={coverColor} />
      {/* Spine outline */}
      <rect
        x="0.6"
        y="0.6"
        width="38.8"
        height="54.8"
        fill="none"
        stroke="#111111"
        strokeWidth="1.2"
      />
      <line x1="8" y1="0" x2="8" y2="56" stroke="#111111" strokeWidth="1" />
      {/* Title indicator lines */}
      <line x1="14" y1="18" x2="34" y2="18" stroke="#111111" strokeWidth="0.9" opacity="0.7" />
      <line x1="14" y1="23" x2="30" y2="23" stroke="#111111" strokeWidth="0.9" opacity="0.5" />
      <line x1="14" y1="42" x2="26" y2="42" stroke="#111111" strokeWidth="0.7" opacity="0.5" />
    </svg>
  );
}
