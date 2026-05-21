import Link from 'next/link';
import { Eyebrow, Chip } from '@/components/Primitives';
import { getTasks } from '@/lib/content/tasks';
import { renderMarkdown } from '@/lib/markdown';
import type { TaskScope, TaskStatus, TaskRecurrence } from '@/lib/types';
import styles from './tasks.module.css';

/*
 * Public tasks — what the author is actively working on, published
 * for accountability per BRIEF Part XI's "building in public" framework.
 *
 * Tasks are read-only on the public site. Edits go through the vault
 * (every other content surface uses the same flow). The "interactive"
 * piece is filtering by status via URL params — readers can ask "what
 * is open right now" or "show me what just shipped".
 *
 * Grouped by scope (today, this-week, ..., lifetime) so the reader
 * sees the urgency dimension first; the status pill on each card
 * carries the in-progress/blocked/done signal.
 */

export const revalidate = 60;

export const metadata = {
  title: 'Tasks',
  description:
    'Public task list — what the author is actively working on, with status. Accountability through publication.',
};

const SCOPE_LABEL: Record<TaskScope, string> = {
  today: 'Today',
  'this-week': 'This week',
  'this-month': 'This month',
  'this-quarter': 'This quarter',
  'this-year': 'This year',
  lifetime: 'Lifetime',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'open',
  'in-progress': 'in progress',
  done: 'done',
  dropped: 'dropped',
  blocked: 'blocked',
};

const SCOPE_ORDER: TaskScope[] = [
  'today', 'this-week', 'this-month', 'this-quarter', 'this-year', 'lifetime',
];

const RECURRENCE_LABEL: Record<TaskRecurrence, string> = {
  daily: 'daily', weekly: 'weekly', monthly: 'monthly',
  quarterly: 'quarterly', yearly: 'yearly',
};

/* The 9 Part-15 artifact categories + a few housekeeping ones. The
   labels here are what shows on the task chip; an unknown category
   falls back to the raw slug. */
const CATEGORY_LABEL: Record<string, string> = {
  software: 'software',
  ai: 'AI',
  math: 'math',
  physics: 'physics',
  electronics: 'electronics',
  cybersecurity: 'cybersecurity',
  systems: 'systems',
  philosophy: 'philosophy',
  public: 'public identity',
  routine: 'routine',
  'season-1-main':    'Season 1 — main',
  'season-1-stretch': 'Season 1 — stretch',
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [tasks, sp] = await Promise.all([
    getTasks(),
    searchParams,
  ]);

  const statusFilter   = stringOf(sp.status);
  const categoryFilter = stringOf(sp.category);
  const filtered = tasks.filter((t) => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (categoryFilter && t.category !== categoryFilter) return false;
    return true;
  });

  /* Render the notes markdown for each task up-front so we don't
     await inside the JSX loop. Tasks usually have short notes so the
     fan-out is cheap. */
  const tasksWithHtml = await Promise.all(
    filtered.map(async (t) => ({
      task: t,
      html: t.notes ? await renderMarkdown(t.notes, 'tasks') : null,
    })),
  );

  /* Counts per status across the unfiltered set — drives the filter
     pills so the reader can see "12 open, 3 in-progress, 47 done"
     without clicking through. */
  const statusCounts: Record<TaskStatus, number> = {
    open: 0, 'in-progress': 0, done: 0, dropped: 0, blocked: 0,
  };
  for (const t of tasks) statusCounts[t.status]++;

  /* Category counts — only categories that actually appear in the
     dataset surface as filter pills. Sorted by count descending so
     the busiest categories lead. */
  const categoryCounts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.category) continue;
    categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1);
  }
  const categories = Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1]);

  /* Group by scope, preserving the urgency-ordered scope sequence */
  const grouped = SCOPE_ORDER.map((scope) => ({
    scope,
    items: tasksWithHtml.filter((t) => t.task.scope === scope),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="page page--life">
      <Eyebrow number="11">Life Plan</Eyebrow>
      <p className={styles.kicker}>
        <Link href="/life">← Life Plan</Link>
      </p>
      <h1 className={styles.title}>Tasks</h1>
      <p className={styles.dek}>
        What I am actively working on, with status, published so the
        list itself becomes accountability. Smaller than goals,
        more granular than the Master Plan&apos;s artifact backlog. Edits
        flow through the vault — the public read-only view is here.
      </p>

      <div className={styles.filterRow}>
        <FilterPill href="/life/tasks" label="All" count={tasks.length} active={!statusFilter && !categoryFilter} />
        {(['open', 'in-progress', 'blocked', 'done', 'dropped'] as TaskStatus[]).map((s) => (
          statusCounts[s] > 0 && (
            <FilterPill
              key={s}
              href={withParam('status', s, categoryFilter)}
              label={STATUS_LABEL[s]}
              count={statusCounts[s]}
              active={statusFilter === s}
              status={s}
            />
          )
        ))}
      </div>

      {categories.length > 0 && (
        <div className={styles.filterRowSecondary}>
          <span className={styles.filterRowLabel}>category</span>
          {categories.map(([cat, count]) => (
            <FilterPill
              key={cat}
              href={withParam('category', cat, statusFilter ? `status=${statusFilter}` : '')}
              label={CATEGORY_LABEL[cat] ?? cat}
              count={count}
              active={categoryFilter === cat}
            />
          ))}
        </div>
      )}

      {grouped.length === 0 && (
        <p className={styles.empty}>
          {tasks.length === 0
            ? 'No tasks published yet.'
            : `No tasks match the "${statusFilter}" filter.`}
        </p>
      )}

      {grouped.map(({ scope, items }) => (
        <section key={scope} className={styles.scopeSection}>
          <h2 className={styles.scopeLabel}>{SCOPE_LABEL[scope]}</h2>
          <ol className={styles.list}>
            {items.map(({ task, html }) => (
              <li
                key={task.slug}
                id={task.slug}
                className={`${styles.item} ${styles[`status-${task.status}`] ?? ''}`}
                data-status={task.status}
              >
                <div className={styles.itemHead}>
                  <span className={styles.checkbox} aria-hidden="true">
                    {task.status === 'done' ? '✓' : task.status === 'in-progress' ? '◐' : task.status === 'blocked' ? '✕' : task.status === 'dropped' ? '·' : '○'}
                  </span>
                  <span className={styles.itemTitle}>{task.title}</span>
                  <Chip>{STATUS_LABEL[task.status]}</Chip>
                  {task.recurrence && (
                    <span className={styles.recurrenceBadge} title={`Recurs ${task.recurrence}`}>
                      ↻ {RECURRENCE_LABEL[task.recurrence]}
                    </span>
                  )}
                  {task.category && task.category !== 'routine' && (
                    <span className={styles.categoryBadge}>{CATEGORY_LABEL[task.category] ?? task.category}</span>
                  )}
                  {task.priority === 1 && <span className={styles.priorityFlag}>priority</span>}
                </div>
                {(task.due || task.completed || task.project) && (
                  <p className={styles.itemMeta}>
                    {task.completed && <span>completed {task.completed}</span>}
                    {!task.completed && task.due && <span>due {task.due}</span>}
                    {task.project && (
                      <>
                        {(task.completed || task.due) && <span className={styles.metaSep}>·</span>}
                        <Link href={`/projects/${task.project}`} className={styles.projectLink}>
                          {task.project}
                        </Link>
                      </>
                    )}
                  </p>
                )}
                {html && (
                  <div
                    className={styles.itemNotes}
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function FilterPill({
  href, label, count, active, status,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  status?: TaskStatus;
}) {
  return (
    <Link
      href={href}
      className={`${styles.filterPill} ${active ? styles.filterPillActive : ''} ${status ? styles[`filterPill-${status}`] ?? '' : ''}`}
    >
      <span>{label}</span>
      <span className={styles.filterCount}>{count}</span>
    </Link>
  );
}

function stringOf(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

/* Compose a `/life/tasks?status=…&category=…` URL given a new param +
   the other filter's current value, so filter pills stack rather than
   replace each other. */
function withParam(key: string, value: string, other: string): string {
  const params = new URLSearchParams();
  params.set(key, value);
  if (other) {
    if (other.includes('=')) {
      const [k, v] = other.split('=');
      if (v) params.set(k, v);
    } else if (key === 'status') {
      params.set('category', other);
    } else {
      params.set('status', other);
    }
  }
  return `?${params.toString()}`;
}
