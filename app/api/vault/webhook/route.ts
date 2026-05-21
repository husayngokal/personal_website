import { NextRequest, NextResponse, after } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { syncVault } from '@/lib/vault/sync';

/*
 * GitHub vault webhook.
 *
 * Configure in the obsidian_vault repo's settings:
 *   Settings → Webhooks → Add webhook
 *   - Payload URL: https://husayngokal.com/api/vault/webhook
 *   - Content type: application/json
 *   - Secret: the value of GITHUB_WEBHOOK_SECRET in .env
 *   - Events: just the push event
 *
 * On each push GitHub POSTs the commit payload. We HMAC-verify, ACK
 * with 200 immediately, and run the actual Postgres sync in `after()`
 * so it doesn't block the response. GitHub gives webhook receivers
 * 10 seconds to respond before marking the delivery as 504-failed; a
 * full vault sync takes ~10-15 seconds (Trees API + 136 blob fetches
 * + upserts + live-state derivation), so without backgrounding every
 * delivery shows red even though the sync actually completes. The
 * response returns in <200ms; sync continues up to maxDuration=60s.
 *
 * Local dev: GitHub can't reach localhost. Use `npm run vault:sync`
 * manually, or run a tunnel (ngrok / Cloudflare Tunnel) to forward
 * GitHub's POST to your dev server.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: 'GITHUB_WEBHOOK_SECRET not set' },
      { status: 500 },
    );
  }

  /* Read the raw body for HMAC verification */
  const raw = await req.text();
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  if (!verify(secret, raw, signature)) {
    return NextResponse.json({ ok: false, reason: 'signature mismatch' }, { status: 401 });
  }

  /* The push event tells us what changed, but for v1 we just do a full
     re-sync. Cheap enough at this content volume; safer than partial
     sync if something gets out of step. */
  const event = req.headers.get('x-github-event') ?? '';
  if (event !== 'push' && event !== 'ping') {
    return NextResponse.json({ ok: true, ignored: `event '${event}' ignored` });
  }

  if (event === 'ping') {
    /* GitHub fires ping on webhook registration */
    return NextResponse.json({ ok: true, pong: true });
  }

  /* Extract per-file timestamps from the push payload. GitHub gives us
     `commits[].added/modified` keyed by `commits[].timestamp` — using
     this means we can skip a per-file commits-API roundtrip during
     sync (the original implementation did that and was timing out at
     Vercel's 60s function limit; see lib/vault/sync.ts header). */
  const fileTimestamps = new Map<string, string>();
  try {
    const payload = JSON.parse(raw) as {
      commits?: Array<{
        timestamp?: string;
        added?: string[];
        modified?: string[];
      }>;
    };
    for (const c of payload.commits ?? []) {
      const ts = c.timestamp;
      if (!ts) continue;
      for (const p of [...(c.added ?? []), ...(c.modified ?? [])]) {
        const prior = fileTimestamps.get(p);
        if (!prior || ts > prior) fileTimestamps.set(p, ts);
      }
    }
  } catch {
    /* Body unparseable — fall through with an empty map. */
  }

  /* ACK fast — GitHub's webhook timeout is 10s, well under a full sync. */
  after(async () => {
    try {
      const result = await syncVault({ fileTimestamps });
      console.log(
        `[vault/webhook] sync ok — parsed=${result.parsed} touched=${fileTimestamps.size} ` +
        `upserted=${JSON.stringify(result.upserted)} deleted=${JSON.stringify(result.deleted)} ` +
        `errors=${result.errors.length} warnings=${result.warnings.length}`,
      );
      if (result.errors.length > 0) {
        for (const e of result.errors) console.error(`[vault/webhook] parse error ${e.path}: ${e.message}`);
      }
    } catch (err) {
      console.error('[vault/webhook] sync failed:', (err as Error).message);
    }
  });

  return NextResponse.json({ ok: true, queued: true, touched: fileTimestamps.size });
}

function verify(secret: string, body: string, signatureHeader: string): boolean {
  if (!signatureHeader.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const received = signatureHeader.slice('sha256='.length);
  if (expected.length !== received.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
}
