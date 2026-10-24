/*
 * Score effects: sound, haptics and the event that carries a score change
 * from wherever it happened to the effects layer.
 *
 * Sounds are synthesised with WebAudio, so there are no audio files. They
 * play only in direct answer to a tap (browsers block audio without a
 * gesture anyway), never for a visitor watching the bar move live. A pick
 * on a pentatonic scale climbs one step for each tap in a quick run, so a
 * streak of taps rises like collected coins; crossing a quarter of the bar
 * plays an arpeggio, filling it plays a fanfare, a new level plays a
 * longer one.
 *
 * Browser-only module. Every entry point is a no-op on the server.
 */

export interface WeekLite { bar: number; quest: number; curiosityCounted: number; full: boolean }

export interface ScoreFxDetail {
  before: WeekLite;
  after: WeekLite;
  barMax: number;
  levelBefore: number;
  levelAfter: number;
  gained: number;              // points this change added to the week
  origin?: { x: number; y: number };
  combo?: number;              // taps in the current quick run, 1-based
  sound?: boolean;             // true only when caused by the viewer's own tap
}

export const SCORE_FX_EVENT = 'score:fx';

export function emitScoreFx(detail: ScoreFxDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ScoreFxDetail>(SCORE_FX_EVENT, { detail }));
}

/** Quarter marks crossed by a change (1, 2, 3 or 4 = full). */
export function quartersCrossed(before: number, after: number, max: number): number[] {
  const out: number[] = [];
  for (let q = 1; q <= 4; q++) {
    const mark = (max * q) / 4;
    if (before < mark && after >= mark) out.push(q);
  }
  return out;
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/* -- Sound ----------------------------------------------------------- */

const SOUND_KEY = 'score-sound';

export function soundOn(): boolean {
  try { return window.localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}

export function setSoundOn(on: boolean) {
  try { window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !soundOn()) return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const C5 = 523.25;
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];
const hz = (semitones: number) => C5 * 2 ** (semitones / 12);

function tone(a: AudioContext, freq: number, at: number, dur: number, vol = 0.14, type: OscillatorType = 'triangle') {
  const osc = a.createOscillator();
  const env = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(vol, at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(env).connect(a.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** A pick per tap, a step higher for each tap in a run. Bigger gains add
 *  a fifth and an octave on top. */
export function playGain(points: number, combo = 1) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  const step = PENTATONIC[Math.min(combo - 1, PENTATONIC.length - 4)];
  tone(a, hz(step), t, 0.16, 0.16);
  tone(a, hz(step + 12), t, 0.09, 0.05, 'sine');
  if (points >= 12) tone(a, hz(step + 7), t + 0.07, 0.18, 0.12);
  if (points >= 30) tone(a, hz(step + 12), t + 0.14, 0.26, 0.12);
}

export function playQuarter(q: number) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.18;
  [0, 4, 7, 12].slice(0, 2 + q).forEach((s, i) => tone(a, hz(s + 7), t + i * 0.08, 0.3, 0.12));
}

export function playFull() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.2;
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(a, hz(s), t + i * 0.075, 0.45, 0.13));
  [0, 7, 12, 16, 24].forEach((s) => tone(a, hz(s), t + 0.6, 1.3, 0.07, 'sine'));
}

export function playLevelUp() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.25;
  const seq = [[0, 0.12], [7, 0.12], [12, 0.12], [16, 0.32], [12, 0.12], [16, 0.12], [24, 0.9]] as const;
  let at = t;
  for (const [s, d] of seq) { tone(a, hz(s), at, d + 0.15, 0.14, 'square'); tone(a, hz(s - 12), at, d + 0.15, 0.05); at += d; }
}

/* -- Haptics --------------------------------------------------------- */

export function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* unsupported */ }
}
