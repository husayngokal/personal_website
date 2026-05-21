import { NextResponse } from 'next/server';

/*
 * One-time Spotify OAuth helper — start of flow.
 *
 * Visit http://127.0.0.1:3001/api/spotify/authorize after setting
 * SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in .env.local. You will be
 * redirected to Spotify to approve, then to /api/spotify/callback which
 * prints the refresh_token to paste into .env.local.
 *
 * This is a setup-only endpoint. It does not need rate-limiting or
 * authentication because it only works on localhost during one-time
 * setup. Delete this route file after capturing the refresh token if
 * you want belt-and-braces.
 */

const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
].join(' ');

export function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return new NextResponse(
      'SPOTIFY_CLIENT_ID is not set in .env.local. Set it and try again.',
      { status: 500, headers: { 'Content-Type': 'text/plain' } },
    );
  }

  const redirectUri = 'http://127.0.0.1:3001/api/spotify/callback';
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('show_dialog', 'true');

  return NextResponse.redirect(url.toString());
}
