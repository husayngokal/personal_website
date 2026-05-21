import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Chip, StatusPill, DecisionLogEntry, CrossLinkStrip, SectionRule,
} from '@/components/Primitives';
import { Backlinks } from '@/components/Backlinks';
import { getProjects, getProject } from '@/lib/content/projects';
import { getNotebookPosts } from '@/lib/content/notebook';
import styles from './project.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

/*
 * Project detail (Part VIII). Sections:
 *   - Masthead
 *   - Current state (italic serif)
 *   - Currently stuck on (with "Reply with a thought →" affordance)
 *   - Task list (kanban, optional)
 *   - Recent activity (commit-like feed, redacted for private repos)
 *   - Decision log
 *   - Linked threads (cross-link strip)
 */

export async function generateStaticParams() {
  const projects = await getProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProject(slug);
  return p ? { title: `${p.title} — Projects` } : {};
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  // Linked threads — any notebook posts mentioning the project tag
  const allPosts = await getNotebookPosts();
  const linkedNotebook = allPosts.filter(
    (p) => p.tags?.includes(project.slug) || p.thread === `building-${project.slug}-in-public`,
  );

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.masthead}>
        <h1 className={styles.title}>{project.title}</h1>
        <p className={styles.tagline}>{project.tagline}</p>
        <p className={styles.meta}>
          <StatusPill status={project.status} label={project.status} />
          <span className={styles.metaDot}>·</span>
          <span>last active {project.lastActive}</span>
          {project.externalUrl && (
            <>
              <span className={styles.metaDot}>·</span>
              <a href={project.externalUrl} className={styles.externalLink} rel="noopener">
                {project.externalUrl.replace(/^https?:\/\//, '')} ↗
              </a>
            </>
          )}
        </p>
        <hr className={styles.headRule} />
      </header>

      {/* Slipwise privacy banner — Part VIII */}
      {project.repoPrivate && (
        <p className={styles.privacyNote}>
          <em>
            Slipwise is regulated-tech. Commit messages are redacted at ingestion;
            current-state, stuck-on, and decisions are deliberately bounded here.
            The substance of the build lives outside the public site.
          </em>
        </p>
      )}

      {project.currentState && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Current state</h2>
          <p className={styles.currentState}>{project.currentState}</p>
        </section>
      )}

      {project.stuckOn && project.stuckOn.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Currently stuck on</h2>
          <ul className={styles.stuckList}>
            {project.stuckOn.map((s, i) => (
              <li key={i} className={styles.stuckItem}>
                <p className={styles.stuckText}>{s}</p>
                <a
                  href={`mailto:husayn@husayngokal.com?subject=Thought%20on%20${encodeURIComponent(project.title)}%20%E2%80%94%20stuck-on%20${i + 1}`}
                  className={styles.stuckReply}
                >
                  Reply with a thought →
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {project.tasks && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tasks</h2>
          <div className={styles.kanban}>
            <div className={styles.kanbanCol}>
              <p className={styles.kanbanHead}>Backlog</p>
              {(project.tasks.backlog ?? []).map((t, i) => <p key={i} className={styles.kanbanCard}>{t}</p>)}
            </div>
            <div className={styles.kanbanCol}>
              <p className={styles.kanbanHead}>In progress</p>
              {(project.tasks.inProgress ?? []).map((t, i) => <p key={i} className={styles.kanbanCard}>{t}</p>)}
            </div>
            <div className={styles.kanbanCol}>
              <p className={styles.kanbanHead}>Done</p>
              {(project.tasks.done ?? []).map((t, i) => <p key={i} className={styles.kanbanCard}>{t}</p>)}
            </div>
          </div>
        </section>
      )}

      {project.activity && project.activity.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recent activity</h2>
          <ul className={styles.activity}>
            {project.activity.map((a, i) => (
              <li key={i} className={styles.activityRow}>
                <span className={styles.activityDate}>{a.date.replace('T', ' ')}</span>
                <span className={styles.activityLine}>
                  {project.repoPrivate ? '· · ·' : a.line}
                </span>
                {a.branch && <span className={styles.activityBranch}>{a.branch}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {project.decisions && project.decisions.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Decision log</h2>
          {project.decisions.map((d, i) => (
            <DecisionLogEntry key={i} date={d.date} title={d.title}>
              <p>{d.body}</p>
            </DecisionLogEntry>
          ))}
          <p style={{ marginTop: 'var(--space-l)' }}>
            <Link href={`/projects/${project.slug}/decisions`} className={styles.externalLink}>
              Full decision archive →
            </Link>
          </p>
        </section>
      )}

      {linkedNotebook.length > 0 && (
        <CrossLinkStrip
          title="Linked threads"
          items={linkedNotebook.map((p) => ({ href: `/notebook/${p.slug}`, label: p.title, sub: p.date }))}
        />
      )}

      <Backlinks table="projects" slug={project.slug} />
    </div>
  );
}
