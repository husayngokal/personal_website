/*
 * Spotify poll cron worker.
 *
 * Cloudflare invokes scheduled() on the cron defined in wrangler.toml.
 * We POST to the site's poll endpoint with a Bearer token; the
 * endpoint reads Spotify, upserts the current_state row, and
 * Supabase Realtime broadcasts to any connected homepage.
 *
 * Behaviour on failure: we log to the Workers tail (visible via
 * `wrangler tail` or the Cloudflare dashboard) and return. Spotify
 * has occasional 5xx hiccups — better to skip one tick than to surface
 * a noisy alert; the next tick is 60 seconds away.
 */

export interface Env {
  POLL_URL: string;
  SPOTIFY_POLL_TOKEN: string;
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(poll(env));
  },

  /* fetch() handler is a manual-trigger affordance: hit the worker URL
     in a browser (or `curl https://husayngokal-spotify-poll.<acct>.workers.dev`)
     and it runs one poll. Handy for verifying the auth path without
     waiting for the next cron tick. */
  async fetch(_req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const result = await poll(env);
    return new Response(JSON.stringify(result, null, 2), {
      status: result.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
    });
  },
} satisfies ExportedHandler<Env>;

async function poll(env: Env): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!env.SPOTIFY_POLL_TOKEN) {
    console.error('SPOTIFY_POLL_TOKEN secret not set');
    return { ok: false, error: 'token-not-set' };
  }
  try {
    const res = await fetch(env.POLL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SPOTIFY_POLL_TOKEN}` },
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 400);
      console.error(`spotify poll non-OK: ${res.status} ${body}`);
      return { ok: false, status: res.status, error: body };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`spotify poll threw: ${msg}`);
    return { ok: false, error: msg };
  }
}
