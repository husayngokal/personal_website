/*
 * In-process Spotify poller — runs inside the Next.js dev server.
 *
 * Started by instrumentation.ts at server boot. Polls every 30 seconds,
 * writes to current_state['currently_listening']. Realtime broadcasts
 * the change to subscribed clients with no further action needed.
 *
 * In dev: starts automatically with `npm run dev`. No second terminal.
 * In production: SKIPPED — Vercel serverless functions are short-lived,
 * so a setInterval inside one is wasted. Production uses Vercel Cron
 * (vercel.json), which hits /api/spotify/poll on a schedule.
 */

import { getCurrentlyPlaying } from './spotify';
import { getServerAdminClient } from './supabase';

const POLL_INTERVAL_MS = 30_000;

let started = false;

export function startSpotifyPoller() {
  if (started) return;
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_REFRESH_TOKEN) {
    console.log('[spotify-poller] credentials missing, not starting');
    return;
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    console.log('[spotify-poller] supabase not configured, not starting');
    return;
  }
  started = true;

  const db = getServerAdminClient();

  const tick = async () => {
    try {
      const np = await getCurrentlyPlaying();
      const value = np && np.playing && np.track
        ? {
            artist: np.artist, track: np.track, album: np.album,
            startedAt: np.startedAt, durationMs: np.durationMs,
            progressMs: np.progressMs,
            sampledAtMs: Date.now(),     // client uses this to compute live elapsed
            trackUrl: np.trackUrl,
          }
        : {};
      const { error } = await db
        .from('current_state')
        .upsert(
          { key: 'currently_listening', value, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) console.error('[spotify-poller]', error.message);
    } catch (err) {
      console.error('[spotify-poller]', (err as Error).message);
    }
  };

  console.log(`[spotify-poller] started — polling every ${POLL_INTERVAL_MS / 1000}s`);
  void tick();                              // immediate first tick
  setInterval(tick, POLL_INTERVAL_MS);
}
