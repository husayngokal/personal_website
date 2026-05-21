import Link from 'next/link';
import { Eyebrow, Chip, StatusPill } from '@/components/Primitives';
import { getWriteups } from '@/lib/content/writeups';
import styles from './writeups.module.css';

/*
 * Writeups index — unified surface for both machine writeups (HTB /
 * THM / CTF) and technique notes (tool references, methodology,
 * concepts). The brief justification for one surface vs two is that
 * both are reference material a reader of the site benefits from
 * having indexed together — "how I do reconnaissance" lives near
 * "how I rooted Bashed."
 *
 * Filters: kind (machine | technique), platform, difficulty, OS,
 * status, category. Sidebar omits any facet that has zero entries
 * to keep the UI honest as the surface grows.
 */

export const metadata = {
  title: 'Writeups',
  description:
    'Security writeups, tool references, technique and methodology notes. The technical knowledge base.',
};

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

const PLATFORM_LABEL: Record<string, string> = {
  htb:         'HackTheBox',
  thm:         'TryHackMe',
  vulnhub:     'VulnHub',
  portswigger: 'PortSwigger',
  ctf:         'CTF',
  other:       'Other',
};

const DIFFICULTY_ORDER: Record<string, number> = {
  easy: 0, medium: 1, hard: 2, insane: 3,
};

const STATUS_ORDER: Record<string, number> = {
  rooted: 0, foothold: 1, attempted: 2, abandoned: 3,
};

export default async function WriteupsIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const writeups = await getWriteups();
  const sp = await searchParams;

  const kindFilter       = stringOf(sp.kind);
  const platformFilter   = stringOf(sp.platform);
  const difficultyFilter = stringOf(sp.difficulty);
  const osFilter         = stringOf(sp.os);
  const statusFilter     = stringOf(sp.status);
  const categoryFilter   = stringOf(sp.category);

  /* Apply filters — kept independent so any combination works */
  const filtered = writeups.filter((w) => {
    if (kindFilter       && w.kind       !== kindFilter)       return false;
    if (platformFilter   && w.platform   !== platformFilter)   return false;
    if (difficultyFilter && w.difficulty !== difficultyFilter) return false;
    if (osFilter         && w.os         !== osFilter)         return false;
    if (statusFilter     && w.status     !== statusFilter)     return false;
    if (categoryFilter   && w.category   !== categoryFilter)   return false;
    return true;
  });

  /* Sort: machines first (rooted before foothold before attempted),
     then techniques alphabetically. Newest date breaks ties. */
  const sorted = [...filtered].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'machine' ? -1 : 1;
    if (a.kind === 'machine') {
      const s = (STATUS_ORDER[a.status ?? ''] ?? 9) - (STATUS_ORDER[b.status ?? ''] ?? 9);
      if (s !== 0) return s;
      const d = (DIFFICULTY_ORDER[a.difficulty ?? ''] ?? 9) - (DIFFICULTY_ORDER[b.difficulty ?? ''] ?? 9);
      if (d !== 0) return d;
    } else {
      const c = (a.category ?? '').localeCompare(b.category ?? '');
      if (c !== 0) return c;
    }
    return (b.date ?? '').localeCompare(a.date ?? '');
  });

  /* Facet counts for the sidebar — only show facets with entries */
  const kindCounts       = countBy(writeups, (w) => w.kind);
  const platformCounts   = countBy(writeups, (w) => w.platform ?? '');
  const difficultyCounts = countBy(writeups, (w) => w.difficulty ?? '');
  const osCounts         = countBy(writeups, (w) => w.os ?? '');
  const statusCounts     = countBy(writeups, (w) => w.status ?? '');
  const categoryCounts   = countBy(writeups, (w) => w.category ?? '');

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="13">Writeups</Eyebrow>
        <h1 className={styles.title}>Writeups</h1>
        <p className={styles.dek}>
          Security writeups, tool references, technique and methodology
          notes. Box writeups when there&apos;s a box; tutorials when
          there isn&apos;t.
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <FilterGroup label="Kind" param="kind" current={kindFilter} options={
            (['machine','technique'] as const).map((k) => ({
              key: k, label: k === 'machine' ? 'Box writeups' : 'Techniques', count: kindCounts[k] ?? 0,
            }))
          } total={writeups.length} />

          {Object.keys(categoryCounts).filter((k) => k).length > 0 && (
            <FilterGroup label="Category" param="category" current={categoryFilter} options={
              Object.keys(categoryCounts)
                .filter((k) => k)
                .sort()
                .map((k) => ({ key: k, label: cap(k), count: categoryCounts[k] }))
            } total={writeups.length} />
          )}

          <FilterGroup label="Platform" param="platform" current={platformFilter} options={
            (['htb','thm','vulnhub','portswigger','ctf','other'] as const)
              .map((k) => ({ key: k, label: PLATFORM_LABEL[k], count: platformCounts[k] ?? 0 }))
          } total={writeups.length} />
          <FilterGroup label="Difficulty" param="difficulty" current={difficultyFilter} options={
            (['easy','medium','hard','insane'] as const)
              .map((k) => ({ key: k, label: cap(k), count: difficultyCounts[k] ?? 0 }))
          } total={writeups.length} />
          <FilterGroup label="OS" param="os" current={osFilter} options={
            (['linux','windows','other'] as const)
              .map((k) => ({ key: k, label: cap(k), count: osCounts[k] ?? 0 }))
          } total={writeups.length} />
          <FilterGroup label="Status" param="status" current={statusFilter} options={
            (['rooted','foothold','attempted','abandoned'] as const)
              .map((k) => ({ key: k, label: cap(k), count: statusCounts[k] ?? 0 }))
          } total={writeups.length} />
        </aside>

        <section className={styles.list}>
          {sorted.length === 0 && (
            <p className={styles.empty}>No writeups match the current filters.</p>
          )}
          {sorted.map((w) => (
            <Link key={w.slug} href={`/writeups/${w.slug}`} className={styles.card}>
              <div className={styles.cardHead}>
                {w.kind === 'machine' && w.platform && (
                  <Chip>{PLATFORM_LABEL[w.platform] ?? w.platform}</Chip>
                )}
                {w.kind === 'technique' && w.category && (
                  <Chip>{cap(w.category)}</Chip>
                )}
                {w.difficulty && <StatusPill status={w.difficulty} label={w.difficulty} />}
                {w.os && <span className={styles.osMark}>{cap(w.os)}</span>}
                <span className={styles.spacer} />
                {w.status && <StatusPill status={w.status} label={w.status} />}
              </div>
              <p className={styles.cardTitle}>{w.title}</p>
              {(w.techniques && w.techniques.length > 0) && (
                <p className={styles.cardTech}>
                  {w.techniques.slice(0, 5).join(' · ')}
                  {w.techniques.length > 5 && ` · +${w.techniques.length - 5}`}
                </p>
              )}
              {(w.date || w.points != null) && (
                <p className={styles.cardMeta}>
                  {w.date && <span>{w.date}</span>}
                  {w.points != null && <><span className={styles.cardSep}>·</span><span>{w.points} pts</span></>}
                </p>
              )}
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}

function FilterGroup({
  label, param, current, options, total,
}: {
  label: string;
  param: string;
  current: string;
  options: { key: string; label: string; count: number }[];
  total: number;
}) {
  const active = options.filter((o) => o.count > 0);
  if (active.length === 0) return null;
  return (
    <div className={styles.filterGroup}>
      <p className={styles.sidebarLabel}>{label}</p>
      <ul className={styles.filterList}>
        <li className={styles.filterItem}>
          <Link
            href={current ? '/writeups' : '/writeups'}
            className={`${styles.filterLink} ${!current ? styles.filterLinkActive : ''}`}
          >
            <span>All</span>
            <span className={styles.filterCount}>{total}</span>
          </Link>
        </li>
        {active.map((o) => (
          <li key={o.key} className={styles.filterItem}>
            <Link
              href={`?${param}=${encodeURIComponent(o.key)}`}
              className={`${styles.filterLink} ${current === o.key ? styles.filterLinkActive : ''}`}
            >
              <span>{o.label}</span>
              <span className={styles.filterCount}>{o.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function countBy<T>(arr: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of arr) {
    const k = key(x);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function stringOf(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
