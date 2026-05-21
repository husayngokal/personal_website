/*
 * Live state — read from the current_state Postgres table.
 *
 * The Spotify poller, vault webhook, and GitHub project webhooks all
 * write to current_state. The homepage subscribes via Realtime and
 * re-renders on changes (see components/LiveStateProvider.tsx).
 *
 * Shapes match what scripts/seed.ts writes; if a key is missing or empty
 * the getter returns null and the consumer decides whether to render or
 * skip. The state.ts module (legacy) used to derive these synchronously
 * from lib/data/*; that path is gone once Supabase is live.
 */

import { getServerAdminClient, isSupabaseConfigured } from '../supabase';

export interface CurrentReadingState {
  slug: string;
  title: string;
  author: string;
  /** Optional now — Orwell-style "in progress, percentage unknown"
   *  is a real state. The phrase swaps based on whether this is set. */
  progressPct?: number | null;
  coverUrl?: string | null;
}

export interface CurrentBuildingState {
  slug: string;
  title: string;
  branch: string;
  lastActiveDate: string;      // ISO date; consumer formats as "today"/"yesterday"/etc.
  private: boolean;
}

export interface CurrentStudyingState {
  slug: string;
  title: string;
  /** ISO exam date when known, empty string when the source is a
   *  rolling course with no fixed exam. */
  examDate: string;
  /** Exam sat, results pending. Flips the phrase from "studying" to
   *  "awaiting results". */
  awaitingResults?: boolean;
}

export interface CurrentExploringState {
  slug: string;
  title: string;
}

export interface CurrentWritingState {
  slug: string;
  title: string;
  wordCount: number;
}

export interface CurrentListeningState {
  artist: string;
  track: string;
  album?: string;
  startedAt?: string;
  durationMs?: number;
  /* progressMs at the moment we sampled Spotify (server-side poll).
     Combined with sampledAtMs below, the client computes the *current*
     elapsed time client-side without needing another poll. */
  progressMs?: number;
  sampledAtMs?: number;       // ms-since-epoch when the poller wrote this row
  trackUrl?: string;
}

export interface LiveState {
  reading?: CurrentReadingState | null;
  building?: CurrentBuildingState | null;
  studying?: CurrentStudyingState | null;
  exploring?: CurrentExploringState | null;
  writing?: CurrentWritingState | null;
  listening?: CurrentListeningState | null;
}

/* -- Read all keys in one round-trip ----------------------------------- */
export async function getLiveState(): Promise<LiveState> {
  if (!isSupabaseConfigured()) return {};
  const db = getServerAdminClient();
  const { data, error } = await db
    .from('current_state')
    .select('key, value');
  if (error || !data) return {};

  const m = new Map(data.map((r) => [r.key, r.value]));
  const empty = (v: unknown) => !v || typeof v !== 'object' || Object.keys(v).length === 0;

  return {
    reading:   empty(m.get('currently_reading'))  ? null : (m.get('currently_reading')  as CurrentReadingState),
    building:  empty(m.get('currently_building')) ? null : (m.get('currently_building') as CurrentBuildingState),
    studying:  empty(m.get('currently_studying')) ? null : (m.get('currently_studying') as CurrentStudyingState),
    exploring: empty(m.get('currently_exploring'))? null : (m.get('currently_exploring')as CurrentExploringState),
    writing:   empty(m.get('currently_writing'))  ? null : (m.get('currently_writing')  as CurrentWritingState),
    listening: empty(m.get('currently_listening'))? null : (m.get('currently_listening')as CurrentListeningState),
  };
}

/* -- Derive the typewriter phrase set from a LiveState ----------------
 * `nowMs` is the current time in ms; if provided, the listening phrase
 * includes a client-side computed elapsed position ("currently 1:23
 * into talwar by faraz anwar"). Otherwise just the song name.       */
export function phrasesFor(state: LiveState, nowMs?: number): string[] {
  const out: string[] = [];
  if (state.building) {
    /* Date-precision only until GitHub commit webhooks are wired.
       Avoids the embarrassing "last commit 1398 minutes ago." */
    const when = relativeDay(state.building.lastActiveDate, nowMs);
    out.push(`currently building ${state.building.title.toLowerCase()}, active ${when}.`);
  }
  if (state.reading) {
    const title = shortTitle(state.reading.title).toLowerCase();
    const pct = state.reading.progressPct;
    out.push(
      pct != null && pct > 0
        ? `currently reading ${title}, ${pct}% in.`
        : `currently reading ${title}.`,
    );
  }
  if (state.writing) {
    const title = state.writing.title.toLowerCase().replace(/^on\s+/, '');
    const words = state.writing.wordCount;
    out.push(
      words > 0
        ? `currently writing about ${title}, ${words.toLocaleString()} words and growing.`
        : `currently writing about ${title}.`,
    );
  }
  if (state.studying) {
    if (state.studying.awaitingResults) {
      /* Exam sat, results pending. Subject only (text after any
         separator), lowercased like the sibling phrases, never an
         em-dash regardless of how the credential title is stored. */
      const subject = state.studying.title.split(/\s*[—–:·]\s*/).pop()!.toLowerCase();
      out.push(`currently awaiting ${subject} results.`);
    } else {
      /* Title-case the title here so acronyms like ICS stay capitalised
         and proper-noun-ish titles read right. The other phrases lowercase
         intentionally; studying is the one slot where the title is most
         often a formal program/credential name that deserves its caps. */
      out.push(`currently studying ${state.studying.title}.`);
    }
  }
  if (state.exploring) {
    out.push(`currently exploring ${state.exploring.title.toLowerCase()}.`);
  }
  if (state.listening) {
    /* Always "listening to" — keeps the verb consistent with the
       other phrases ("building", "reading", "writing"). artist · track
       (middle-dot separator). Elapsed time, if present, is a trailing
       parenthetical-style suffix that doesn't disrupt the phrase. */
    const artist = state.listening.artist.toLowerCase();
    const track  = state.listening.track.toLowerCase();
    const base   = `currently listening to ${artist} · ${track}`;
    const elapsed = currentElapsedMs(state.listening, nowMs);
    out.push(elapsed != null ? `${base}, ${formatMmss(elapsed)} in.` : `${base}.`);
  }
  return out.length > 0 ? out : ['currently here, writing this.'];
}

/* Compute the elapsed ms within the track, right now, from the
   server-side sample (progressMs at sampledAtMs) plus the wall-clock
   delta since. Capped at the track duration so we don't claim the
   song is past its end while we wait for the next poll. */
function currentElapsedMs(
  l: CurrentListeningState,
  nowMs?: number,
): number | null {
  if (l.progressMs == null || l.sampledAtMs == null) return null;
  if (!nowMs) return l.progressMs;
  const delta = Math.max(0, nowMs - l.sampledAtMs);
  const candidate = l.progressMs + delta;
  if (l.durationMs != null && candidate > l.durationMs) return l.durationMs;
  return candidate;
}

function formatMmss(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function relativeDay(iso: string, nowMs?: number): string {
  const then = new Date(iso).getTime();
  const now  = nowMs ?? Date.now();
  const days = Math.floor((now - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)   return `${days} days ago`;
  if (days < 30)  return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`;
}

function shortTitle(t: string): string {
  const colon = t.split(/[:—]/)[0];
  return colon.length < 32 ? colon : colon.split(',')[0];
}
