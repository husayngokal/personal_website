'use client';

/*
 * The one-tap board. Every button sends one QuickRequest and applies the
 * row patch the server returns, so what is on screen is what the vault
 * now says, not a guess. The last change can be undone from the bar that
 * appears at the bottom.
 */

import { useEffect, useRef, useState } from 'react';
import { ScoreMeter } from '@/components/score/ScoreMeter';
import { emitScoreFx, setSoundOn, soundOn, unlockAudio } from '@/lib/score/fx';
import { getBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { TASK_GUT_HOURS, atlasPoints, estimate, partGain } from '@/lib/score/rules';
import type { QuickRequest } from '@/lib/studio/quick';
import type { DoneGroup } from '@/lib/vault/done-items';
import type { ItemView, ScoreState } from '@/lib/score/compute';
import { READING_TIERS, TEMPLATES, type TemplateId } from '@/lib/score/rules';

interface SwapPlateItem { table: string; slug: string; title: string; hours: number | null; parkable: boolean }
interface SwapState { req: QuickRequest; key: string; detail: string; plate: SwapPlateItem[] }
import styles from './quick.module.css';

interface Task { slug: string; title: string; status: string; scope: string; category: string | null; recurrence: string | null }
interface Project { slug: string; title: string; status: string }

export interface QuickData {
  tasks: Task[];
  projects: Project[];
  atlas: { slug: string; title: string; groups: DoneGroup[] } | null;
  score: ScoreState | null;
}

type ScoreSlice = Pick<ScoreState, 'week' | 'lifetime' | 'streak' | 'items'> & { load?: ScoreState['load'] };

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
  /* Where the last press landed (effects start there) and the current run
     of quick taps (each one in a run pitches higher). */
  const press = useRef<{ x: number; y: number } | null>(null);
  const run = useRef<{ at: number; n: number }>({ at: 0, n: 0 });
  const [swap, setSwap] = useState<SwapState | null>(null);

  /* The server recomputes the full score after answering; it arrives here
     over Realtime and settles whatever the prediction got wrong. */
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`quick_${Math.random().toString(36).slice(2, 10)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'current_state', filter: 'key=eq.score' }, (payload) => {
        const v = (payload.new as { value?: ScoreState } | null)?.value;
        if (v?.version === 1) setScore({ week: v.week, lifetime: v.lifetime, streak: v.streak, items: v.items, load: v.load });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

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

  /* What a tap is worth, worked out here from the same frozen numbers
     the server uses, so the effects can fire the instant the button goes
     down instead of after the commit. Null when it cannot be known. */
  function predict(req: QuickRequest): { gained: number; lane: 'quest' | 'curiosity'; itemKey?: string; group?: number; qty?: number } | null {
    if (!score) return null;
    if (req.target === 'score') {
      const it = score.items.find((i) => i.table === req.table && i.slug === req.slug);
      if (!it) return null;
      if (req.action === 'part') {
        const g = it.parts[req.group];
        if (!g || g.done >= g.count) return null;
        const qty = req.qty ?? 1;
        return { gained: partGain(g.points, g.count, g.done, g.done + qty), lane: it.lane, itemKey: it.key, group: g.index, qty };
      }
      if (req.action === 'repeat') {
        const g = it.repeat[req.group];
        return g ? { gained: g.points, lane: it.lane, itemKey: it.key } : null;
      }
      if (req.action === 'page') {
        const g = it.parts.find((x) => x.unit === 'page');
        if (!g || req.page <= g.done) return null;
        return { gained: partGain(g.points, g.count, g.done, req.page), lane: it.lane, itemKey: it.key, group: g.index, qty: Math.min(g.count, req.page) - g.done };
      }
      return null;
    }
    if (req.target === 'task' && req.action === 'done') {
      const it = score.items.find((i) => i.table === 'tasks' && i.slug === req.slug);
      if (it && it.total > 0) return { gained: Math.max(0, it.total - it.earned), lane: it.lane };
      const t = tasks.find((x) => x.slug === req.slug);
      return t ? { gained: estimate.gut(TASK_GUT_HOURS[t.scope] ?? 4), lane: 'quest' } : null;
    }
    if (req.target === 'atlas' && req.action === 'done') {
      for (const g of groups) {
        const i = g.items.find((x) => x.line === req.line);
        if (i) return { gained: atlasPoints(i.text, g.heading), lane: 'curiosity' };
      }
    }
    return null;
  }

  function withGain(sl: ScoreSlice, p: NonNullable<ReturnType<typeof predict>>, sign = 1): ScoreSlice {
    const w = { ...sl.week };
    if (p.lane === 'quest') w.quest += sign * p.gained;
    else w.curiosity += sign * p.gained;
    w.curiosityCounted = Math.min(w.curiosity, 80);
    w.bar = w.quest + w.curiosityCounted;
    w.full = w.bar >= 200;
    w.extra = Math.max(0, w.bar - 200);
    const points = sl.lifetime.points + sign * p.gained;
    const items = p.itemKey === undefined ? sl.items : sl.items.map((i) => i.key !== p.itemKey ? i : {
      ...i,
      weekPoints: i.weekPoints + sign * p.gained,
      parts: i.parts.map((g) => g.index !== p.group ? g : { ...g, done: Math.min(g.count, g.done + sign * (p.qty ?? 0)), logged: g.logged + sign }),
    });
    return {
      ...sl, week: w, items,
      lifetime: { ...sl.lifetime, points, level: Math.floor(points / 1000) + 1, intoLevel: points % 1000 },
    };
  }

  async function send(req: QuickRequest, key: string) {
    if (busy) return;
    setBusy(key);

    /* Fire first, save second. If the save fails, the bar steps back. */
    const snapshot = score;
    const p = predict(req);
    let optimistic: ScoreSlice | null = null;
    if (p && p.gained > 0 && snapshot) {
      optimistic = withGain(snapshot, p);
      const now = Date.now();
      run.current = now - run.current.at < 90_000 ? { at: now, n: run.current.n + 1 } : { at: now, n: 1 };
      setScore(optimistic);
      emitScoreFx({
        before: snapshot.week, after: optimistic.week, barMax: 200,
        levelBefore: snapshot.lifetime.level, levelAfter: optimistic.lifetime.level,
        gained: p.gained, origin: press.current ?? undefined, combo: run.current.n, sound: true,
      });
    }
    const rollback = () => {
      if (!optimistic || !snapshot) return;
      setScore(snapshot);
      emitScoreFx({
        before: optimistic.week, after: snapshot.week, barMax: 200,
        levelBefore: optimistic.lifetime.level, levelAfter: snapshot.lifetime.level, gained: -(p?.gained ?? 0),
      });
    };

    try {
      const res = await fetch('/api/studio/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      const j = await res.json();
      if (!res.ok) {
        rollback();
        if (j.error === 'over-capacity') {
          setSwap({ req, key, detail: j.detail, plate: j.plate ?? [] });
          return;
        }
        setNote({
          kind: 'error',
          text: res.status === 401 ? 'Signed out. Reload and sign in again.'
            : res.status === 409 ? (j.detail || 'That entry changed elsewhere. Reload the page.')
            : j.detail || j.error || 'Could not save.',
        });
        return;
      }
      reflect(req, j as ApiOk);
      setNote({
        kind: 'ok',
        text: `${(j as ApiOk).summary}${p && p.gained > 0 ? ` · +${p.gained}` : ''}`,
        undo: (j as ApiOk).undo,
      });
    } catch (err) {
      rollback();
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

  const taskRow = (t: Task) => {
    const sized = score?.items.find((i) => i.table === 'tasks' && i.slug === t.slug);
    const worth = sized && sized.total > 0 ? sized.total : estimate.gut(TASK_GUT_HOURS[t.scope] ?? 4);
    return (
    <li key={t.slug} className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{t.title}</span>
        <span className={styles.rowMeta}>{[t.category, t.scope.replace('-', ' '), `${worth} points`].filter(Boolean).join(' · ')}</span>
      </div>
      {!sized?.hasBlock && (<details className={styles.parts}>
        <summary className={styles.partsHead}>Size it</summary>
        <SetupForm
          template="task"
          busy={busy === `${t.slug}:setup`}
          disabled={!!busy}
          onSubmit={(inputs) => send({ target: 'score', table: 'tasks', slug: t.slug, action: 'setup', template: 'task', inputs }, `${t.slug}:setup`)}
        />
      </details>)}
      <div className={styles.rowActions}>
        <Btn primary busy={busy === `${t.slug}:done`} disabled={!!busy} onClick={() => send({ target: 'task', slug: t.slug, action: 'done' }, `${t.slug}:done`)}>Done</Btn>
        {THIS_WEEK.has(t.scope)
          ? <Btn busy={busy === `${t.slug}:later`} disabled={!!busy} onClick={() => send({ target: 'task', slug: t.slug, action: 'later' }, `${t.slug}:later`)}>Not now</Btn>
          : <Btn busy={busy === `${t.slug}:week`} disabled={!!busy} onClick={() => send({ target: 'task', slug: t.slug, action: 'this-week' }, `${t.slug}:week`)}>This week</Btn>}
      </div>
    </li>
    );
  };

  return (
    <div
      className={styles.board}
      onPointerDownCapture={(e) => { press.current = { x: e.clientX, y: e.clientY }; unlockAudio(); }}
    >
      {/* -- This week ------------------------------------------------ */}
      {score && <WeekCard score={score} load={score.load ?? initial.score?.load ?? null} />}

      {/* -- Swap: the week is full ----------------------------------- */}
      {swap && (
        <section className={styles.swap} role="alertdialog" aria-label="Over the weekly hours">
          <p className={styles.swapHead}>{swap.detail}</p>
          <ul className={styles.rows}>
            {swap.plate.map((x) => (
              <li key={`${x.table}:${x.slug}`} className={`${styles.row} ${styles.rowSwitch}`}>
                <div className={styles.rowText}>
                  <span className={styles.rowTitle}>{x.title}</span>
                  <span className={styles.rowMeta}>{x.hours ?? 0} hours a week{x.parkable ? '' : ' · exam, stays until it is sat'}</span>
                </div>
                {x.parkable && (
                  <Btn
                    busy={busy === `park:${x.slug}`}
                    disabled={!!busy}
                    onClick={() => {
                      void send({ target: 'score', table: x.table, slug: x.slug, action: 'park' }, `park:${x.slug}`)
                        .then(() => setSwap((sw) => sw && { ...sw, plate: sw.plate.filter((y) => y.slug !== x.slug) }));
                    }}
                  >
                    Take off the plate
                  </Btn>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.rowActions}>
            <Btn primary disabled={!!busy} onClick={() => { const sw = swap; setSwap(null); void send(sw.req, sw.key); }}>Try again</Btn>
            <Btn disabled={!!busy} onClick={() => setSwap(null)}>Cancel</Btn>
          </div>
        </section>
      )}

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
                {i.parts.filter((g) => g.unit === 'page' || g.current).map((g) => g.unit === 'page' ? (
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
                    disabled={!!busy}
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
                {i.table !== 'study_credentials' && (
                  <Btn
                    busy={busy === `${i.key}:park`}
                    disabled={!!busy}
                    onClick={() => send({ target: 'score', table: i.table, slug: i.slug, action: 'park' }, `${i.key}:park`)}
                  >
                    Off the plate
                  </Btn>
                )}
              </div>
            )}
            {!i.needsSetup && i.parts.length > 0 && !i.parts.some((g) => g.unit === 'page') && (
              <PartsEditor
                item={i}
                busy={busy}
                send={(req, key) => send({ target: 'score', table: i.table, slug: i.slug, ...req } as QuickRequest, key)}
              />
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
  const [sound, setSound] = useState(true);
  useEffect(() => { setSound(soundOn()); }, []);
  return (
    <section className={styles.streak} aria-label="This week">
      <ScoreMeter
        compact
        week={score.week}
        barMax={200}
        cap={80}
        level={score.lifetime.level}
        lifetime={score.lifetime.points}
        streak={score.streak}
      >
        <button
          type="button"
          className={styles.soundBtn}
          aria-pressed={sound}
          onClick={() => { setSoundOn(!sound); setSound(!sound); }}
        >
          Sound {sound ? 'on' : 'off'}
        </button>
        {load && (
          <p className={styles.load}>
            <span className={styles.loadTrack} aria-hidden="true">
              <span className={styles.loadFill} style={{ width: `${Math.min(100, (load.hours / load.capacity) * 100)}%` }} />
            </span>
            {Math.round(load.hours * 10) / 10} of {load.capacity} hours a week on the plate
          </p>
        )}
      </ScoreMeter>
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

function pluralUnit(u: string): string {
  return /(s|x|ch|sh)$/.test(u) ? `${u}es` : /[^aeiou]y$/.test(u) ? `${u.slice(0, -1)}ies` : `${u}s`;
}

type GroupAction =
  | { action: 'part'; group: number }
  | { action: 'edit-group'; group: number; name?: string; count?: number; prior?: number }
  | { action: 'remove-group'; group: number }
  | { action: 'add-group'; unit: string; name?: string; count: number; hours: number; basis: 'gut' | 'measured' };

/* Every part group of an item, editable: name, how many parts, how many
   were done before scoring. Counts lock once something is logged in that
   group (the engine refuses otherwise), so earned points never shift. */
function PartsEditor({ item, busy, send }: {
  item: ItemView; busy: string | null; send: (req: GroupAction, key: string) => void;
}) {
  const [adding, setAdding] = useState({ name: '', unit: item.parts[0]?.unit ?? 'chapter', count: '', hours: '', basis: 'gut' });
  return (
    <details className={styles.parts}>
      <summary className={styles.partsHead}>Edit parts · {item.parts.length} {item.parts.length === 1 ? 'group' : 'groups'}</summary>
      <ul className={styles.partsList}>
        {item.parts.map((g) => (
          <GroupRow key={`${item.key}-${g.index}-${g.count}-${g.prior}-${g.name ?? ''}`} itemKey={item.key} g={g} busy={busy} send={send} />
        ))}
      </ul>
      <form
        className={styles.partsAdd}
        onSubmit={(e) => {
          e.preventDefault();
          send({
            action: 'add-group', unit: adding.unit, name: adding.name || undefined,
            count: Number(adding.count), hours: Number(adding.hours), basis: adding.basis as 'gut' | 'measured',
          }, `${item.key}:add`);
          setAdding((a) => ({ ...a, name: '', count: '', hours: '' }));
        }}
      >
        <p className={styles.setupHead}>Add a group (a book, a module set). Its points are worked out from the hours and frozen.</p>
        <div className={styles.partsGrid}>
          <label className={styles.setupField}><span>Name</span><input value={adding.name} placeholder="Tort Law (Book 3)" onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></label>
          <label className={styles.setupField}><span>Unit</span><input required value={adding.unit} onChange={(e) => setAdding({ ...adding, unit: e.target.value })} /></label>
          <label className={styles.setupField}><span>How many</span><input required type="number" min={1} inputMode="numeric" value={adding.count} onChange={(e) => setAdding({ ...adding, count: e.target.value })} /></label>
          <label className={styles.setupField}><span>Hours, all in</span><input required type="number" min={0} step="any" inputMode="decimal" value={adding.hours} onChange={(e) => setAdding({ ...adding, hours: e.target.value })} /></label>
          <label className={styles.setupField}>
            <span>Those hours are</span>
            <select value={adding.basis} onChange={(e) => setAdding({ ...adding, basis: e.target.value })}>
              <option value="gut">a guess (doubled)</option>
              <option value="measured">measured (used as is)</option>
            </select>
          </label>
        </div>
        <Btn primary busy={busy === `${item.key}:add`} disabled={!!busy} onClick={() => undefined} submit>Add group</Btn>
      </form>
    </details>
  );
}

function GroupRow({ itemKey, g, busy, send }: {
  itemKey: string; g: ItemView['parts'][number]; busy: string | null; send: (req: GroupAction, key: string) => void;
}) {
  const [name, setName] = useState(g.name ?? '');
  const [count, setCount] = useState(String(g.count));
  const [prior, setPrior] = useState(String(g.prior));
  const locked = g.logged > 0;
  const key = `${itemKey}:g${g.index}`;
  return (
    <li className={styles.groupRow}>
      <p className={styles.groupTitle}>
        {g.name ?? g.unit} · {g.done} of {g.count} {g.count === 1 ? g.unit : pluralUnit(g.unit)} · {g.points} points
        {locked ? ' · count locked' : ''}
      </p>
      <form
        className={styles.partsGrid}
        onSubmit={(e) => {
          e.preventDefault();
          send({
            action: 'edit-group', group: g.index, name,
            ...(locked ? {} : { count: Number(count), prior: Number(prior || 0) }),
          }, `${key}:edit`);
        }}
      >
        <label className={styles.setupField}><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className={styles.setupField}><span>How many</span><input type="number" min={1} disabled={locked} value={count} onChange={(e) => setCount(e.target.value)} /></label>
        <label className={styles.setupField}><span>Done before scoring</span><input type="number" min={0} disabled={locked} value={prior} onChange={(e) => setPrior(e.target.value)} /></label>
        <div className={styles.rowActions}>
          <Btn busy={busy === `${key}:edit`} disabled={!!busy} onClick={() => undefined} submit>Save</Btn>
          <Btn primary busy={busy === `${key}:part`} disabled={!!busy || g.done >= g.count} onClick={() => send({ action: 'part', group: g.index }, `${key}:part`)}>{g.unit} done</Btn>
          {!locked && <Btn busy={busy === `${key}:rm`} disabled={!!busy} onClick={() => send({ action: 'remove-group', group: g.index }, `${key}:rm`)}>Remove</Btn>}
        </div>
      </form>
    </li>
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
