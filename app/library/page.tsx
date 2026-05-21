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
    'Reading log, year-long reading plan, notes, reviews, and threads that connect books to the rest of the site.',
};

const STATUS_FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'reading',   label: 'Reading' },
  { key: 'finished',  label: 'Finished' },
  { key: 'planned',   label: 'Planned' },
  { key: 'wishlist',  label: 'Wishlist' },
];

export default async function LibraryIndex() {
  const [BOOKS, plan] = await Promise.all([getBooks(), getPlanSummary()]);
  const pct = Math.round((plan.finished / PLAN_TARGET) * 100);
  /* Books sorted: reading > finished > planned > rest */
  const order: Record<string, number> = {
    reading: 0, 're-reading': 0, finished: 1, planned: 2, wishlist: 3, abandoned: 4,
  };
  const sorted = [...BOOKS].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="07">Library</Eyebrow>
        <h1 className={styles.title}>Library</h1>
        <p className={styles.dek}>
          Every book read, in progress, planned, or abandoned. The year-long
          plan is the spine; the notes, reviews, and threads are the substance.
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
              return (
                <li key={f.key} className={styles.filterItem}>
                  <span>{f.label}</span>
                  <span className={styles.filterCount}>{count}</span>
                </li>
              );
            })}
          </ul>
          <p className={styles.sidebarLabel} style={{ marginTop: 'var(--space-xl)' }}>Year</p>
          <ul className={styles.filterList}>
            <li className={styles.filterItem}><span>2026</span><span className={styles.filterCount}>{BOOKS.length}</span></li>
            <li className={styles.filterItem}><span>2025</span><span className={styles.filterCount}>—</span></li>
          </ul>
        </aside>

        <section className={styles.grid}>
          {sorted.map((b) => (
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
