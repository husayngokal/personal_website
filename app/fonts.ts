/*
 * Type stack — free implementation per BRIEF.md Part II.
 *
 * Source Serif 4 (body, display, italic commentary).
 * IBM Plex Sans (UI labels, nav, status).
 * IBM Plex Mono (metadata, code, eyebrow numerals, branch chips).
 *
 * The paid upgrade path — Tiempos Text / Inter / Berkeley Mono — slots in
 * without redesign: only the CSS variable bindings in globals.css change
 * (see "the paid-upgrade trigger" callout in BRIEF.md).
 */

/*
 * The files live in /fonts and are served from the site itself: the same
 * Latin subsets Google Fonts serves, kept in the repo since 17 Nov 2026,
 * when Google started answering the build machines in a form next/font/google
 * could not read and every deploy failed. A build no longer depends on
 * Google. All four families are under the SIL Open Font License (fonts/OFL).
 */
import localFont from 'next/font/local';

export const sourceSerif = localFont({
  src: [
    { path: '../fonts/source-serif-4-normal-400-600.woff2', weight: '400 600', style: 'normal' },
    { path: '../fonts/source-serif-4-italic-400-600.woff2', weight: '400 600', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-source-serif',
  adjustFontFallback: 'Times New Roman',
});

export const plexSans = localFont({
  src: [
    { path: '../fonts/ibm-plex-sans-normal-400-600.woff2', weight: '400 600', style: 'normal' },
    { path: '../fonts/ibm-plex-sans-italic-400-600.woff2', weight: '400 600', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-plex-sans',
});

export const plexMono = localFont({
  src: [
    { path: '../fonts/ibm-plex-mono-normal-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/ibm-plex-mono-normal-500.woff2', weight: '500', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-plex-mono',
  adjustFontFallback: false,
});

/*
 * Noto Sans Symbols 2 — Google's typography-grade symbol font that
 * renders the classic printer's manicule (☜ U+261C WHITE LEFT POINTING
 * INDEX) as a real serif-adjacent glyph rather than as a colour emoji.
 *
 * Used only for the hero pointing-hand and any future typographic
 * gesture marks. Not for body text. Not preloaded: the file is large and
 * only the hand needs it.
 */
export const notoSymbols = localFont({
  src: '../fonts/noto-sans-symbols-2-normal-400.woff2',
  weight: '400',
  display: 'swap',
  variable: '--font-symbols',
  preload: false,
  adjustFontFallback: false,
});
