import 'server-only';
import { getServerAdminClient } from '../supabase';

/*
 * The weekly email was switched off in October 2026: the signup form, the
 * confirmation flow, the Sunday digest endpoint and its scheduled workflow
 * are all gone, so nothing sends and nobody new can join.
 *
 * Only unsubscribe survives. Digests that were already delivered carry a
 * tokenised unsubscribe link, and that link should keep working for as
 * long as those emails sit in someone's inbox.
 *
 * The newsletter_subscribers table is left as it was (two rows at the time
 * of removal). Nothing reads it except the function below.
 */

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
