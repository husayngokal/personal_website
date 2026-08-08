/*
 * Studio OAuth callback — exchanges the code for an access token, confirms
 * the GitHub identity is the single allowed account, and seals the session.
 *
 * On any failure (bad state, denied, wrong account) we bounce back to
 * /studio with an error query param and set no session cookie.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { studio, studioConfigured, STUDIO_SESSION_COOKIE, STUDIO_STATE_COOKIE } from '@/lib/studio/config';
import { seal } from '@/lib/studio/session';

export const dynamic = 'force-dynamic';

function bounce(origin: string, error: string) {
  const res = NextResponse.redirect(`${origin}/studio?error=${encodeURIComponent(error)}`);
  res.cookies.delete(STUDIO_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;

  if (!studioConfigured()) {
    return NextResponse.json({ error: 'studio-not-configured' }, { status: 500 });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = (await cookies()).get(STUDIO_STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return bounce(origin, 'state-mismatch');
  }

  /* Exchange the code for an access token. */
  let accessToken: string | undefined;
  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: studio.clientId,
        client_secret: studio.clientSecret,
        code,
        redirect_uri: `${origin}/api/studio/auth/callback`,
      }),
      cache: 'no-store',
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    accessToken = tokenJson.access_token;
  } catch {
    return bounce(origin, 'token-exchange-failed');
  }
  if (!accessToken) return bounce(origin, 'no-token');

  /* Confirm the identity, and that it's the one allowed account. */
  let login: string | undefined;
  try {
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'husayngokal-studio',
      },
      cache: 'no-store',
    });
    const user = (await userRes.json()) as { login?: string };
    login = user.login;
  } catch {
    return bounce(origin, 'user-fetch-failed');
  }
  if (!login || login !== studio.allowedLogin) return bounce(origin, 'forbidden');

  const sealed = seal({ login, token: accessToken, iat: Date.now() });
  const res = NextResponse.redirect(`${origin}/studio`);
  res.cookies.set(STUDIO_SESSION_COOKIE, sealed, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.delete(STUDIO_STATE_COOKIE);
  return res;
}
