/*
 * Studio (the authenticated authoring surface) configuration.
 *
 * Studio is prod-only by deliberate choice — the GitHub OAuth app has a
 * single production callback and the env vars live only in Vercel. Locally
 * these are undefined, so studioConfigured() is false and the surface shows
 * a "not configured here" notice instead of half-working.
 *
 * Auth model: sign in with GitHub (OAuth), and only STUDIO_ALLOWED_LOGIN is
 * let through. The user's OAuth access token (repo scope) is what authorises
 * commits to the vault repo, so writes happen as the author, not via a shared
 * machine token.
 */

export const studio = {
  clientId:      process.env.GITHUB_OAUTH_CLIENT_ID,
  clientSecret:  process.env.GITHUB_OAUTH_CLIENT_SECRET,
  sessionSecret: process.env.STUDIO_SESSION_SECRET,
  allowedLogin:  process.env.STUDIO_ALLOWED_LOGIN,
} as const;

/** True only when every auth env var is present (i.e. on prod). */
export function studioConfigured(): boolean {
  return Boolean(
    studio.clientId && studio.clientSecret && studio.sessionSecret && studio.allowedLogin,
  );
}

export const STUDIO_SESSION_COOKIE = 'studio_session';
export const STUDIO_STATE_COOKIE = 'studio_oauth_state';
