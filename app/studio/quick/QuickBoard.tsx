'use client';

/*
 * The one-tap board. Every button sends one QuickRequest and applies the
 * row patch the server returns, so what is on screen is what the vault
 * now says, not a guess. The last change can be undone from the bar that
 * appears at the bottom.
 */

import { useMemo, useState } from 'react';
import { authorDay, computeStreak } from '@/lib/content/streak';
import type { QuickRequest } from '@/lib/studio/quick';
import type { DoneGroup } from '@/lib/vault/done-items';
import styles from './quick.module.css';

interface Book { slug: string; title: string; author: string; status: string; progressPct: number }
interface Task { slug: string; title: string; status: string; scope: string; category: string | null }
interface Project { slug: string; title: string; lastActive: string | null }

export interface QuickData {
  books: Book[];
  tasks: Task[];
  projects: Project[];
  atlas: { slug: string; title: string; groups: DoneGroup[] } | null;
  activeDays: string[];
}

interface ApiOk {
  ok: true;
  row: Record<string, unknown>;
  summary: string;
  undo: QuickRequest | null;
  line?: string;
}

type Note = { kind: 'ok'; text: string; undo: QuickRequest | null } | { kind: 'error'; text: string };

const THIS_WEEK = new Set(['today', 'this-week']);
const SOON = new Set(['this-month', 'this-quarter', 'this-year']);

export function QuickBoard({ initial }: { initial: QuickData }) {
  const [books, setBooks] = useState(initial.books);
  const [tasks, setTasks] = useState(initial.tasks);
  const [projects, setProjects] = useState(initial.projects);
  const [groups, setGroups] = useState(initial.atlas?.groups ?? []);
  const [activeDays, setActiveDays] = useState(initial.activeDays);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  const streak = useMemo(() => computeStreak(activeDays), [activeDays]);

  /* Apply the server's row patch to local state. Used for both a tap and
     its undo, which is why it is keyed on the request, not the button. */
  function reflect(req: QuickRequest, res: ApiOk) {
    const r = res.row;
    if (req.target === 'book') {
      setBooks((list) => list.map((b) => b.slug !== req.slug ? b : {
        ...b, status: String(r.status ?? b.status), progressPct: Number(r.progress_pct ?? b.progressPct),
      }));
    } else if (req.target === 'task') {
      setTasks((list) => list.map((t) => t.slug !== req.slug ? t : {
        ...t, status: String(r.status ?? t.status), scope: String(r.scope ?? t.scope),
      }));
    } else if (req.target === 'project') {
      setProjects((list) => list.map((p) => p.slug !== req.slug ? p : { ...p, lastActive: String(r.last_active ?? p.lastActive) }));
    } else if (req.target === 'atlas' && res.line) {
      const next = res.line;
      const done = req.action === 'done';
      setGroups((gs) => gs.map((g) => ({
        ...g, items: g.items.map((i) => i.line !== req.line ? i : { ...i, line: next, done }),
      })));
    }
  }

  async function send(req: QuickRequest, key: string) {
    if (busy) return;
    setBusy(key);
    try {
      const res = await fetch('/api/studio/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const j = await res.json();
      if (!res.ok) {
        setNote({
          kind: 'error',
          text: res.status === 401 ? 'Signed out. Reload and sign in again.'
            : res.status === 409 ? 'That entry changed elsewhere. Reload the page.'
            : j.detail || j.error || 'Could not save.',
        });
        return;
      }
      reflect(req, j as ApiOk);
      const today = authorDay();
      setActiveDays((d) => (d.includes(today) ? d : [...d, today]));
      setNote({ kind: 'ok', text: (j as ApiOk).summary, undo: (j as ApiOk).undo });
    } catch (err) {
      setNote({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const reading = books.filter((b) => b.status === 'reading');
  const open = tasks.filter((t) => t.status !== 'done');
  const week = open.filter((t) => THIS_WEEK.has(t.scope));
  const soon = open.filter((t) => SOON.has(t.scope));
  const later = open.filter((t) => !THIS_WEEK.has(t.scope) && !SOON.has(t.scope));

  const taskRow = (t: Task) => (
    <li key={t.slug} className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{t.title}</span>
        <span className={styles.rowMeta}>{[t.category, t.scope.replace('-', ' ')].filter(Boolean).join(' · ')}</span>
      </div>
      <div className={styles.rowActions}>
        <Btn primary busy={busy === `${t.slug}:done`} disabled={!!busy} onClick={() => send({ target: 'task', slug: t.slug, action: 'done' }, `${t.slug}:done`)}>Done</Btn>
        {THIS_WEEK.has(t.scope)
          ? <Btn busy={busy === `${t.slug}:later`} disabled={!!busy} onClick={() => send({ target: 'task', slug: t.slug, action: 'later' }, `${t.slug}:later`)}>Not now</Btn>
          : <Btn busy={busy === `${t.slug}:week`} disabled={!!busy} onClick={() => send({ target: 'task', slug: t.slug, action: 'this-week' }, `${t.slug}:week`)}>This week</Btn>}
      </div>
    </li>
  );

  return (
    <div className={styles.board}>
      {/* -- Streak --------------------------------------------------- */}
      <section className={styles.streak} aria-label="Activity streak">
        <div className={styles.streakFigure}>
          <span className={styles.streakNum}>{streak.weeks}</span>
          <span className={styles.streakUnit}>week streak</span>
        </div>
        <ol className={styles.weeks} aria-label="Last 12 weeks, oldest first">
          {streak.recent.map((on, i) => (
            <li
              key={i}
              className={`${styles.week} ${on ? styles.weekOn : ''} ${i === streak.recent.length - 1 ? styles.weekNow : ''}`}
              aria-label={`${i === streak.recent.length - 1 ? 'This week' : `${streak.recent.length - 1 - i} weeks ago`}: ${on ? 'active' : 'nothing logged'}`}
            />
          ))}
        </ol>
        <p className={styles.streakNote}>
          {streak.thisWeekActive
            ? `This week is counted. ${streak.daysThisWeek} active ${streak.daysThisWeek === 1 ? 'day' : 'days'} so far.`
            : streak.weeks > 0
              ? 'Nothing logged this week yet. One tap below keeps the streak alive.'
              : 'No streak running. One tap below starts one.'}
        </p>
      </section>

      {/* -- Reading -------------------------------------------------- */}
      <Section title="Reading" count={reading.length} empty="No books marked as reading.">
        {reading.map((b) => (
          <li key={b.slug} className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>{b.title}</span>
              <span className={styles.rowMeta}>{b.author} · {b.progressPct}%</span>
            </div>
            <div className={styles.rowActions}>
              <Btn primary busy={busy === `${b.slug}:5`} disabled={!!busy || b.progressPct >= 100} onClick={() => send({ target: 'book', slug: b.slug, action: 'bump', by: 5 }, `${b.slug}:5`)}>+5%</Btn>
              <Btn primary busy={busy === `${b.slug}:10`} disabled={!!busy || b.progressPct >= 100} onClick={() => send({ target: 'book', slug: b.slug, action: 'bump', by: 10 }, `${b.slug}:10`)}>+10%</Btn>
              <Btn busy={busy === `${b.slug}:fin`} disabled={!!busy} onClick={() => send({ target: 'book', slug: b.slug, action: 'finish' }, `${b.slug}:fin`)}>Finished</Btn>
              <Btn busy={busy === `${b.slug}:shelve`} disabled={!!busy} onClick={() => send({ target: 'book', slug: b.slug, action: 'shelve' }, `${b.slug}:shelve`)}>Shelve</Btn>
            </div>
          </li>
        ))}
      </Section>

      {/* -- Building ------------------------------------------------- */}
      <Section title="Building" count={projects.length} empty="No active project.">
        {projects.map((p) => {
          const today = p.lastActive?.slice(0, 10) === authorDay();
          return (
            <li key={p.slug} className={styles.row}>
              <div className={styles.rowText}>
                <span className={styles.rowTitle}>{p.title}</span>
                <span className={styles.rowMeta}>{today ? 'active today' : p.lastActive ? `last active ${p.lastActive.slice(0, 10)}` : 'no activity logged'}</span>
              </div>
              <div className={styles.rowActions}>
                <Btn primary busy={busy === `${p.slug}:active`} disabled={!!busy || today} onClick={() => send({ target: 'project', slug: p.slug, action: 'active-today' }, `${p.slug}:active`)}>Worked on it today</Btn>
              </div>
            </li>
          );
        })}
      </Section>

      {/* -- Tasks ---------------------------------------------------- */}
      <Section title="This week" count={week.length} empty="Nothing scoped to this week. Pull a task in from below.">
        {week.map(taskRow)}
      </Section>
      {soon.length > 0 && (
        <Section title="This month, quarter or year" count={soon.length}>
          {soon.map(taskRow)}
        </Section>
      )}
      {later.length > 0 && (
        <details className={styles.fold}>
          <summary className={styles.foldHead}>Later <span className={styles.count}>{later.length}</span></summary>
          <ul className={styles.rows}>{later.map(taskRow)}</ul>
        </details>
      )}

      {/* -- Field Atlas ---------------------------------------------- */}
      {groups.map((g) => {
        const doneCount = g.items.filter((i) => i.done).length;
        return (
          <details key={g.heading} className={styles.fold}>
            <summary className={styles.foldHead}>
              Field Atlas · {g.heading} <span className={styles.count}>{doneCount} of {g.items.length} done</span>
            </summary>
            <ul className={styles.rows}>
              {g.items.map((i) => {
                const [name, ...rest] = i.text.split(' · ');
                return (
                  <li key={`${g.heading}-${i.number}`} className={styles.row}>
                    <div className={styles.rowText}>
                      <span className={`${styles.rowTitle} ${i.done ? styles.struck : ''}`}>{i.number}. {name}</span>
                      {rest.length > 0 && <span className={styles.rowMeta}>{rest.join(' · ')}</span>}
                    </div>
                    <div className={styles.rowActions}>
                      {i.done
                        ? <Btn busy={busy === `atlas:${i.line}`} disabled={!!busy} onClick={() => send({ target: 'atlas', slug: initial.atlas!.slug, action: 'undone', line: i.line }, `atlas:${i.line}`)}>Not done</Btn>
                        : <Btn primary busy={busy === `atlas:${i.line}`} disabled={!!busy} onClick={() => send({ target: 'atlas', slug: initial.atlas!.slug, action: 'done', line: i.line }, `atlas:${i.line}`)}>Done</Btn>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}

      {/* -- Result bar ----------------------------------------------- */}
      {note && (
        <div className={`${styles.bar} ${note.kind === 'error' ? styles.barError : ''}`} role="status">
          <span className={styles.barText}>{note.kind === 'ok' ? `Saved. ${note.text}` : note.text}</span>
          {note.kind === 'ok' && note.undo && (
            <button
              type="button"
              className={styles.barBtn}
              disabled={!!busy}
              onClick={() => { const u = note.undo!; void send(u, 'undo'); }}
            >
              {busy === 'undo' ? 'Undoing' : 'Undo'}
            </button>
          )}
          <button type="button" className={styles.barBtn} onClick={() => setNote(null)}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionHead}>{title} <span className={styles.count}>{count}</span></h2>
      {count === 0 && empty ? <p className={styles.empty}>{empty}</p> : <ul className={styles.rows}>{children}</ul>}
    </section>
  );
}

function Btn({ children, onClick, primary, busy, disabled }: {
  children: React.ReactNode; onClick: () => void; primary?: boolean; busy?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${primary ? styles.btnPrimary : ''} ${busy ? styles.btnBusy : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
    >
      {children}
    </button>
  );
}
