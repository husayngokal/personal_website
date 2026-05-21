import { NextRequest, NextResponse } from 'next/server';

/*
 * One-time Spotify OAuth helper — callback.
 *
 * Spotify redirects here with ?code=... after the user approves. We
 * exchange the code for an access_token + refresh_token via the token
 * endpoint, then render the refresh_token to the screen so it can be
 * pasted into .env.local as SPOTIFY_REFRESH_TOKEN.
 *
 * The access_token expires in ~1 hour but the refresh_token is durable
 * — that's the one we keep. The access_token is recomputed on each
 * "currently playing" probe (see lib/spotify.ts when that lands).
 */

export async function GET(req: NextRequest) {
  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return plain('SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET missing in .env.local.', 500);
  }

  const code  = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  if (error) return plain(`Spotify returned an error: ${error}`, 400);
  if (!code) return plain('No ?code= in the callback URL. Start over at /api/spotify/authorize.', 400);

  const redirectUri = 'http://127.0.0.1:3001/api/spotify/callback';
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return plain(`Token exchange failed (${res.status}):\n${text}`, 502);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  // Render the refresh token clearly. The page is intentionally plain —
  // no styles, no scripts — so the value is unambiguous and copy/paste
  // friendly. The access token is shown only for diagnostic verification.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Spotify refresh token — paste into .env.local</title>
  <meta name="robots" content="noindex" />
  <style>
    body { font: 16px/1.5 ui-monospace, monospace; background: #EFE7D7; color: #111; padding: 32px; max-width: 720px; margin: 40px auto; }
    h1 { font-family: Georgia, serif; font-size: 22px; margin: 0 0 8px; }
    p  { margin: 8px 0 24px; color: #6B6B6B; }
    pre { background: #F8F2E3; border-left: 2px solid #F26B1F; padding: 16px; overflow-x: auto; user-select: all; }
    code { font: inherit; }
    .small { font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <h1>Spotify refresh token captured.</h1>
  <p>Paste this line into <code>.env.local</code> and restart <code>npm run dev</code>:</p>
  <pre><code>SPOTIFY_REFRESH_TOKEN=${escape(json.refresh_token)}</code></pre>

  <p class="small">Granted scopes: ${escape(json.scope)}<br/>
  Access token (expires in ${json.expires_in}s, regenerated automatically on each probe):</p>
  <pre class="small"><code>${escape(json.access_token)}</code></pre>

  <p class="small">You can delete <code>/app/api/spotify/authorize/route.ts</code> and <code>/app/api/spotify/callback/route.ts</code> after this — they are only needed once. Or keep them around in case you ever need to re-authorize.</p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function plain(body: string, status: number): NextResponse {
  return new NextResponse(body, { status, headers: { 'Content-Type': 'text/plain' } });
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
