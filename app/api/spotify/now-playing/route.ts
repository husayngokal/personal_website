import { NextResponse } from 'next/server';
import { getCurrentlyPlaying } from '@/lib/spotify';

/*
 * Currently-playing probe.
 *
 * Reads the live "what is the author listening to right now?" signal
 * from Spotify. Used by:
 *   - The polling job that writes to current_state (once Realtime is wired)
 *   - Diagnostic checks during setup
 *
 * Returns null when nothing is playing or when credentials are missing,
 * with a status flag for consumers. Cached for 0s so each request is fresh.
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = await getCurrentlyPlaying();
    if (!now) {
      return NextResponse.json(
        { ok: false, reason: 'spotify-not-configured' },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, now }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: (err as Error).message },
      { status: 502 },
    );
  }
}
