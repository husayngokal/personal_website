import Link from 'next/link';
import { Eyebrow, Chip, StatusPill } from '@/components/Primitives';
import { getProjects } from '@/lib/content/projects';
import styles from './projects.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

/*
 * Projects Hub index — list layout, not grid. Per Part VIII, projects
 * are work-in-motion best surveyed scan-style. Active first, then paused/
 * dormant, then concluded/shipped/dead.
 */

export const metadata = {
  title: 'Projects',
  description:
    'Current and past projects, with status, current-state notes, and decision logs. Not a portfolio — a record of work in motion.',
};

const STATUS_ORDER: Record<string, number> = {
  active: 0, paused: 1, dormant: 2, concluded: 3, shipped: 4, dead: 5,
};

export default async function ProjectsIndex() {
  const PROJECTS = await getProjects();
  const sorted = [...PROJECTS].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="08">Projects</Eyebrow>
        <h1 className={styles.title}>Projects</h1>
        <p className={styles.dek}>
          A record of work in motion.
        </p>
      </header>

      <ul className={styles.list}>
        {sorted.map((p) => (
          <li key={p.slug} className={styles.row}>
            <Link href={`/projects/${p.slug}`} className={styles.rowLink}>
              <div className={styles.rowLeft}>
                <p className={styles.rowName}>{p.title}</p>
                <p className={styles.rowTag}>{p.tagline}</p>
              </div>
              <div className={styles.rowRight}>
                <StatusPill status={p.status} label={p.status} />
                <span className={styles.rowDate}>{p.lastActive}</span>
                {p.tags && p.tags[0] && <Chip>{p.tags[0]}</Chip>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
