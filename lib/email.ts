/*
 * Resend wrapper — single send() that adds List-Unsubscribe headers
 * for one-click compliance (Gmail/Yahoo requirement as of 2024).
 *
 * The unsubscribe-by-token URL is the same one served at
 * /api/newsletter/unsubscribe. Including it as a header makes inbox
 * UIs offer the one-click button without the user opening the message.
 */

import 'server-only';
import { Resend } from 'resend';

let client: Resend | null = null;

/* The From address (notify@) is a send-only mailbox — no MX behind it.
   Replies should land in the author's real inbox, so we default the
   Reply-To header to husayn@husayngokal.com (the site's canonical
   contact per BRIEF Part I). Callers can override per-send via
   SendOptions.replyTo; pass an empty string to suppress. */
const REPLY_TO_DEFAULT = 'husayn@husayngokal.com';

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeToken?: string;       // adds List-Unsubscribe headers
  replyTo?: string;                // overrides REPLY_TO_DEFAULT; '' suppresses
}

export async function sendEmail(opts: SendOptions): Promise<{ ok: boolean; id?: string; error?: string }> {
  const resend = getClient();
  const from = process.env.EMAIL_FROM;
  if (!resend || !from) {
    return { ok: false, error: 'email-not-configured' };
  }

  const headers: Record<string, string> = {};
  if (opts.unsubscribeToken) {
    const unsubUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://husayngokal.com'}/api/newsletter/unsubscribe?t=${opts.unsubscribeToken}`;
    headers['List-Unsubscribe'] = `<${unsubUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const replyTo = opts.replyTo === undefined ? REPLY_TO_DEFAULT : opts.replyTo;

  try {
    const res = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers,
      replyTo: replyTo || undefined,   // empty string → no header at all
    });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, id: res.data?.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
