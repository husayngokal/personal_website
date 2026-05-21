# Spotify poll cron — Cloudflare Worker

Pokes `https://husayngokal.com/api/spotify/poll` every minute so the
"currently listening" row in `current_state` stays fresh.

Replaces a GitHub Actions cron (`*/5 * * * *`) that was actually
firing closer to once an hour because GHA free tier silently
deprioritises sub-15-minute schedules. CFW Workers Cron runs on a
guaranteed cadence and easily fits the free tier (1,440 requests/day
out of 100,000).

The GHA workflow still exists at `.github/workflows/spotify-poll.yml`
on a 15-minute schedule as a redundancy.

## One-time setup

```sh
cd cloudflare-workers/spotify-poll
npm install
npx wrangler login                              # opens browser
npx wrangler secret put SPOTIFY_POLL_TOKEN      # paste the token
npx wrangler deploy
```

Verify it's working:

```sh
npx wrangler tail   # streams live logs; should see one scheduled run/min
```

Or hit the worker URL directly to trigger an immediate poll:

```sh
curl https://husayngokal-spotify-poll.<your-cf-subdomain>.workers.dev
# → {"ok": true, "status": 200}
```

## Updating

After any edit to `src/index.ts`:

```sh
npx wrangler deploy
```

To rotate the token:

```sh
npx wrangler secret put SPOTIFY_POLL_TOKEN   # paste new value
# also update Vercel: vercel env rm/add SPOTIFY_POLL_TOKEN
# also update GH secret SPOTIFY_POLL_TOKEN on the personal_website repo
```

## Pausing the cron

```sh
# Temporary: comment out the [triggers] block in wrangler.toml + redeploy
# Permanent: npx wrangler delete   # removes the worker entirely
```
