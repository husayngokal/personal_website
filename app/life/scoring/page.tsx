import Link from 'next/link';
import { Eyebrow } from '@/components/Primitives';
import {
  ATLAS, CURIOSITY_CAP, FORMULA_FACTOR, GUT_FACTOR, LEVEL_SIZE, MINUTES_PER_POINT,
  READING_TIERS, RECURRING_GUT_HOURS, SCORE_EPOCH, TASK_GUT_HOURS, WEEKLY_BAR, WEEKLY_HOURS,
  WORDS_PER_HOUR, estimate, pagesPerPoint, type Tier,
} from '@/lib/score/rules';
import { shortDay } from '@/lib/score/format';
import styles from './scoring.module.css';

/*
 * How scoring works: the public rules.
 *
 * Every number on this page is read from lib/score/rules.ts, the same
 * module that does the maths, so the explanation cannot drift from the
 * scoring. Static: it changes only when the rules do.
 */

export const metadata = {
  title: 'How scoring works',
  description:
    'One number a week: two hundred points, fifteen focused minutes each. The rules behind the weekly bar, in full.',
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

export default function ScoringPage() {
  const tiers = Object.entries(READING_TIERS) as [Tier, (typeof READING_TIERS)[Tier]][];
  const wordsPerPoint = (WORDS_PER_HOUR * MINUTES_PER_POINT) / 60;
  const capHours = (CURIOSITY_CAP * MINUTES_PER_POINT) / 60;

  return (
    <div className="page page--life">
      <p className={styles.back}><Link href="/life">← Life Plan</Link></p>
      <Eyebrow number="11.5">Scoring</Eyebrow>
      <h1 className={styles.title}>How scoring works.</h1>
      <p className={styles.dek}>
        One number a week. {WEEKLY_BAR} points. When the bar is full, the week is done.
      </p>
      <p>
        This is the rulebook behind the bar on the <Link href="/#this-week">homepage</Link>. It is
        public so that anyone watching can check the arithmetic. The rules live in code, not in
        anything I edit day to day, and they apply the same way to everything.
      </p>

      <h2 className={styles.h2}>The week</h2>
      <ul className={styles.list}>
        <li><strong>One point is {MINUTES_PER_POINT} focused minutes.</strong></li>
        <li><strong>The bar is {WEEKLY_BAR} points</strong>, which is {WEEKLY_HOURS} hours. Weeks run Monday to Sunday, Dubai time.</li>
        <li><strong>Full means done.</strong> Nothing more is owed that week. Anything past full shows as extra, and extra is a choice.</li>
        <li><strong>Points only come from finishing something.</strong> Starting, planning and backlog earn nothing.</li>
        <li>Scoring began on {shortDay(SCORE_EPOCH)} {SCORE_EPOCH.slice(0, 4)}. Earlier work shows as progress but earns no points.</li>
      </ul>

      <h2 className={styles.h2}>Two lanes</h2>
      <p>
        One question sorts everything: <em>if this vanished tomorrow, would a date, a person or
        money be affected?</em>
      </p>
      <ul className={styles.list}>
        <li><strong>Quest.</strong> Yes. Exams, deadlines, work, anything someone else depends on. Quests are uncapped.</li>
        <li>
          <strong>Curiosity.</strong> No, and it does not have to. Reading, courses taken for interest,
          the Field Atlas, The List, and anything I write about them. Curiosity fills at most{' '}
          {CURIOSITY_CAP} points of the bar ({fmt(capHours)} hours). Past that it still counts toward
          the lifetime total, never the week.
        </li>
      </ul>
      <p>A textbook or reading takes the lane of whatever it belongs to. On its own, it is curiosity.</p>

      <h2 className={styles.h2}>How things score</h2>
      <ul className={styles.list}>
        <li><strong>Parts.</strong> Work with a fixed end: chapters, modules, sections, pages, milestones. Each finished part is one tap. The parts of an item always add up to exactly its total.</li>
        <li><strong>Repeatables.</strong> Work that can be done any number of times: past papers, practice exams, revision passes. Every one earns the same points. No limit.</li>
        <li><strong>Outcomes.</strong> The result itself: an exam passed, an offer, a paid project. Worth the item&apos;s full estimate, set in advance and paid once. Outcomes go to the lifetime total and the level, never the week. Taking longer or retaking earns points for the extra work, but the outcome never grows.</li>
      </ul>

      <h2 className={styles.h2}>Estimates</h2>
      <ul className={styles.list}>
        <li><strong>Gut estimates are multiplied by {GUT_FACTOR}.</strong> I measured my own estimates running two to three times short. The low end corrects them.</li>
        <li><strong>Formula estimates are multiplied by {FORMULA_FACTOR}</strong>, for breaks and setup: pages at a reading speed, published course hours, walking time from distance and climb.</li>
        <li><strong>Measured time is used as it is</strong>: how long a past paper actually takes to sit and mark.</li>
        <li><strong>Points are frozen when something is set up.</strong> If a rule here ever changes, it applies to new things only, and the change goes in the <Link href="/life/changed-my-mind">changed-my-mind log</Link>. Points already earned are never rewritten.</li>
      </ul>

      <h2 className={styles.h2}>Rates</h2>
      <table className={styles.table}>
        <thead>
          <tr><th>Reading tier</th><th>Speed</th><th>Pages per point</th><th>For</th></tr>
        </thead>
        <tbody>
          {tiers.map(([k, t]) => (
            <tr key={k}>
              <td>{t.label}</td>
              <td>{t.minutesPerPage >= 1 ? `${fmt(t.minutesPerPage)} min a page` : `${fmt(1 / t.minutesPerPage)} pages a min`}</td>
              <td>{fmt(pagesPerPoint(k))}</td>
              <td>{t.example}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className={styles.table}>
        <thead>
          <tr><th>Thing</th><th>How it scores</th></tr>
        </thead>
        <tbody>
          <tr><td>Essay or writeup</td><td>Once, on publish: {fmt(wordsPerPoint)} finished words a point ({WORDS_PER_HOUR} an hour). Edits never score.</td></tr>
          <tr><td>Field Atlas outing</td><td>Gate to gate: {ATLAS.logisticsHours} hours of drive and setup, plus 1 hour per {ATLAS.kmPerHour} km and per {ATLAS.metresClimbPerHour} m of climb, times {FORMULA_FACTOR}. Without route data, a typical day: hiking {ATLAS.defaultHours.hiking} h, diving {ATLAS.defaultHours.diving} h, fishing {ATLAS.defaultHours.fishing} h.</td></tr>
          <tr><td>Task with no estimate</td><td>A gut figure by scope, times {GUT_FACTOR}: {Object.entries(TASK_GUT_HOURS).map(([s, h]) => `${s.replace('-', ' ')} ${fmt(h)} h`).join(', ')}.</td></tr>
          <tr><td>Recurring routine</td><td>Per occurrence, times {GUT_FACTOR}: {Object.entries(RECURRING_GUT_HOURS).map(([s, h]) => `${s} ${fmt(h)} h`).join(', ')}.</td></tr>
          <tr><td>A normal 300-page book</td><td>{estimate.pages(300, 'normal')} points.</td></tr>
        </tbody>
      </table>

      <h2 className={styles.h2}>Levels</h2>
      <p>
        One level per {LEVEL_SIZE.toLocaleString('en-GB')} lifetime points, about five full weeks.
        Levels never go down.
      </p>

      <h2 className={styles.h2}>Load</h2>
      <p>
        Only what is active counts. Every active thing says how many hours a week it takes, and
        together they cannot pass {WEEKLY_HOURS}. Anything that would push the plate over is refused
        until something comes off: a swap, so the load stays level. A task with no figure of its own
        takes its estimate spread over its scope (all of it in a this-week task, a thirteenth in a
        this-quarter one). Backlog counts for nothing until it is swapped in.
      </p>

      <h2 className={styles.h2}>Finishing</h2>
      <p>
        An item reaches 100% when its last part is done. A task then closes as done and a course as
        completed, and both leave the plate. A book closes on its last page. An exam stays until it is
        sat; the result pays its outcome. A new week starts at midnight on Monday, Dubai time, on its
        own; past weeks are never stored separately, they are read back from the dated log in each
        item, so they cannot drift.
      </p>
    </div>
  );
}
