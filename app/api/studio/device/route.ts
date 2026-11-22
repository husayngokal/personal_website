/*
 * Studio sign-in for a device with no browser (the watch app): GitHub's
 * device flow, run through the server so the GitHub token never reaches
 * the device readable.
 *
 *   POST { action: 'start' }
 *     -> { userCode, verificationUri, deviceCode, interval, expiresIn }
 *   POST { action: 'poll', deviceCode }
 *     -> { pending: true, interval } | { token, login }
 *
 * The device shows the code; it is entered at github.com/login/device and
 * approved there. Polling then exchanges the device code for an access
 * token (repo scope, as the browser sign-in asks), checks the identity is
 * the single allowed account, and hands back a sealed Studio session for
 * the device to send as Authorization: Bearer. It is the same sealed
 * payload the browser keeps in its cookie.
 *
 * Needs "Enable Device Flow" ticked on the GitHub OAuth app. Revoking the
 * app's authorization on GitHub, or rotating STUDIO_SESSION_SECRET, signs
 * the device out.
 */

import { NextRequest, NextResponse } from 'next/server';
import { studio, studioConfigured } from '@/lib/studio/config';
import { seal } from '@/lib/studio/session';

export const dynamic = 'force-dynamic';

const GH = { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'husayngokal-studio' };

export async function POST(req: NextRequest) {
  if (!studioConfigured()) {
    return NextResponse.json({ error: 'studio-not-configured' }, { status: 500 });
  }
  let body: { action?: string; deviceCode?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'malformed-body' }, { status: 400 }); }

  if (body.action === 'start') {
    const res = await fetch('https://github.com/login/device/code', {
      method: 'POST', headers: GH, cache: 'no-store',
      body: JSON.stringify({ client_id: studio.clientId, scope: 'repo' }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      device_code?: string; user_code?: string; verification_uri?: string; expires_in?: number; interval?: number; error?: string;
    };
    if (!res.ok || !j.device_code || !j.user_code) {
      return deviceError(j.error ?? `github-${res.status}`);
    }
    return NextResponse.json({
      userCode: j.user_code,
      verificationUri: j.verification_uri ?? 'https://github.com/login/device',
      deviceCode: j.device_code,
      interval: j.interval ?? 5,
      expiresIn: j.expires_in ?? 900,
    });
  }

  if (body.action === 'poll') {
    const deviceCode = typeof body.deviceCode === 'string' && /^[\w-]{1,200}$/.test(body.deviceCode) ? body.deviceCode : null;
    if (!deviceCode) return NextResponse.json({ error: 'bad-request' }, { status: 400 });

    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: GH, cache: 'no-store',
      body: JSON.stringify({
        client_id: studio.clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const j = (await res.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string; interval?: number };
    if (j.error === 'authorization_pending') return NextResponse.json({ pending: true, interval: 5 });
    if (j.error === 'slow_down') return NextResponse.json({ pending: true, interval: j.interval ?? 10 });
    if (!j.access_token) return deviceError(j.error ?? `github-${res.status}`);
    if (!String(j.scope ?? '').split(/[,\s]+/).includes('repo')) {
      return NextResponse.json({ error: 'scope', detail: 'GitHub did not grant the repo scope Studio commits with.' }, { status: 403 });
    }

    /* Confirm the identity, and that it is the one allowed account. */
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${j.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'husayngokal-studio' },
      cache: 'no-store',
    });
    const user = (await userRes.json().catch(() => ({}))) as { login?: string };
    if (!user.login || user.login !== studio.allowedLogin) {
      return NextResponse.json({ error: 'forbidden', detail: 'That GitHub account is not allowed here.' }, { status: 403 });
    }
    return NextResponse.json({ token: seal({ login: user.login, token: j.access_token, iat: Date.now() }), login: user.login });
  }

  return NextResponse.json({ error: 'bad-request' }, { status: 400 });
}

const DEVICE_ERRORS: Record<string, [number, string]> = {
  expired_token: [410, 'The code expired. Start again.'],
  access_denied: [403, 'The sign-in was declined on GitHub.'],
  device_flow_disabled: [400, 'Device sign-in is off. Tick "Enable Device Flow" on the Studio GitHub OAuth app.'],
  incorrect_client_credentials: [500, 'GitHub did not recognise the OAuth app.'],
  incorrect_device_code: [400, 'GitHub did not recognise that code. Start again.'],
};

function deviceError(code: string) {
  const [status, detail] = DEVICE_ERRORS[code] ?? [502, `GitHub sign-in failed (${code}).`];
  return NextResponse.json({ error: code, detail }, { status });
}
