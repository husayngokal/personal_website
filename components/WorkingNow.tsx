import type { CurrentWorking } from '@/lib/content/working';
import styles from './WorkingNow.module.css';

/*
 * Homepage now-state "currently working" line. A standing identity fact
 * (the full-time role), distinct from the typewriter's rotating live
 * activity. Renders nothing when unset so the hero degrades cleanly.
 *
 * The orange dot is static, not animated — it carries the site's
 * current-status colour without violating "orange is the only colour
 * that moves" (nothing here moves).
 */
export function WorkingNow({ working }: { working: CurrentWorking | null }) {
  if (!working) return null;

  const { role, company, url, location, arrangement, started } = working;
  const meta = [location, arrangement, started ? `since ${started}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <p className={styles.working}>
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.role}>{role}</span>
      {company && (
        <>
          <span className={styles.at}> at </span>
          {url ? (
            <a href={url} className={styles.company} target="_blank" rel="noreferrer">
              {company}
            </a>
          ) : (
            <span className={styles.company}>{company}</span>
          )}
        </>
      )}
      {meta && <span className={styles.meta}>{meta}</span>}
    </p>
  );
}
