'use client';

/*
 * The one-tap board. Every button sends one QuickRequest and applies the
 * row patch the server returns, so what is on screen is what the vault
 * now says, not a guess. The last change can be undone from the bar that
 * appears at the bottom.
 */

import { useState } from 'react';
import type { QuickRequest } from '@/lib/studio/quick';
import type { DoneGroup } from '@/lib/vault/done-items';
import type { ItemView, ScoreState } from '@/lib/score/compute';
import { READING_TIERS, TEMPLATES, type TemplateId } from '@/lib/score/rules';
import styles from './quick.module.css';

interface Task { slug: string; title: string; status: string; scope: string; category: string | null; recurrence: string | null }
interface Project { slug: string; title: string; status: string }

export interface QuickData {
  tasks: Task[];
  projects: Project[];
  atlas: { slug: string; title: string; groups: DoneGroup[] } | null;
  score: ScoreState | null;
}

type ScoreSlice = Pick<ScoreState, 'week' | 'lifetime' | 'streak' | 'items'>;

interface ApiOk {
  ok: true;
  row: Record<string, unknown>;
  summary: string;
  undo: QuickRequest | null;
  line?: string;
  gained?: number;
  score?: ScoreSlice | null;
}

type Note = { kind: 'ok'; text: string; undo: QuickRequest | null } | { kind: 'error'; text: string };

const THIS_WEEK = new Set(['today', 'this-week']);
const SOON = new Set(['this-month', 'this-quarter', 'this-year']);

/* What the plate shows: everything scored and active, except plain tasks
   (their Done button below scores them) and whole-surface items. */
function onPlate(i: ItemView): boolean {
  if (!i.active || i.surface === 'atlas') return false;
  if (i.surface === 'tasks') return i.repeat.length > 0 || i.parts.some((g) => g.unit !== 'task');
  return true;
}

export function QuickBoard({ initial }: { initial: QuickData }) {
  const [tasks, setTasks] = useState(initial.tasks);
  const [projects, setProjects] = useState(initial.projects);
  const [groups, setGroups] = useState(initial.atlas?.groups ?? []);
  const [score, setScore] = useState<ScoreSlice | null>(initial.score);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  /* Apply the server's row patch to local state. Used for both a tap and
     its undo, which is why it is keyed on the request, not the button. */
  function reflect(req: QuickRequest, res: ApiOk) {
    const r = res.row;
    if (res.score) setScore(res.score);
    if (req.target === 'task') {
      setTasks((list) => list.map((t) => t.slug !== req.slug ? t : {
        ...t, status: String(r.status ?? t.status), scope: String(r.scope ?? t.scope),
      }));
    } else if (req.target === 'project') {
      setProjects((list) => list.map((p) => p.slug !== req.slug ? p : { ...p, status: String(r.status ?? p.status) }));
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
      const gained = (j as ApiOk).gained ?? 0;
      setNote({
        kind: 'ok',
        text: `${(j as ApiOk).summary}${gained > 0 ? ` · +${gained}` : gained < 0 ? ` · ${gained}` : ''}`,
        undo: (j as ApiOk).undo,
      });
    } catch (err) {
      setNote({ kind: 'error', text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const plate = (score?.items ?? []).filter(onPlate);
  const open = tasks.filter((t) => t.status !== 'done' && !t.recurrence);
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
      {/* -- This week ------------------------------------------------ */}
      {score && <WeekCard score={score} load={initial.score?.load ?? null} />}

      {/* -- On the plate --------------------------------------------- */}
      <Section title="On the plate" count={plate.length} empty="Nothing active is scored. Mark something as reading, studying or this week.">
        {plate.map((i) => (
          <li key={i.key} className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowTitle}>{i.title}</span>
              <span className={styles.rowMeta}>
                {[i.summary, i.lane, i.weekPoints ? `+${i.weekPoints} this week` : null].filter(Boolean).join(' · ')}
              </span>
              {i.total > 0 && (
                <span className={styles.miniTrack} aria-hidden="true"><span className={styles.miniFill} style={{ width: `${i.pct}%` }} /></span>
              )}
            </div>
            {i.needsSetup ? (
              <SetupForm
                template={i.needsSetup as TemplateId}
                busy={busy === `${i.key}:setup`}
                disabled={!!busy}
                onSubmit={(inputs) => send({ target: 'score', table: i.table, slug: i.slug, action: 'setup', template: i.needsSetup as TemplateId, inputs }, `${i.key}:setup`)}
              />
            ) : (
              <div className={styles.rowActions}>
                {i.parts.map((g) => g.unit === 'page' ? (
                  <PageLog
                    key={`p${g.index}`}
                    at={g.done}
                    of={g.count}
                    busy={busy === `${i.key}:page`}
                    disabled={!!busy}
                    onLog={(page) => send({ target: 'score', table: i.table, slug: i.slug, action: 'page', page }, `${i.key}:page`)}
                  />
                ) : (
                  <Btn
                    key={`p${g.index}`}
                    primary
                    busy={busy === `${i.key}:p${g.index}`}
                    disabled={!!busy || g.done >= g.count}
                    onClick={() => send({ target: 'score', table: i.table, slug: i.slug, action: 'part', group: g.index }, `${i.key}:p${g.index}`)}
                  >
                    {g.name ? `${g.name}: ` : ''}{g.unit} done
                  </Btn>
                ))}
                {i.repeat.map((g) => (
                  <Btn
                    key={`r${g.index}`}
                    busy={busy === `${i.key}:r${g.index}`}
                    disabled={!!busy}
                    onClick={() => send({ target: 'score', table: i.table, slug: i.slug, action: 'repeat', group: g.index }, `${i.key}:r${g.index}`)}
                  >
                    {g.unit} +{g.points}
                  </Btn>
                ))}
              </div>
            )}
          </li>
        ))}
      </Section>

      {/* -- Building ------------------------------------------------- */}
      <Section title="Building" count={projects.length} empty="No projects yet.">
        {projects.map((p) => {
          const on = p.status === 'active';
          const key = `${p.slug}:active`;
          return (
            <li key={p.slug} className={`${styles.row} ${styles.rowSwitch}`}>
              <div className={styles.rowText}>
                <span className={styles.rowTitle}>{p.title}</span>
                <span className={styles.rowMeta}>{on ? 'actively working on it · shown on the homepage' : 'not working on it right now'}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Actively working on ${p.title}`}
                className={`${styles.switch} ${on ? styles.switchOn : ''}`}
                disabled={!!busy}
                aria-busy={busy === key || undefined}
                onClick={() => send({ target: 'project', slug: p.slug, action: 'set-active', on: !on }, key)}
              >
                <span className={styles.switchKnob} />
              </button>
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

function WeekCard({ score, load }: { score: ScoreSlice; load: ScoreState['load'] | null }) {
  const { week, lifetime, streak } = score;
  const bar = 200;
  const q = Math.min(100, (week.quest / bar) * 100);
  const c = Math.min(100 - q, (week.curiosityCounted / bar) * 100);
  return (
    <section className={styles.streak} aria-label="This week">
      <div className={styles.streakFigure}>
        <span className={styles.streakNum}>{week.bar}</span>
        <span className={styles.streakUnit}>of {bar} this week{week.full ? ' · full' : ''}</span>
      </div>
      <div className={styles.weekTrack} aria-hidden="true">
        <span className={styles.weekQuest} style={{ width: `${q}%` }} />
        <span className={styles.weekCur} style={{ width: `${c}%`, left: `${q}%` }} />
      </div>
      <p className={styles.streakNote}>
        Quests {week.quest} · curiosity {week.curiosityCounted} of 80
        {' · '}level {lifetime.level} · {lifetime.points} lifetime · {streak} full {streak === 1 ? 'week' : 'weeks'} in a row
        {load && load.hours > 0 ? ` · ${load.hours} of ${load.capacity} hours committed` : ''}
      </p>
    </section>
  );
}

function SetupForm({ template, busy, disabled, onSubmit }: {
  template: TemplateId; busy: boolean; disabled: boolean;
  onSubmit: (inputs: Record<string, string | number>) => void;
}) {
  const spec = TEMPLATES[template];
  const [vals, setVals] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setVals((x) => ({ ...x, [k]: v }));
  return (
    <form
      className={styles.setup}
      onSubmit={(e) => {
        e.preventDefault();
        const inputs: Record<string, string | number> = {};
        for (const f of spec.fields) {
          const v = vals[f.key];
          if (v === undefined || v === '') continue;
          inputs[f.key] = f.kind === 'number' ? Number(v) : v;
        }
        onSubmit(inputs);
      }}
    >
      <p className={styles.setupHead}>Set up scoring · {spec.label}. Points are frozen once saved.</p>
      {spec.fields.map((f) => (
        <label key={f.key} className={styles.setupField}>
          <span>{f.label}{f.optional ? ' (optional)' : ''}</span>
          {f.kind === 'tier' ? (
            <select value={vals[f.key] ?? 'normal'} onChange={(e) => set(f.key, e.target.value)}>
              {Object.entries(READING_TIERS).map(([k, t]) => <option key={k} value={k}>{t.label} · {t.example}</option>)}
            </select>
          ) : f.kind === 'lane' ? (
            <select value={vals[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">Default for this kind</option>
              <option value="quest">Quest</option>
              <option value="curiosity">Curiosity</option>
            </select>
          ) : (
            <input
              type={f.kind === 'number' ? 'number' : 'text'}
              inputMode={f.kind === 'number' ? 'decimal' : undefined}
              step="any"
              min={f.kind === 'number' ? 0 : undefined}
              placeholder={f.hint}
              required={!f.optional}
              value={vals[f.key] ?? ''}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
        </label>
      ))}
      <Btn primary busy={busy} disabled={disabled} onClick={() => undefined} submit>Save</Btn>
    </form>
  );
}

function PageLog({ at, of, busy, disabled, onLog }: {
  at: number; of: number; busy: boolean; disabled: boolean; onLog: (page: number) => void;
}) {
  const [page, setPage] = useState('');
  return (
    <form
      className={styles.pageLog}
      onSubmit={(e) => { e.preventDefault(); const n = Number(page); if (n > at) { onLog(n); setPage(''); } }}
    >
      <label>
        <span className={styles.srOnly}>Page you are on</span>
        <input type="number" inputMode="numeric" min={at + 1} max={of} placeholder={`page (now ${at})`} value={page} onChange={(e) => setPage(e.target.value)} />
      </label>
      <Btn primary busy={busy} disabled={disabled || !page || Number(page) <= at} onClick={() => undefined} submit>Log page</Btn>
    </form>
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

function Btn({ children, onClick, primary, busy, disabled, submit }: {
  children: React.ReactNode; onClick: () => void; primary?: boolean; busy?: boolean; disabled?: boolean; submit?: boolean;
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      className={`${styles.btn} ${primary ? styles.btnPrimary : ''} ${busy ? styles.btnBusy : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
    >
      {children}
    </button>
  );
}
