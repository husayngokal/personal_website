import Link from 'next/link';
import { Eyebrow, Chip } from '@/components/Primitives';
import { getCredentials } from '@/lib/content/credentials';
import styles from './credentials.module.css';

/*
 * Credentials index — every publicly-listable academic / professional
 * credential the author can verify. Visitors can download the file
 * directly (transcripts, diplomas, certificates) or open the
 * verification URL for institutions that publish their own verifier.
 *
 * The credentials table can also hold private entries (is_public=false)
 * which never reach this listing — those exist for the author's own
 * future automation (e.g. CV builder) without being public.
 */

export const metadata = {
  title: 'Credentials',
  description:
    'Academic and professional credentials. Downloadable transcripts, diplomas, and certificates.',
};

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

const TYPE_LABEL: Record<string, string> = {
  transcript:  'Transcript',
  diploma:     'Diploma',
  certificate: 'Certificate',
  letter:      'Letter',
  other:       'Other',
};

export default async function CredentialsIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const credentials = await getCredentials();
  const sp = await searchParams;
  const typeFilter        = stringOf(sp.type);
  const institutionFilter = stringOf(sp.institution);

  const filtered = credentials.filter((c) => {
    if (typeFilter && c.type !== typeFilter) return false;
    if (institutionFilter && c.institution !== institutionFilter) return false;
    return true;
  });

  const typeCounts        = countBy(credentials, (c) => c.type);
  const institutionCounts = countBy(credentials, (c) => c.institution ?? '');

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="14">Credentials</Eyebrow>
        <h1 className={styles.title}>Credentials</h1>
        <p className={styles.dek}>
          Academic and professional credentials, downloadable as PDFs.
          Useful as proof, also useful as primary source for anyone
          curious how the bills add up.
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <FilterGroup label="Type" param="type" current={typeFilter} options={
            (['transcript','diploma','certificate','letter','other'] as const)
              .map((k) => ({ key: k, label: TYPE_LABEL[k], count: typeCounts[k] ?? 0 }))
          } total={credentials.length} />

          {Object.keys(institutionCounts).filter((k) => k).length > 0 && (
            <FilterGroup label="Institution" param="institution" current={institutionFilter} options={
              Object.keys(institutionCounts)
                .filter((k) => k)
                .sort()
                .map((k) => ({ key: k, label: k, count: institutionCounts[k] }))
            } total={credentials.length} />
          )}
        </aside>

        <section className={styles.list}>
          {filtered.length === 0 && (
            <p className={styles.empty}>
              {credentials.length === 0
                ? 'No credentials published yet.'
                : 'No credentials match the current filters.'}
            </p>
          )}
          {filtered.map((c) => (
            <Link key={c.slug} href={`/credentials/${c.slug}`} className={styles.card}>
              <div className={styles.cardHead}>
                <Chip>{TYPE_LABEL[c.type] ?? c.type}</Chip>
                {c.year && <span className={styles.year}>{c.year}</span>}
              </div>
              <p className={styles.cardTitle}>{c.title}</p>
              {c.institution && (
                <p className={styles.cardInstitution}>{c.institution}</p>
              )}
              {c.description && (
                <p className={styles.cardDescription}>{c.description}</p>
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
            href="/credentials"
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
