import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Chip, StatusPill } from '@/components/Primitives';
import { Backlinks } from '@/components/Backlinks';
import { getStudyCredentials, getStudyCredential } from '@/lib/content/study';
import styles from './credential.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

export async function generateStaticParams() {
  const creds = await getStudyCredentials();
  return creds.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getStudyCredential(slug);
  return c ? { title: `${c.title} — Study` } : {};
}

export default async function CredentialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getStudyCredential(slug);
  if (!c) notFound();

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <p className={styles.kicker}>
        <Link href="/study">← Study Log</Link>
      </p>
      <h1 className={styles.title}>{c.title}</h1>
      {c.fullTitle && <p className={styles.full}>{c.fullTitle}</p>}
      <p className={styles.inst}>{c.institution}</p>
      <p className={styles.meta}>
        <StatusPill status={c.depth} label={c.depth} />
        <span className={styles.dot}>·</span>
        <span>{c.pending ? 'pending' : `earned ${c.earned}`}</span>
        {c.expires && <><span className={styles.dot}>·</span><span>expires {c.expires}</span></>}
        <span className={styles.dot}>·</span>
        <span>last assessed {c.lastAssessed}</span>
      </p>

      <section className={styles.section}>
        <h2 className={styles.h2}>What stuck</h2>
        <p className={styles.body}>{c.whatStuck}</p>
      </section>
      <section className={styles.section}>
        <h2 className={styles.h2}>What didn't</h2>
        <p className={styles.body}>{c.whatDidnt}</p>
      </section>

      {c.tags && (
        <p className={styles.tags}>
          {c.tags.map((t) => <Chip key={t}>{t}</Chip>)}
        </p>
      )}

      <Backlinks table="study_credentials" slug={c.slug} />
    </div>
  );
}
