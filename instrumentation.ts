/*
 * Next.js instrumentation hook — runs once when the server starts.
 *
 * Used to kick off in-process background jobs (the Spotify poller in
 * dev). The hook only fires under the Node runtime; Edge functions are
 * skipped because they can't host long-running setIntervals anyway.
 *
 * Production: skips the in-process poller. Vercel's serverless runtime
 * starts a fresh function per request and tears down between, so an
 * in-process setInterval makes no sense. Production polling is done by
 * Vercel Cron hitting /api/spotify/poll on schedule (see vercel.json).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'development') return;

  const { startSpotifyPoller } = await import('./lib/spotify-poller');
  startSpotifyPoller();
}
