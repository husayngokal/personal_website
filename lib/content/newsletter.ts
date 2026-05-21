import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import { getServerAdminClient } from '../supabase';
import { sendEmail, isEmailConfigured } from '../email';
import { buildConfirmationEmail } from '../email/confirmation';

/*
 * Newsletter subscriber operations — insert, lookup, unsubscribe.
 *
 * Tokens are 32-byte random hex. They're not secrets in the traditional
 * sense, but knowing one is enough to unsubscribe — so we treat them
 * with crypto-grade randomness and never log them.
 */

export type SubscribeResult =
  | { ok: true; alreadySubscribed?: boolean }
  | { ok: false; error: 'invalid-email' | 'rate-limited' | 'db-error' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const IP_PEPPER = 'husayngokal-com-newsletter-pepper-v1';

export async function subscribe(opts: {
  email: string;
  ip?: string;
  userAgent?: string;
}): Promise<SubscribeResult> {
  const email = opts.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'invalid-email' };
  }

  const db = getServerAdminClient();
  const ipHash = opts.ip
    ? createHash('sha256').update(IP_PEPPER + ':' + opts.ip).digest('hex')
    : null;

  /* Rate-limit: max 5 subscribe attempts per IP per hour */
  if (ipHash) {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', oneHourAgo);
    if ((count ?? 0) >= 5) {
      return { ok: false, error: 'rate-limited' };
    }
  }

  /* Existing row? Re-subscribe a previously unsubscribed address; no-op
     for already-confirmed addresses (don't reveal whether the email
     was subscribed). */
  const { data: existing } = await db
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'unsubscribed') {
      await db
        .from('newsletter_subscribers')
        .update({
          status: 'confirmed',
          unsubscribed_at: null,
          confirmed_at: new Date().toISOString(),
          ip_hash: ipHash,
          user_agent: opts.userAgent ?? null,
        })
        .eq('id', existing.id);
    }
    return { ok: true, alreadySubscribed: true };
  }

  const token = randomBytes(32).toString('hex');

  /* If Resend is configured, do double opt-in: insert as 'pending'
     and send confirmation email. Without Resend, fall back to single
     opt-in so the form still works for development. */
  const usingEmail = isEmailConfigured();
  const initialStatus = usingEmail ? 'pending' : 'confirmed';

  const { error } = await db.from('newsletter_subscribers').insert({
    email, token,
    ip_hash: ipHash,
    user_agent: opts.userAgent ?? null,
    status: initialStatus,
    confirmed_at: usingEmail ? null : new Date().toISOString(),
  });

  if (error) return { ok: false, error: 'db-error' };

  if (usingEmail) {
    const { subject, html, text } = buildConfirmationEmail({ email, token });
    /* Send is best-effort: if it fails (e.g. unverified domain) we still
       return ok and the user is in the DB as pending. The author can
       confirm manually or resend later. */
    void sendEmail({ to: email, subject, html, text });
  }

  return { ok: true };
}

export async function unsubscribeByToken(token: string): Promise<{ ok: boolean; email?: string }> {
  if (!token || token.length !== 64) return { ok: false };
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('newsletter_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: new Date().toISOString(),
    })
    .eq('token', token)
    .select('email')
    .maybeSingle();
  if (error || !data) return { ok: false };
  return { ok: true, email: data.email };
}

export async function getConfirmedCount(): Promise<number> {
  const db = getServerAdminClient();
  const { count } = await db
    .from('newsletter_subscribers')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'confirmed');
  return count ?? 0;
}
