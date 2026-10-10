/*
 * Live state — read from the current_state Postgres table.
 *
 * The vault webhook and GitHub project webhooks write to current_state. The homepage subscribes via Realtime and
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
  /** ISO date the project began, when known. The plate shows how long it
   *  has been running; there is deliberately no "last active" date. */
  started?: string | null;
  private: boolean;
  /** Where the state came from — a project has a detail page; a task
   *  (fallback when there's no active project) links to the tasks surface
   *  and hides the git-branch chrome. */
  kind?: 'project' | 'task';
  /** Correct destination for the card link. */
  href?: string;
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

export interface LiveState {
  reading?: CurrentReadingState | null;
  building?: CurrentBuildingState | null;
  studying?: CurrentStudyingState | null;
  exploring?: CurrentExploringState | null;
  writing?: CurrentWritingState | null;
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
  };
}

/* -- Derive the typewriter phrase set from a LiveState ---------------- */
export function phrasesFor(state: LiveState): string[] {
  const out: string[] = [];
  if (state.building) {
    out.push(`currently building ${state.building.title.toLowerCase()}.`);
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
  return out.length > 0 ? out : ['currently here, writing this.'];
}

function shortTitle(t: string): string {
  const colon = t.split(/[:—]/)[0];
  return colon.length < 32 ? colon : colon.split(',')[0];
}
