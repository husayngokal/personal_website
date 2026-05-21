/*
 * Spotify integration — refresh-on-demand access token + currently-playing.
 *
 * Server-only. Uses the refresh token captured via the one-time OAuth
 * helper at /api/spotify/authorize. The access token expires every hour;
 * we fetch a new one each probe rather than caching, because the token
 * endpoint round-trip is fast and caching adds bug surface for no real
 * win at the homepage's polling rate.
 *
 * Returns a normalised "now playing" shape ready for the typewriter and
 * for the current_state table once Realtime is wired (Part XIII).
 */

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

export interface SpotifyNowPlaying {
  playing: boolean;
  artist: string;
  track: string;
  album?: string;
  startedAt?: string;
  durationMs?: number;
  progressMs?: number;
  trackUrl?: string;
}

interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

function readConfig(): SpotifyConfig | null {
  const clientId     = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

/* -- Access token (refreshed on each probe) --------------------------- */
async function getAccessToken(cfg: SpotifyConfig): Promise<string> {
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: cfg.refreshToken,
    }),
    // Token endpoint should never be cached.
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token refresh failed (${res.status}): ${text}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

/* -- Currently playing ------------------------------------------------- */
export async function getCurrentlyPlaying(): Promise<SpotifyNowPlaying | null> {
  const cfg = readConfig();
  if (!cfg) return null;

  const token = await getAccessToken(cfg);
  const res = await fetch(NOW_PLAYING_URL, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  // 204 = nothing playing (Spotify's documented contract). Surface as
  // playing:false so the consumer can decide what to render.
  if (res.status === 204) return { playing: false, artist: '', track: '' };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify now-playing failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as {
    is_playing: boolean;
    progress_ms: number | null;
    timestamp: number;
    item: {
      name: string;
      duration_ms: number;
      external_urls?: { spotify?: string };
      artists: { name: string }[];
      album: { name: string };
    } | null;
  };

  if (!json.item) return { playing: false, artist: '', track: '' };

  return {
    playing: Boolean(json.is_playing),
    artist: json.item.artists.map((a) => a.name).join(', '),
    track: json.item.name,
    album: json.item.album?.name,
    durationMs: json.item.duration_ms,
    progressMs: json.progress_ms ?? undefined,
    startedAt: json.timestamp ? new Date(json.timestamp).toISOString() : undefined,
    trackUrl: json.item.external_urls?.spotify,
  };
}
