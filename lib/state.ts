/*
 * Current-state derivation for the homepage live components.
 *
 * Phase 1: state is derived from the data modules and a small set of
 * client-side mocks (relative timestamps, "now playing"). When the SSE
 * pipeline lands (Part XIII), these getters are replaced with subscribers
 * to the same channels; the shape stays identical so the consumers
 * (homepage rails, typewriter) do not change.
 */

import { BOOKS } from './data/library';
import { PROJECTS } from './data/projects';
import { NOTEBOOK_POSTS } from './data/notebook';
import { STUDY_CREDENTIALS } from './data/study';

/* -- Currently reading -------------------------------------------------- */
export function getCurrentReading() {
  const reading = BOOKS.find(
    (b) => b.status === 'reading' || b.status === 're-reading',
  );
  if (!reading) return null;
  return {
    slug: reading.slug,
    title: reading.title,
    author: reading.author,
    progressPct: reading.progressPct ?? 0,
  };
}

/* -- Currently building ------------------------------------------------- */
export function getCurrentBuilding() {
  const active = PROJECTS.find((p) => p.status === 'active');
  if (!active) return null;
  const lastCommit = active.activity?.[0];
  return {
    slug: active.slug,
    title: active.title,
    branch: lastCommit?.branch ?? 'main',
    // 12 minutes ago — matches the brief's example. Real version reads
    // the commit timestamp from the GitHub webhook event.
    lastCommitMinutesAgo: 12,
    private: active.repoPrivate ?? false,
  };
}

/* -- Currently studying ------------------------------------------------- */
export function getCurrentStudying() {
  const pending = STUDY_CREDENTIALS.find((c) => c.pending && c.slug === 'ics-marine-insurance');
  if (!pending) return null;
  // Exam date: May 20, 2026 (per Part XIV, Phase 0). Days computed from now.
  const exam = new Date('2026-05-20T00:00:00Z');
  const now = new Date();
  const days = Math.max(0, Math.ceil((exam.getTime() - now.getTime()) / 86_400_000));
  return {
    slug: pending.slug,
    title: pending.title,
    examDate: exam,
    daysUntil: days,
  };
}

/* -- Currently writing -------------------------------------------------- */
export function getCurrentWriting() {
  // Most-recently-modified draft. For Phase 1, the most recent post stands in.
  const recent = [...NOTEBOOK_POSTS].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!recent) return null;
  return {
    slug: recent.slug,
    title: recent.title,
    wordCount: recent.wordCount ?? 0,
  };
}

/* -- Currently listening (mocked) -------------------------------------- */
export function getCurrentListening() {
  // The Spotify integration is optional per Part XIII. The mock matches
  // the brief's example so the typewriter has the right grammar.
  return { artist: 'Faraz Anwar', track: 'Talwar' };
}

/* -- Typewriter phrases ------------------------------------------------- */
/* Phrases match the patterns in Part V exactly. Each is regenerated from
   the live state above; the typewriter cycles through them in order.  */
export function getTypewriterPhrases(): string[] {
  const phrases: string[] = [];
  const reading = getCurrentReading();
  const building = getCurrentBuilding();
  const studying = getCurrentStudying();
  const writing = getCurrentWriting();
  const listening = getCurrentListening();

  if (building) {
    phrases.push(
      `currently building ${building.title.toLowerCase()} — last commit ${building.lastCommitMinutesAgo} minutes ago.`,
    );
  }
  if (reading) {
    phrases.push(
      `currently reading ${shortTitle(reading.title).toLowerCase()} — ${reading.progressPct}% in, three margin notes today.`,
    );
  }
  if (writing) {
    phrases.push(
      `currently writing about ${writing.title.toLowerCase().replace(/^on\s+/, '')} — ${writing.wordCount.toLocaleString()} words and growing.`,
    );
  }
  if (studying) {
    phrases.push(
      `currently ${studying.daysUntil} days from the ics marine insurance exam.`,
    );
  }
  if (listening) {
    phrases.push(
      `currently listening to ${listening.artist.toLowerCase()} — ${listening.track.toLowerCase()}.`,
    );
  }
  return phrases;
}

function shortTitle(t: string): string {
  // "The Long Partition and the Making of Modern South Asia" → "the long partition"
  const colon = t.split(/[:—]/)[0];
  return colon.length < 32 ? colon : colon.split(',')[0];
}
