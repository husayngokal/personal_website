/*
 * The timer. One session at a time, like topes-timer, but kept on the
 * site so it follows across devices and its history lives in the vault.
 *
 *   POST { action: 'start', key?, label }      start timing (an item, or anything)
 *   POST { action: 'pause' | 'resume' }
 *   POST { action: 'stop' }                    log the session to time/YYYY-MM.md
 *   POST { action: 'discard' }                 throw the running session away
 *   POST { action: 'log', key?, label, minutes, date? }   add time by hand
 *
 * The running state is one current_state row (lib/score/time.ts), so every
 * open page sees it over Realtime. Elapsed time is derived from
 * timestamps, never counted. Time added by hand is marked as such and
 * never calibrates estimates (lib/score/calibrate.ts).
 */

import { NextRequest, NextResponse, after } from 'next/server';
import { getStudioSession } from '@/lib/studio/session';
import { getFile, putFile } from '@/lib/studio/github';
import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { recomputeScore } from '@/lib/score/store';
import { fetchVaultMarkdown } from '@/lib/vault/tarball';
import {
  IDLE, TIMER_KEY, appendSession, dubaiParts, elapsedMs, sessionFile, type Session, type TimerNow,
} from '@/lib/score/time';
import { timedPoints } from '@/lib/score/rules';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type Body = {
  action?: string; key?: string | null; label?: string; minutes?: number; date?: string;
  scores?: 'quest' | 'curiosity' | null; focusedMinutes?: number;
};

export async function POST(req: NextRequest) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'no-database' }, { status: 503 });
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'malformed-body' }, { status: 400 }); }

  const db = getServerAdminClient();
  const { data } = await db.from('current_state').select('value').eq('key', TIMER_KEY).maybeSingle();
  const t: TimerNow = { ...IDLE, ...((data?.value as Partial<TimerNow> | undefined) ?? {}) };
  const now = Date.now();
  const save = async (v: TimerNow) => {
    const { error } = await db.from('current_state')
      .upsert({ key: TIMER_KEY, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw new Error(error.message);
  };
  const key = typeof body.key === 'string' && /^[\w./-]{1,200}\.md$/.test(body.key) ? body.key : null;
  const label = String(body.label ?? '').trim().slice(0, 140);
  const lane = body.scores === 'quest' || body.scores === 'curiosity' ? body.scores : null;

  try {
    switch (body.action) {
      case 'start': {
        if (t.active) return NextResponse.json({ error: 'running', detail: 'A timer is already running. Stop it first.', timer: t }, { status: 409 });
        const next: TimerNow = { active: true, startedAt: now, pausedAt: null, pausedMs: 0, key, label: label || 'Untitled', scores: lane };
        await save(next);
        return NextResponse.json({ ok: true, timer: next });
      }
      case 'pause': {
        if (!t.active || t.pausedAt) return NextResponse.json({ ok: true, timer: t });
        const next = { ...t, pausedAt: now };
        await save(next);
        return NextResponse.json({ ok: true, timer: next });
      }
      case 'resume': {
        if (!t.active || !t.pausedAt) return NextResponse.json({ ok: true, timer: t });
        const next = { ...t, pausedMs: t.pausedMs + (now - t.pausedAt), pausedAt: null };
        await save(next);
        return NextResponse.json({ ok: true, timer: next });
      }
      case 'discard': {
        await save(IDLE);
        return NextResponse.json({ ok: true, timer: IDLE });
      }
      case 'stop':
      case 'log': {
        let s: Session;
        if (body.action === 'stop') {
          if (!t.active || !t.startedAt) return NextResponse.json({ error: 'idle', detail: 'No timer is running.' }, { status: 409 });
          const minutes = Math.max(1, Math.round(elapsedMs(t, now) / 60000));
          const a = dubaiParts(t.startedAt), b = dubaiParts(now);
          s = { date: a.date, from: a.hm, to: b.hm, minutes, key: t.key, label: t.label };
          /* A scoring session: the focused minutes you confirm (never more
             than the timer ran) set the points, frozen into the line. */
          if (t.scores) {
            const f = Number(body.focusedMinutes);
            const focused = Number.isFinite(f) ? Math.max(0, Math.min(minutes, Math.round(f))) : minutes;
            s.scores = { points: timedPoints(focused), lane: t.scores };
          }
        } else {
          const minutes = Math.round(Number(body.minutes));
          if (!Number.isFinite(minutes) || minutes < 1 || minutes > 16 * 60) {
            return NextResponse.json({ error: 'bad-request', detail: 'Minutes must be between 1 and 960.' }, { status: 400 });
          }
          const today = dubaiParts(now);
          const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date)) ? String(body.date) : today.date;
          const endMs = date === today.date ? now : Date.parse(`${date}T20:00:00+04:00`);
          const startMs = Math.max(Date.parse(`${date}T00:00:00+04:00`), endMs - minutes * 60000);
          s = { date, from: dubaiParts(startMs).hm, to: dubaiParts(endMs).hm, minutes, key, label: label || 'Untitled', manual: true };
          if (lane) s.scores = { points: timedPoints(minutes), lane };
        }

        /* Append to the month's file; two tries if it moved underneath us. */
        const path = sessionFile(s.date);
        let commit = { commitSha: '', commitDate: '' };
        let content = '';
        for (let attempt = 0; attempt < 2; attempt++) {
          const file = await getFile(session.token, path);
          content = appendSession(file?.content ?? null, s);
          try {
            commit = await putFile(session.token, {
              path, content, sha: file?.sha, message: `studio: timed ${s.minutes} min, ${s.label}`,
            });
            break;
          } catch (err) {
            const msg = (err as Error).message;
            if (attempt === 0 && (msg.includes('putFile 409') || msg.includes('putFile 422'))) continue;
            throw err;
          }
        }
        if (body.action === 'stop') await save(IDLE);

        after(async () => {
          try {
            await recomputeScore(db, await fetchVaultMarkdown(commit.commitSha || undefined), {
              override: { path, content }, asOf: commit.commitDate || undefined,
            });
          } catch (err) {
            console.error(`[studio/timer] score recompute failed: ${(err as Error).message}`);
          }
        });
        return NextResponse.json({ ok: true, timer: body.action === 'stop' ? IDLE : t, session: s });
      }
      default:
        return NextResponse.json({ error: 'bad-request' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'failed', detail: (err as Error).message }, { status: 502 });
  }
}
