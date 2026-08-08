/*
 * Studio sign-in — kicks off the GitHub OAuth flow.
 *
 * Redirects to GitHub's authorize endpoint with the repo scope (needed so
 * the returned token can commit to the vault repo) and a CSRF state value
 * stashed in a short-lived httpOnly cookie, verified in the callback.
 *
 * redirect_uri is built from the request origin so it matches whatever
 * host we're actually on (prod). It must exactly equal a callback URL
 * registered on the GitHub OAuth app.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { studio, studioConfigured, STUDIO_STATE_COOKIE } from '@/lib/studio/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!studioConfigured()) {
    return NextResponse.json({ error: 'studio-not-configured' }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/studio/auth/callback`;
  const state = crypto.randomBytes(16).toString('hex');

  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', String(studio.clientId));
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('scope', 'repo');
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'false');

  const res = NextResponse.redirect(authorize.toString());
  res.cookies.set(STUDIO_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
