/*
 * Local dev convenience — polls Spotify every 30 seconds and writes
 * to current_state. Run alongside `npm run dev`:
 *
 *   npm run spotify:poll
 *
 * Stops on Ctrl-C. In production this lives as a Vercel Cron Job hitting
 * /api/spotify/poll on a 1-minute schedule (Vercel free tier limit).
 */

import { getCurrentlyPlaying } from '../lib/spotify';
import { getServerAdminClient } from '../lib/supabase';

const POLL_INTERVAL_MS = 30_000;

const db = getServerAdminClient();

async function pollOnce() {
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
    if (error) throw error;
    const stamp = new Date().toISOString().slice(11, 19);
    if (np?.playing && np.track) {
      console.log(`[${stamp}] ♪ ${np.artist} — ${np.track}`);
    } else {
      console.log(`[${stamp}] (nothing playing)`);
    }
  } catch (err) {
    console.error('poll error:', (err as Error).message);
  }
}

console.log(`Polling Spotify every ${POLL_INTERVAL_MS / 1000}s. Ctrl-C to stop.\n`);
void pollOnce();
setInterval(pollOnce, POLL_INTERVAL_MS);
