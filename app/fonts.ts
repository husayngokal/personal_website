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

import {
  Source_Serif_4,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Noto_Sans_Symbols_2,
} from 'next/font/google';

export const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-source-serif',
});

export const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-plex-sans',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});

/*
 * Noto Sans Symbols 2 — Google's typography-grade symbol font that
 * renders the classic printer's manicule (☜ U+261C WHITE LEFT POINTING
 * INDEX) as a real serif-adjacent glyph rather than as a colour emoji.
 *
 * Used only for the hero pointing-hand and any future typographic
 * gesture marks. Not for body text.
 */
export const notoSymbols = Noto_Sans_Symbols_2({
  subsets: ['symbols'],
  weight: '400',
  display: 'swap',
  variable: '--font-symbols',
});
