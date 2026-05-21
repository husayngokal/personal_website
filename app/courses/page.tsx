import Link from 'next/link';
import { Eyebrow, Chip, StatusPill } from '@/components/Primitives';
import { UniversityChip } from '@/components/UniversityChip';
import { getCourses } from '@/lib/content/courses';
import { getUniversity, UNIVERSITIES } from '@/lib/universities';
import styles from './courses.module.css';

/*
 * Courses index — every university course on the roadmap.
 *
 * Layout: filter sidebar (by university, by status) + card grid.
 * Each card carries the uni chip, code, title, status, and the
 * estimated hours (computed from MIT units × 14 for MIT courses,
 * manually estimated for others).
 *
 * Brief deviation acknowledged: this is a new top-level surface not
 * in the original Part IV's six. Treated as an extension of the
 * Study Log; lives at /courses (separate URL to keep the curriculum
 * concern distinct from the credentialism-suspicion register of
 * /study).
 */

export const metadata = {
  title: 'Courses',
  description:
    'University courses — the curriculum and roadmap. MIT primarily, with selected courses from Stanford, Yale, Harvard, Cornell, NYU.',
};

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

const STATUS_ORDER: Record<string, number> = {
  studying: 0, planned: 1, completed: 2, abandoned: 3,
};

export default async function CoursesIndex() {
  const courses = await getCourses();

  /* Sort: status (studying first), then by order, then code */
  const sorted = [...courses].sort((a, b) => {
    const s = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    if (s !== 0) return s;
    if (a.order !== b.order) return a.order - b.order;
    return (a.code ?? '').localeCompare(b.code ?? '');
  });

  /* Universities that actually have courses (no empty buckets) */
  const universitiesWithCount = Object.values(UNIVERSITIES)
    .map((u) => ({ ...u, count: courses.filter((c) => c.university === u.slug).length }))
    .filter((u) => u.count > 0);

  const statusCounts = {
    studying:  courses.filter((c) => c.status === 'studying').length,
    planned:   courses.filter((c) => c.status === 'planned').length,
    completed: courses.filter((c) => c.status === 'completed').length,
    abandoned: courses.filter((c) => c.status === 'abandoned').length,
  };

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="12">Courses</Eyebrow>
        <h1 className={styles.title}>Courses</h1>
        <p className={styles.dek}>
          The curriculum of courses I&apos;ve studied, am studying or want to
          study. MiT, Stanford, Yale, Harvard, Cornell, and NYU. Each course
          has a workload estimate; setting a per-week pace produces an ETA.
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.sidebarLabel}>University</p>
          <ul className={styles.filterList}>
            <li className={styles.filterItem}>
              <span>All</span>
              <span className={styles.filterCount}>{courses.length}</span>
            </li>
            {universitiesWithCount.map((u) => (
              <li key={u.slug} className={styles.filterItem}>
                <span>{u.short}</span>
                <span className={styles.filterCount}>{u.count}</span>
              </li>
            ))}
          </ul>

          <p className={styles.sidebarLabel} style={{ marginTop: 'var(--space-xl)' }}>Status</p>
          <ul className={styles.filterList}>
            <li className={styles.filterItem}><span>Studying</span><span className={styles.filterCount}>{statusCounts.studying}</span></li>
            <li className={styles.filterItem}><span>Planned</span><span className={styles.filterCount}>{statusCounts.planned}</span></li>
            <li className={styles.filterItem}><span>Completed</span><span className={styles.filterCount}>{statusCounts.completed}</span></li>
            <li className={styles.filterItem}><span>Abandoned</span><span className={styles.filterCount}>{statusCounts.abandoned}</span></li>
          </ul>
        </aside>

        <section className={styles.grid}>
          {sorted.map((c) => (
            <Link key={c.slug} href={`/courses/${c.slug}`} className={styles.card}>
              <div className={styles.banner}>
                {c.bannerImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={c.bannerImage} alt="" />
                ) : (
                  <div className={styles.bannerPlaceholder} aria-hidden="true">
                    {c.code ?? c.title.split(' ').slice(0, 2).join(' ')}
                  </div>
                )}
              </div>
              <div className={styles.cardBody}>
                <p className={styles.cardMeta}>
                  <UniversityChip slug={c.university} />
                  {c.code && <span className={styles.code}>{c.code}</span>}
                </p>
                <p className={styles.cardTitle}>{c.title}</p>
                <p className={styles.cardMetaBottom}>
                  <StatusPill status={c.status as never} label={c.status} />
                  {c.estTotalHours && (
                    <span className={styles.hoursChip}>~{c.estTotalHours}h</span>
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
