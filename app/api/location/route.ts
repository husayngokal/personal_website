import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { timingSafeEqual } from 'node:crypto';
import { getServerAdminClient } from '@/lib/supabase';

/*
 * Update author's current location — Bearer-auth'd.
 *
 * Designed for an iOS Shortcut that fires on a significant location
 * change. Payload example (cURL-ready):
 *
 *   curl -X POST https://husayngokal.com/api/location \
 *     -H "Authorization: Bearer $LOCATION_AUTH_TOKEN" \
 *     -H "Content-Type: application/json" \
 *     -d '{"city":"London","country":"United Kingdom","timezone":"Europe/London"}'
 *
 * city + timezone are required; country is optional. Writes one row
 * to current_state(key='current_location'); the homepage status
 * pulse refreshes via Realtime within a second.
 *
 * No public read here — the location is read by the SSR root layout
 * via lib/content/location and surfaced through the nav.
 */

export const dynamic = 'force-dynamic';

interface LocationBody {
  city?: string;
  country?: string;
  timezone?: string;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }
  let body: LocationBody;
  try {
    body = (await req.json()) as LocationBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'malformed-body' }, { status: 400 });
  }
  const city = body.city?.trim();
  const timezone = body.timezone?.trim();
  const country = body.country?.trim() || undefined;
  if (!city)     return NextResponse.json({ ok: false, error: 'missing-city' }, { status: 400 });
  if (!timezone) return NextResponse.json({ ok: false, error: 'missing-timezone' }, { status: 400 });
  /* Validate the IANA timezone — Intl.DateTimeFormat throws on garbage. */
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-timezone' }, { status: 400 });
  }

  const db = getServerAdminClient();
  const { error } = await db
    .from('current_state')
    .upsert({
      key: 'current_location',
      value: { city, country, timezone },
    }, { onConflict: 'key' });
  if (error) {
    return NextResponse.json({ ok: false, error: 'db-write-failed', reason: error.message }, { status: 500 });
  }
  /* The root layout server-renders the city via getCurrentLocation(),
     and there's no Realtime subscriber for current_location (unlike the
     typewriter keys). Without an explicit revalidate, the cached HTML
     keeps showing whatever city was current at build / last-revalidate
     time. 'layout' scope invalidates every page that uses the root
     layout, which is every page. */
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, location: { city, country, timezone } });
}

function checkAuth(req: NextRequest): boolean {
  const expected = process.env.LOCATION_AUTH_TOKEN;
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
