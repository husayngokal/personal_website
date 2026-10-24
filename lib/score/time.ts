/*
 * Timed sessions: the hours, kept beside the points but never turned into
 * them. Points come only from finished work; time is a log, for seeing
 * where the hours go and how they compare with what was planned.
 *
 * Sessions live in the vault, one file per month, one line per session:
 *
 *   time/2026-10.md
 *   - 2026-10-24 · 09:12 to 10:42 · 90 min · study/credentials/sqe-1.md · SQE 1
 *   - 2026-10-24 · 14:00 to 14:45 · 45 min · - · Reading on AI governance
 *
 * Day and times are Dubai time. The fourth field is the vault path of the
 * item the time went to, or "-" for anything else; the last is a label.
 * The parser skips the time/ folder, so these files never reach a table.
 *
 * Pure module, no I/O.
 */

export interface Session {
  date: string;         // YYYY-MM-DD, Dubai
  from: string;         // HH:MM
  to: string;           // HH:MM
  minutes: number;
  key: string | null;   // vault path of the item, or null
  label: string;
}

const LINE = /^- (\d{4}-\d{2}-\d{2}) · (\d{2}:\d{2}) to (\d{2}:\d{2}) · (\d+) min · (\S+) · (.*)$/;

export function parseSessions(body: string): Session[] {
  const out: Session[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const m = raw.trim().match(LINE);
    if (!m) continue;
    out.push({
      date: m[1], from: m[2], to: m[3], minutes: Number(m[4]),
      key: m[5] === '-' ? null : m[5], label: m[6].trim(),
    });
  }
  return out;
}

const clean = (s: string) => s.replace(/[\r\n·]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);

export function formatSession(s: Session): string {
  return `- ${s.date} · ${s.from} to ${s.to} · ${Math.max(1, Math.round(s.minutes))} min · ${s.key ?? '-'} · ${clean(s.label) || 'Untitled'}`;
}

export function sessionFile(date: string): string {
  return `time/${date.slice(0, 7)}.md`;
}

/** Add a session to a month file's content (or start a new file). */
export function appendSession(existing: string | null, s: Session): string {
  const line = formatSession(s);
  if (!existing || !existing.trim()) {
    return `# Time, ${s.date.slice(0, 7)}\n\nTimed sessions, Dubai time. Hours are a log; they never score.\n\n${line}\n`;
  }
  return existing.replace(/\s*$/, '\n') + line + '\n';
}

/* -- Dubai clock ----------------------------------------------------- */

const DUBAI_MS = 4 * 3_600_000;

export function dubaiParts(ms: number): { date: string; hm: string } {
  const iso = new Date(ms + DUBAI_MS).toISOString();
  return { date: iso.slice(0, 10), hm: iso.slice(11, 16) };
}

/* -- The running timer ------------------------------------------------
 * Stored in current_state under TIMER_KEY so it follows across devices.
 * Elapsed time is always derived from timestamps, never counted, so a
 * closed tab or a sleeping phone loses nothing.
 */

export const TIMER_KEY = 'timer_now';

export interface TimerNow {
  active: boolean;
  startedAt: number | null;   // epoch ms
  pausedAt: number | null;    // epoch ms while paused
  pausedMs: number;           // total paused so far
  key: string | null;
  label: string;
}

export const IDLE: TimerNow = { active: false, startedAt: null, pausedAt: null, pausedMs: 0, key: null, label: '' };

export function elapsedMs(t: TimerNow, now = Date.now()): number {
  if (!t.active || !t.startedAt) return 0;
  const pausedNow = t.pausedAt ? now - t.pausedAt : 0;
  return Math.max(0, now - t.startedAt - t.pausedMs - pausedNow);
}

export function hms(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function hoursLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h} h`;
}
