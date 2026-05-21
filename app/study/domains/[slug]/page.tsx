import { notFound } from 'next/navigation';
import Link from 'next/link';
import { StatusPill } from '@/components/Primitives';
import { Backlinks } from '@/components/Backlinks';
import { getStudyDomains, getStudyDomain } from '@/lib/content/study';
import styles from './domain.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

export async function generateStaticParams() {
  const domains = await getStudyDomains();
  return domains.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getStudyDomain(slug);
  return d ? { title: `${d.title} — Study` } : {};
}

export default async function DomainPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getStudyDomain(slug);
  if (!d) notFound();

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <p className={styles.kicker}>
        <Link href="/study">← Study Log</Link>
      </p>
      <h1 className={styles.title}>{d.title}</h1>
      <p className={styles.meta}>
        <StatusPill status={d.depth} label={d.depth} />
      </p>
      <hr className={styles.rule} />
      <p className={styles.body}>{d.body}</p>

      <Backlinks table="study_domains" slug={d.slug} />
    </div>
  );
}
