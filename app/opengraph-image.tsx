import { ImageResponse } from 'next/og';

/*
 * Root OG image — what social cards (Twitter, LinkedIn, iMessage,
 * Slack, …) show when a link to husayngokal.com is shared.
 *
 * Concept: the polymathy-as-solar-system metaphor. The wordmark
 * sits centre-frame as the sun; concentric tilted orbits trace out
 * the surfaces; orange atoms ride those orbits at different radii;
 * the bespoke sun + moon marks hang on two of the orbits.
 *
 * Grey orbits + orange atoms = the "orange is the only colour that
 * moves" rule honoured (the orange is the only colour in the image
 * apart from page beige + ink).
 *
 * Rendered at request time by Vercel's Edge runtime via Satori.
 * Satori's SVG support is limited to single root-level elements, so
 * the orbital art is composed as a self-contained SVG string and
 * embedded via an <img src="data:image/svg+xml;..."> behind the
 * wordmark layer.
 */

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'husayn gokal. A personal encyclopedia and atlas at editorial design grade.';

// Brand palette — keep in sync with app/globals.css.
const PAGE   = '#EFE7D7';
const BORDER = '#DDD2BD';
const INK    = '#111111';
const MUTED  = '#888888';
const ACCENT = '#F26B1F';

function solarSystemSVG(): string {
  // Five tilted concentric orbits, eight orange atoms scattered
  // around them, plus a sun mark and a moon mark riding the outer
  // rings. All inline so Satori renders the whole composition as a
  // single image asset.
  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${PAGE}"/>

  <g fill="none" stroke="${BORDER}" stroke-width="1.4">
    <ellipse cx="600" cy="315" rx="560" ry="240" transform="rotate(-6 600 315)"/>
    <ellipse cx="600" cy="315" rx="460" ry="200" transform="rotate(4 600 315)"/>
    <ellipse cx="600" cy="315" rx="360" ry="160" transform="rotate(-3 600 315)"/>
    <ellipse cx="600" cy="315" rx="260" ry="120" transform="rotate(6 600 315)"/>
    <ellipse cx="600" cy="315" rx="170" ry="80"  transform="rotate(-4 600 315)"/>
  </g>

  <g fill="${ACCENT}">
    <circle cx="50"   cy="330" r="16"/>
    <circle cx="1150" cy="290" r="12"/>
    <circle cx="170"  cy="110" r="9"/>
    <circle cx="1040" cy="520" r="11"/>
    <circle cx="870"  cy="120" r="7"/>
    <circle cx="310"  cy="520" r="8"/>
    <circle cx="780"  cy="490" r="6"/>
    <circle cx="460"  cy="90"  r="5"/>
  </g>

  <!-- Sun mark riding the upper-right of orbit 3 -->
  <g transform="translate(950 170)" stroke="${MUTED}" stroke-width="1.6"
     stroke-linecap="round" fill="none">
    <circle cx="0" cy="0" r="13"/>
    <line x1="0"   y1="-24" x2="0"   y2="-18"/>
    <line x1="0"   y1="18"  x2="0"   y2="24"/>
    <line x1="-24" y1="0"   x2="-18" y2="0"/>
    <line x1="18"  y1="0"   x2="24"  y2="0"/>
    <line x1="-17" y1="-17" x2="-13" y2="-13"/>
    <line x1="13"  y1="13"  x2="17"  y2="17"/>
    <line x1="17"  y1="-17" x2="13"  y2="-13"/>
    <line x1="-13" y1="13"  x2="-17" y2="17"/>
  </g>

  <!-- Moon mark riding the lower-left of orbit 3. Filled crescent
       (rather than stroke-only) so it reads as a moon shape at the
       OG card's display size — outlined crescents collapse into
       overlapping arcs when small. Cusps at (12, ±13.4) are the
       exact intersection points of the outer (R=18) and inner
       (r=14, offset +8 on x) circles, so the path closes cleanly.
       Slight rotation tilts the crescent for a more natural look. -->
  <g transform="translate(240 460) rotate(-18)">
    <path d="M 12 -13.4 A 18 18 0 1 0 12 13.4 A 14 14 0 1 1 12 -13.4 Z"
          fill="${MUTED}"/>
  </g>
</svg>`.trim();
}

export default async function Image() {
  // Source Serif 4 Bold — fetched directly from Adobe's open-source
  // font release on GitHub. TTF rather than woff2 because Satori
  // doesn't decompress woff2.
  const serif = await fetch(
    'https://github.com/adobe-fonts/source-serif/raw/release/TTF/SourceSerif4-Bold.ttf',
  ).then((r) => {
    if (!r.ok) throw new Error(`font fetch failed: ${r.status}`);
    return r.arrayBuffer();
  });

  // Encode the SVG art as a base64 data URI so Satori treats it as
  // an opaque image asset (its inline SVG renderer can't compose
  // nested groups + transforms beyond very simple cases).
  const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(solarSystemSVG()).toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: PAGE,
        }}
      >
        {/* Background art layer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={svgDataUri}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />

        {/* Wordmark + tagline, centred on top */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 28,
          }}
        >
          <div
            style={{
              fontFamily: 'Source Serif 4',
              fontWeight: 700,
              fontSize: 104,
              lineHeight: 1,
              color: INK,
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            husayn&nbsp;gokal<span style={{ color: ACCENT }}>.</span>
          </div>
          <div
            style={{
              fontFamily: 'Source Serif 4',
              fontSize: 28,
              color: MUTED,
              maxWidth: 800,
              textAlign: 'center',
              lineHeight: 1.4,
              display: 'flex',
              fontStyle: 'italic',
            }}
          >
            Editorial in form, in-progress in substance.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Source Serif 4', data: serif, style: 'normal', weight: 700 },
      ],
    },
  );
}
