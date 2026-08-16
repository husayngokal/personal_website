import Link from 'next/link';
import { Eyebrow, ProgressBar, StatusPill } from '@/components/Primitives';
import { OpenBookMark } from '@/components/marks/OpenBookMark';
import { BookCover } from '@/components/BookCover';
import { getBooks, getPlanSummary, PLAN_TARGET, PLAN_YEAR } from '@/lib/content/library';
import styles from './library.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

/*
 * Library index — year-plan progress bar (the spine of the surface) +
 * book grid + sidebar filter. The progress bar animates from zero to
 * its current value on first paint per Part VII.
 */

export const metadata = {
  title: 'Library',
  description:
    'Reading log, year-long reading plan, notes, reviews, and essays that connect books to the rest of the site.',
};

const STATUS_FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'reading',     label: 'Reading' },
  { key: 'finished',    label: 'Finished' },
  { key: 'planned',     label: 'Planned' },
  { key: 'wishlist',    label: 'Wishlist' },
  { key: 're-reading',  label: 'Re-reading' },
  { key: 'abandoned',   label: 'Abandoned' },
];

function buildHref(params: { status?: string; year?: string }): string {
  const q = new URLSearchParams();
  if (params.status && params.status !== 'all') q.set('status', params.status);
  if (params.year && params.year !== 'all') q.set('year', params.year);
  const s = q.toString();
  return s ? `/library?${s}` : '/library';
}

function stringOf(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

export default async function LibraryIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [BOOKS, plan, sp] = await Promise.all([getBooks(), getPlanSummary(), searchParams]);
  const statusFilter = stringOf(sp.status);
  const yearFilter   = stringOf(sp.year);
  const pct = Math.round((plan.finished / PLAN_TARGET) * 100);
  /* Books sorted: reading > finished > planned > rest */
  const order: Record<string, number> = {
    reading: 0, 're-reading': 0, finished: 1, planned: 2, wishlist: 3, abandoned: 4,
  };
  const sorted = [...BOOKS].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
  const filtered = sorted.filter((b) => {
    if (statusFilter && b.status !== statusFilter) return false;
    if (yearFilter && String(b.year ?? '') !== yearFilter) return false;
    return true;
  });

  /* Year buckets — pulled from the actual data so empty years don't
     appear and new ones surface automatically. Newest first. */
  const yearCounts = new Map<number, number>();
  for (const b of BOOKS) {
    if (b.year == null) continue;
    yearCounts.set(b.year, (yearCounts.get(b.year) ?? 0) + 1);
  }
  const years = Array.from(yearCounts.entries()).sort((a, b) => b[0] - a[0]);

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="07">Library</Eyebrow>
        <h1 className={styles.title}>Library</h1>
        <p className={styles.dek}>
          Every book read, in progress, planned, or abandoned. The year-long
          plan is the spine; the notes, reviews, and essays are the substance.
        </p>
      </header>

      {/* Year-plan progress */}
      <section className={styles.plan}>
        <div className={styles.planLeft}>
          <OpenBookMark size={56} />
        </div>
        <div className={styles.planBody}>
          <p className={styles.planYear}>
            {PLAN_YEAR} · {PLAN_TARGET} books planned
          </p>
          <ProgressBar pct={pct} showLabel={false} width="100%" animate />
          <p className={styles.planCount}>
            <span className={styles.planNum}>{plan.finished}</span> of {PLAN_TARGET} finished
            <span className={styles.planSep}>·</span>
            <span className={styles.planNum}>{plan.reading}</span> currently reading
            <span className={styles.planSep}>·</span>
            <span className={styles.planNum}>{plan.abandoned}</span> abandoned
          </p>
        </div>
      </section>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.sidebarLabel}>Filter</p>
          <ul className={styles.filterList}>
            {STATUS_FILTERS.map((f) => {
              const count = f.key === 'all'
                ? BOOKS.length
                : BOOKS.filter((b) => b.status === f.key).length;
              if (f.key !== 'all' && count === 0) return null;
              const active = f.key === 'all'
                ? !statusFilter
                : statusFilter === f.key;
              return (
                <li key={f.key} className={styles.filterItem}>
                  <Link
                    href={buildHref({ status: f.key, year: yearFilter })}
                    className={`${styles.filterLink} ${active ? styles.filterLinkActive : ''}`}
                  >
                    <span>{f.label}</span>
                    <span className={styles.filterCount}>{count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {years.length > 0 && (
            <>
              <p className={styles.sidebarLabel} style={{ marginTop: 'var(--space-xl)' }}>Year</p>
              <ul className={styles.filterList}>
                <li className={styles.filterItem}>
                  <Link
                    href={buildHref({ status: statusFilter })}
                    className={`${styles.filterLink} ${!yearFilter ? styles.filterLinkActive : ''}`}
                  >
                    <span>All</span>
                    <span className={styles.filterCount}>{BOOKS.length}</span>
                  </Link>
                </li>
                {years.map(([y, count]) => {
                  const active = yearFilter === String(y);
                  return (
                    <li key={y} className={styles.filterItem}>
                      <Link
                        href={buildHref({ status: statusFilter, year: String(y) })}
                        className={`${styles.filterLink} ${active ? styles.filterLinkActive : ''}`}
                      >
                        <span>{y}</span>
                        <span className={styles.filterCount}>{count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {(statusFilter || yearFilter) && (
            <p className={styles.activeFilter}>
              Showing <strong>{filtered.length}</strong> of {BOOKS.length}
              {' · '}
              <Link href="/library" className={styles.clearLink}>clear</Link>
            </p>
          )}
        </aside>

        <section className={styles.grid}>
          {filtered.length === 0 && (
            <p className={styles.empty}>No books match this filter.</p>
          )}
          {filtered.map((b) => (
            <Link key={b.slug} href={`/library/${b.slug}`} className={styles.bookCard}>
              <div className={styles.bookSpineWrap}>
                <BookCover url={b.coverUrl} width={64} height={88} alt={`${b.title} cover`} />
              </div>
              <div className={styles.bookMeta}>
                <p className={styles.bookTitle}>{b.title}</p>
                <p className={styles.bookAuthor}>{b.author}</p>
                <p className={styles.bookStatus}>
                  <StatusPill status={b.status} label={b.status} />
                  {typeof b.progressPct === 'number' && b.progressPct > 0 && (
                    <span className={styles.bookProgress}>
                      <ProgressBar pct={b.progressPct} showLabel width="60px" />
                    </span>
                  )}
                </p>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
