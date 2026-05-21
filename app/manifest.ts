import type { MetadataRoute } from 'next';

/*
 * Web app manifest — controls how the site identifies itself when
 * pinned to a phone home screen, bookmarked, or opened as a PWA.
 *
 * Conservative posture: this is not a PWA in the offline-installable
 * sense. The manifest exists so that the bookmark renders with the
 * right name + icon + theme colour rather than the browser default.
 *
 * `theme_color` matches `--bg-page` (the paper beige) so the iOS
 * status bar tints to the editorial palette. `background_color`
 * matches so the splash screen does the same.
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'husayn gokal.',
    short_name: 'husayn gokal.',
    description:
      'The public notebook of Husayn Gokal. Building software, breaking systems, reading, writing, and studying across eight domains, shown as the work moves, not after.',
    start_url: '/',
    display: 'standalone',
    background_color: '#EFE7D7',
    theme_color: '#EFE7D7',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { src: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      { src: '/apple-touch-icon.png', type: 'image/png', sizes: '180x180' },
    ],
  };
}
