import Link from 'next/link';
import {
  Eyebrow, Chip, ManifestoCallout, StatusPill,
} from '@/components/Primitives';
import {
  getStudyCredentials, getStudyDomains, getPublications, getConferences,
} from '@/lib/content/study';
import styles from './study.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

/*
 * Study Log (Part X). Opens with the certification manifesto — the most
 * prominent manifesto callout on the entire site by design. The manifesto
 * sets the frame for everything below.
 */

export const metadata = {
  title: 'Study Log',
  description:
    'Credentials, eight self-study domains, conferences, and publications — anchored by a manifesto on the difference between certifying and learning.',
};

export default async function StudyIndex() {
  const [STUDY_CREDENTIALS, STUDY_DOMAINS, PUBLICATIONS, CONFERENCES] = await Promise.all([
    getStudyCredentials(), getStudyDomains(), getPublications(), getConferences(),
  ]);
  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="10">Study</Eyebrow>
        <h1 className={styles.title}>Study Log</h1>
        <p className={styles.dek}>
          A record of credentials, domains, and learning in motion. Anchored
          by an explicit manifesto on the difference between certifying and
          learning.
        </p>
      </header>

      {/* The certification manifesto — Part X */}
      <ManifestoCallout label="Certification manifesto">
        <p>
          Certifications for the sake of certifications are worthless. A line
          on a resume is not knowledge; a passed exam is not competence. Every
          credential below appears with a note on what actually stuck from the
          work that earned it, and what has decayed since. Where a credential
          reflects real, ongoing capability, the note says so. Where it does
          not, the note says that too. The point of this log is not to display
          certificates. The point is to track what is real.
        </p>
        <p style={{ marginTop: 'var(--space-m)' }}>
          <Link href="/notebook/on-certifying-and-learning" className={styles.manifestoLink}>
            The longer argument →
          </Link>
        </p>
      </ManifestoCallout>

      {/* Credentials */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Credentials</h2>
        <ul className={styles.credList}>
          {STUDY_CREDENTIALS.map((c) => (
            <li key={c.slug} className={styles.credItem}>
              <Link href={`/study/credentials/${c.slug}`} className={styles.credLink}>
                <div className={styles.credHead}>
                  <h3 className={styles.credTitle}>{c.title}</h3>
                  <span className={styles.credInst}>{c.institution}</span>
                </div>
                <div className={styles.credMeta}>
                  <StatusPill status={c.depth} label={c.depth} />
                  <span className={styles.credMetaDot}>·</span>
                  <span className={styles.credDate}>
                    {c.pending ? 'pending' : `earned ${c.earned}`}
                  </span>
                  <span className={styles.credMetaDot}>·</span>
                  <span className={styles.credAssessed}>last assessed {c.lastAssessed}</span>
                  {isOverdue(c.lastAssessed) && (
                    <span className={styles.overdueDot} aria-label="overdue assessment" />
                  )}
                </div>
                <p className={styles.credWhat}>
                  <span className={styles.credLabel}>what stuck</span>
                  <span>{c.whatStuck}</span>
                </p>
                <p className={styles.credWhat}>
                  <span className={styles.credLabel}>what didn't</span>
                  <span>{c.whatDidnt}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Domains */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The eight domains</h2>
        <ul className={styles.domainList}>
          {STUDY_DOMAINS.map((d) => (
            <li key={d.slug} className={styles.domainItem}>
              <Link href={`/study/domains/${d.slug}`} className={styles.domainLink}>
                <div className={styles.domainHead}>
                  <h3 className={styles.domainTitle}>{d.title}</h3>
                  <StatusPill status={d.depth} label={d.depth} />
                </div>
                <p className={styles.domainBody}>{d.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Publications */}
      {PUBLICATIONS.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Publications</h2>
          <ul className={styles.pubList}>
            {PUBLICATIONS.map((p) => (
              <li key={p.slug} className={styles.pubItem}>
                <p className={styles.pubTitle}>{p.title}</p>
                <p className={styles.pubMeta}>
                  <span>{p.venue}</span>
                  <span className={styles.pubDot}>·</span>
                  <span>{p.year}</span>
                  <span className={styles.pubDot}>·</span>
                  <span>{p.authors}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Conferences */}
      {CONFERENCES.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Conferences</h2>
          <ul className={styles.pubList}>
            {CONFERENCES.map((c) => (
              <li key={c.slug} className={styles.pubItem}>
                <p className={styles.pubTitle}>{c.name}, {c.year}</p>
                <p className={styles.pubMeta}>{c.role}{c.talk && ` — ${c.talk}`}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function isOverdue(iso: string): boolean {
  const last = new Date(iso);
  const eighteenMonths = 18 * 30 * 86_400_000;
  return Date.now() - last.getTime() > eighteenMonths;
}
