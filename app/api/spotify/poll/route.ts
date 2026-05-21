import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getCurrentlyPlaying } from '@/lib/spotify';
import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';

/*
 * Spotify polling endpoint.
 *
 * Probes Spotify for the currently-playing track and upserts the result
 * into public.current_state['currently_listening']. Realtime broadcasts
 * the change to subscribed clients (the homepage), which flash and
 * re-render.
 *
 * Auth: requires `Authorization: Bearer ${SPOTIFY_POLL_TOKEN}`. Caller
 * is the Cloudflare Worker on a 1-minute cron (GitHub Actions free tier
 * was firing once an hour at best — see cloudflare-workers/spotify-poll/).
 * The GitHub Actions workflow still exists as a redundancy, passing the
 * same token.
 *
 * The endpoint is idempotent and safe to call frequently. If nothing is
 * playing, the listening row is cleared (set to '{}'::jsonb).
 */

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { ok: false, reason: 'supabase-not-configured' },
        { status: 503 },
      );
    }

    const np = await getCurrentlyPlaying();

    const value =
      np && np.playing && np.track
        ? {
            artist: np.artist,
            track: np.track,
            album: np.album,
            startedAt: np.startedAt,
            durationMs: np.durationMs,
            progressMs: np.progressMs,
            sampledAtMs: Date.now(),     // client uses this to compute live elapsed
            trackUrl: np.trackUrl,
          }
        : {};

    const db = getServerAdminClient();
    const { error } = await db
      .from('current_state')
      .upsert(
        { key: 'currently_listening', value, updated_at: new Date().toISOString() },
        { onConflict: 'key' },
      );
    if (error) {
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, playing: Boolean(np?.playing), value });
  } catch (err) {
    return NextResponse.json({ ok: false, reason: (err as Error).message }, { status: 502 });
  }
}

/* Allow POST too — CFW Worker fetches with POST by default; GitHub
   Actions uses POST as well. Same behaviour either way. */
export const POST = GET;

function checkAuth(req: NextRequest): boolean {
  const expected = process.env.SPOTIFY_POLL_TOKEN;
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const provided = header.slice(7);
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}
