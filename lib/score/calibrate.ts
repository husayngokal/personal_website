/*
 * Calibration: how each kind of estimate learns from the record.
 *
 * Prices never change. What learns is the factor each source of estimate
 * is multiplied by (rules.ts: formula, stated, gut), once a month, on the
 * first Monday, and only for things priced after the review:
 *
 *   for each source, every item with parts priced from it that were
 *   finished since scoring began, all of them timed, the latest within
 *   26 weeks, and at least 20 timed minutes:
 *     B = what those parts were priced at, at the source's starting factor
 *     T = live-timed minutes up to the latest of them: overlapping
 *         sessions once, nothing typed in by hand, held within B/3 and 3B
 *   R      = sum(w T/B) / sum(w)   no item above a quarter of the weight
 *                                  (four or fewer: equal weights)
 *   n_eff  = sum(w)^2 / sum(w^2)   how many items the record is worth
 *   target = start x R^(n_eff / (n_eff + 5))
 *   next   = target, at most a tenth from the factor in force, to 0.05;
 *            held, for review by hand, past half or double its start
 *
 * Trust grows with the number of independent items, not with minutes or
 * parts: the parts of one course share one source of error, so twenty of
 * them are not twenty observations of my estimating.
 *
 * Time is matched to the part it bought: each session counts toward the
 * first part finished after its middle, and time after an item's latest
 * finished part belongs to work not finished yet, so it is left out.
 *
 * Everything is worked out again from the dated logs on every recompute,
 * so the factors' history can be checked by anyone with the vault.
 *
 * Pure module, no I/O.
 */

import {
  CALIBRATION, LEARNING, MINUTES_PER_POINT, SCORE_EPOCH, STARTING_FACTORS, VARIANCE,
  type Factors, type Learning, type Source,
} from './rules';
import { doneOrder, parseDone, type DoneEntry, type PartGroup } from './block';
import { plural, type ScoreItem } from './items';
import type { Session } from './time';

export interface ClassReview {
  start: number;          // the source's starting factor
  old: number;            // in force before the review
  next: number;           // in force after it
  target: number;         // where the record points, before the step limit
  items: number;          // items that counted
  nEff: number;           // what they are worth as independent items
  ratio: number | null;   // timed over priced, capped (R)
  trust: number;          // weight given to the record (Z)
  held: boolean;          // would have left half to double its start: kept
}

export interface Review { date: string; classes: Record<Learning, ClassReview> }

export interface Calibration {
  /** Factors in force today: what anything priced now is multiplied by. */
  factors: Factors;
  /** The review that set them; null while the starting values stand. */
  since: string | null;
  /** The next review, and what it would do on the record so far. */
  next: string;
  preview: Review;
  /** Every review so far, oldest first. */
  history: Review[];
}

export interface VarianceNote {
  date: string;
  key: string;
  title: string;
  href: string | null;
  label: string;          // "section", "3 chapters"
  timed: number;          // live-timed minutes
  priced: number;         // price in minutes
  ratio: number;
  basis: Source | null;
  why: string | null;
}

/* -- Clock arithmetic ------------------------------------------------- */

const DAY = 1440;

function dayIndex(isoDay: string): number {
  return Math.round(Date.parse(`${isoDay}T00:00:00Z`) / 86_400_000);
}

function hm(s: string): number {
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

function addDays(isoDay: string, n: number): string {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** A finished entry's moment, in minutes: its logged time, or the end of
 *  its day when only the day was recorded. */
function stamp(e: DoneEntry): number {
  return dayIndex(e.date) * DAY + (e.time ? hm(e.time) : DAY);
}

/* -- Finished parts --------------------------------------------------- */

interface Finish {
  at: number;
  date: string;
  points: number;
  counted: boolean;       // finished since scoring began
  basis: Source | null;
  factor: number;         // the factor it was priced at
  group: PartGroup;
  qty: number;
}

/** Every finished entry of an item, with the points it earned (the same
 *  cumulative rounding as items.ts), oldest first. */
function finishesOf(item: ScoreItem): Finish[] {
  const out: Finish[] = [];
  for (const g of item.parts) {
    const entries = g.done.map(parseDone).filter((e): e is DoneEntry => !!e).sort(doneOrder);
    /* Judged by the price committed before the work, even where the points
       paid were re-scored afterwards; a part priced only afterwards (0)
       says nothing about estimating, so it never calibrates. */
    const price = g.priced ?? g.points;
    let n = g.prior;
    for (const e of entries) {
      if (n >= g.count) break;
      const before = n;
      n = Math.min(g.count, n + e.qty);
      const learned = g.basis === 'formula' || g.basis === 'stated' || g.basis === 'gut';
      out.push({
        at: stamp(e),
        date: e.date,
        points: Math.round((price * n) / g.count) - Math.round((price * before) / g.count),
        counted: e.date >= SCORE_EPOCH,
        basis: g.priced === 0 ? null : g.basis ?? null,
        factor: g.factor ?? (learned ? STARTING_FACTORS[g.basis as Learning] : 1),
        group: g,
        qty: n - before,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/* -- Timed work ------------------------------------------------------- */

interface Slice { mid: number; minutes: number }

/** Live-timed, record-only minutes on an item, starting before `cut`.
 *  Overlapping sessions count once: each adds only the part of its span
 *  no earlier session covered, and never more than its own minutes. */
function liveSlices(sessions: Session[], key: string, cut: number): Slice[] {
  const own = sessions
    .filter((s) => s.key === key && !s.scores && !s.manual && s.date >= SCORE_EPOCH)
    .map((s) => {
      const start = dayIndex(s.date) * DAY + hm(s.from);
      let span = hm(s.to) - hm(s.from);
      if (span < 0) span += DAY;
      return { start, end: start + span, minutes: s.minutes };
    })
    .filter((s) => s.start < cut)
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  const covered: [number, number][] = [];
  const out: Slice[] = [];
  for (const s of own) {
    let overlap = 0;
    for (const [a, b] of covered) overlap += Math.max(0, Math.min(b, s.end) - Math.max(a, s.start));
    const minutes = s.end > s.start ? Math.min(s.minutes, s.end - s.start - overlap) : s.minutes;
    if (minutes > 0) out.push({ mid: (s.start + s.end) / 2, minutes });
    if (s.end > s.start) merge(covered, s.start, s.end);
  }
  return out;
}

function merge(list: [number, number][], a: number, b: number): void {
  list.push([a, b]);
  list.sort((x, y) => x[0] - y[0]);
  for (let i = 0; i < list.length - 1;) {
    if (list[i + 1][0] <= list[i][1]) {
      list[i][1] = Math.max(list[i][1], list[i + 1][1]);
      list.splice(i + 1, 1);
    } else i++;
  }
}

/** Minutes per finished entry. Each slice goes to the first finish at or
 *  after its middle, shared by price among entries finished at the same
 *  moment; slices after the last finish are left out. Also returns each
 *  moment's total, to tell an untimed part. */
function attribute(fins: Finish[], slices: Slice[]): { mins: number[]; byMoment: Map<number, number> } {
  const mins = fins.map(() => 0);
  const byMoment = new Map<number, number>();
  for (const s of slices) {
    const first = fins.findIndex((f) => f.at >= s.mid);
    if (first === -1) continue;
    const at = fins[first].at;
    const batch = fins.map((f, j) => (f.at === at ? j : -1)).filter((j) => j >= 0);
    const pts = batch.reduce((n, j) => n + fins[j].points, 0);
    for (const j of batch) mins[j] += pts ? (s.minutes * fins[j].points) / pts : s.minutes / batch.length;
    byMoment.set(at, (byMoment.get(at) ?? 0) + s.minutes);
  }
  return { mins, byMoment };
}

/* -- The evidence for a review ---------------------------------------- */

interface Evidence { B: number; T: number }

/** For each learning source, one entry per item that counts, from
 *  everything dated before `until`. */
function evidence(items: ScoreItem[], sessions: Session[], until: string): Record<Learning, Evidence[]> {
  const out: Record<Learning, Evidence[]> = { formula: [], stated: [], gut: [] };
  const cut = dayIndex(until) * DAY;
  const windowStart = addDays(until, -7 * CALIBRATION.windowWeeks);
  for (const item of items) {
    const fins = finishesOf(item).filter((f) => f.date < until);
    if (!fins.some((f) => f.counted && f.basis && f.basis in STARTING_FACTORS)) continue;
    const { mins, byMoment } = attribute(fins, liveSlices(sessions, item.key, cut));
    for (const c of LEARNING) {
      const idx = fins.map((f, i) => (f.counted && f.basis === c ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      if (fins[idx[idx.length - 1]].date < windowStart) continue;
      /* One untimed part and the item is out: timing only the slow ones
         must not be able to steer a factor. */
      if (idx.some((i) => !(byMoment.get(fins[i].at) ?? 0))) continue;
      const T = idx.reduce((n, i) => n + mins[i], 0);
      if (T < CALIBRATION.minItemMinutes) continue;
      const B = idx.reduce((n, i) => n + ((fins[i].points * MINUTES_PER_POINT) / fins[i].factor) * STARTING_FACTORS[c], 0);
      if (B > 0) out[c].push({ B, T });
    }
  }
  return out;
}

function estimateClass(c: Learning, ev: Evidence[]): Omit<ClassReview, 'old' | 'next' | 'held'> {
  const start = STARTING_FACTORS[c];
  if (!ev.length) return { start, target: start, items: 0, nEff: 0, ratio: null, trust: 0 };
  const k = CALIBRATION.clamp;
  const xs = ev.map(({ B, T }) => ({ B, T: Math.min(Math.max(T, B / k), k * B) }));
  /* No item above a quarter of the weight; with four or fewer, each counts
     the same (where the cap converges anyway). */
  let w: number[];
  if (xs.length <= 4) {
    w = xs.map(() => 1);
  } else {
    let L = Math.max(...xs.map((x) => x.B));
    w = xs.map((x) => Math.min(x.B, L));
    for (let i = 0; i < 500; i++) {
      const sum = w.reduce((a, b) => a + b, 0);
      if (L <= CALIBRATION.itemShare * sum * (1 + 1e-12)) break;
      L = CALIBRATION.itemShare * sum;
      w = xs.map((x) => Math.min(x.B, L));
    }
  }
  const sw = w.reduce((a, b) => a + b, 0);
  const ratio = xs.reduce((n, x, i) => n + (w[i] * x.T) / x.B, 0) / sw;
  const nEff = (sw * sw) / w.reduce((n, x) => n + x * x, 0);
  const trust = nEff / (nEff + CALIBRATION.trustK);
  return { start, target: start * ratio ** trust, items: xs.length, nEff, ratio, trust };
}

function review(c: Learning, old: number, est: Omit<ClassReview, 'old' | 'next' | 'held'>): ClassReview {
  const moved = Math.min(Math.max(est.target, old * (1 - CALIBRATION.step)), old * (1 + CALIBRATION.step));
  const next = Math.round(moved * 20) / 20;
  const held = next / est.start < 1 / CALIBRATION.guard || next / est.start > CALIBRATION.guard;
  return { ...est, old, next: held ? old : next, held };
}

/* -- Review dates ----------------------------------------------------- */

function firstMonday(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1));
  d.setUTCDate(1 + ((8 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

/** First Mondays from the first review on: those on or before `today`,
 *  and the one after. */
function reviewDates(today: string): { past: string[]; next: string } {
  const past: string[] = [];
  let y = Number(CALIBRATION.firstReview.slice(0, 4));
  let m = Number(CALIBRATION.firstReview.slice(5, 7)) - 1;
  for (;;) {
    const d = firstMonday(y, m);
    if (d > today) return { past, next: d };
    if (d >= CALIBRATION.firstReview) past.push(d);
    m++;
    if (m === 12) { m = 0; y++; }
  }
}

/* -- Public ------------------------------------------------------------ */

export function calibrate(items: ScoreItem[], sessions: Session[], today: string): Calibration {
  const { past, next } = reviewDates(today);
  let factors: Factors = { ...STARTING_FACTORS };
  const history: Review[] = [];
  const run = (until: string, date: string): Review => {
    const ev = evidence(items, sessions, until);
    const classes = {} as Record<Learning, ClassReview>;
    for (const c of LEARNING) classes[c] = review(c, factors[c], estimateClass(c, ev[c]));
    return { date, classes };
  };
  for (const date of past) {
    const r = run(date, date);
    history.push(r);
    factors = { formula: r.classes.formula.next, stated: r.classes.stated.next, gut: r.classes.gut.next };
  }
  return {
    factors,
    since: history.length ? history[history.length - 1].date : null,
    next,
    preview: run(addDays(today, 1), next),
    history,
  };
}

/** The factors anything priced now is multiplied by. A score stored before
 *  per-source factors existed carries none: then the starting values. */
export function factorsInForce(state: { calibration?: { factors?: Partial<Factors> } } | null | undefined): Factors {
  const f = state?.calibration?.factors;
  const ok = (x: unknown) => typeof x === 'number' && Number.isFinite(x) && x > 0;
  return f && ok(f.formula) && ok(f.stated) && ok(f.gut)
    ? { formula: f.formula!, stated: f.stated!, gut: f.gut! }
    : { ...STARTING_FACTORS };
}

/** Every finished part, since scoring began, that took under half or over
 *  double its price: newest first. A note only; points never change. */
export function varianceNotes(items: ScoreItem[], sessions: Session[], today: string): VarianceNote[] {
  const notes: VarianceNote[] = [];
  const cut = (dayIndex(today) + 1) * DAY;
  for (const item of items) {
    if (item.private) continue;
    const fins = finishesOf(item).filter((f) => f.date <= today);
    if (!fins.some((f) => f.counted)) continue;
    const { byMoment } = attribute(fins, liveSlices(sessions, item.key, cut));
    const moments = [...new Set(fins.map((f) => f.at))];
    for (const at of moments) {
      const batch = fins.filter((f) => f.at === at);
      if (!batch.every((f) => f.counted)) continue;
      const timed = Math.round(byMoment.get(at) ?? 0);
      const priced = batch.reduce((n, f) => n + f.points, 0) * MINUTES_PER_POINT;
      if (!timed || !priced) continue;
      const ratio = timed / priced;
      if (ratio >= VARIANCE.low && ratio <= VARIANCE.high) continue;
      const g = batch[0].group;
      const qty = batch.reduce((n, f) => n + f.qty, 0);
      const same = batch.every((f) => f.group === g);
      notes.push({
        date: batch[0].date, key: item.key, title: item.title, href: item.href,
        label: !same ? `${qty} parts`
          : g.name ? (qty > 1 ? `${g.name} · ${qty} ${plural(g.unit)}` : g.name)
          : qty > 1 ? `${qty} ${plural(g.unit)}` : g.unit,
        timed, priced, ratio: Math.round(ratio * 100) / 100,
        basis: same ? g.basis ?? null : null, why: same ? g.why ?? null : null,
      });
    }
  }
  return notes.sort((a, b) => b.date.localeCompare(a.date));
}
