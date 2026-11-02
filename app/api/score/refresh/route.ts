/*
 * Daily score refresh, run by Vercel Cron at 00:00 Dubai (20:00 UTC).
 *
 * The score is recomputed on every sync and every Studio tap, so a day
 * with neither would leave the stored week stale; on a Monday that means
 * last week's total still on the bar. This recompute rolls the week over
 * at midnight whether or not anything happened.
 *
 * Idempotent and harmless (it only rewrites the cache from the vault), so
 * the guard is light: CRON_SECRET when it is configured, otherwise Vercel
 * Cron's user agent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { fetchVaultMarkdown, headCommit } from '@/lib/vault/tarball';
import { recomputeScore } from '@/lib/score/store';
import { REFRESH_KEY } from '@/lib/score/needs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const ok = secret
    ? req.headers.get('authorization') === `Bearer ${secret}`
    : (req.headers.get('user-agent') ?? '').startsWith('vercel-cron/');
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'no-database' }, { status: 503 });

  const db = getServerAdminClient();
  const head = await headCommit();
  const s = await recomputeScore(db, await fetchVaultMarkdown(head.sha), { asOf: head.date });
  /* Proof that it ran: Studio's Needs you list warns when this goes stale. */
  await db.from('current_state').upsert({ key: REFRESH_KEY, value: { at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  for (const p of ['/', '/life/tasks', '/field-atlas', '/bucket-list', '/library', '/courses']) revalidatePath(p);
  return NextResponse.json({ ok: true, week: s.week.start, bar: s.week.bar });
}
