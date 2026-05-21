import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip, StatusPill } from '@/components/Primitives';
import { Backlinks } from '@/components/Backlinks';
import { getWriteup, getWriteups } from '@/lib/content/writeups';
import { renderMarkdown } from '@/lib/markdown';
import styles from '../writeups.module.css';

/*
 * Writeup detail — structured masthead (platform + difficulty + OS +
 * status pills), facts grid (date, points, IP, techniques, tags),
 * then the full markdown body.
 */

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

const PLATFORM_LABEL: Record<string, string> = {
  htb:         'HackTheBox',
  thm:         'TryHackMe',
  vulnhub:     'VulnHub',
  portswigger: 'PortSwigger',
  ctf:         'CTF',
  other:       'Other',
};

export async function generateStaticParams() {
  const all = await getWriteups();
  return all.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await getWriteup(slug);
  return w ? { title: `${w.title} — Writeups` } : {};
}

export default async function WriteupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const w = await getWriteup(slug);
  if (!w) notFound();

  const html = w.body ? await renderMarkdown(w.body, 'writeups') : null;

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.detailHead}>
        <p className={styles.detailKicker}>
          <Link href="/writeups">← Writeups</Link>
        </p>
        <h1 className={styles.detailTitle}>{w.title}</h1>
        <div className={styles.detailMetaRow}>
          {w.kind === 'machine' && w.platform && (
            <Chip>{PLATFORM_LABEL[w.platform] ?? w.platform}</Chip>
          )}
          {w.kind === 'technique' && w.category && (
            <Chip>{cap(w.category)}</Chip>
          )}
          {w.difficulty && <StatusPill status={w.difficulty} label={w.difficulty} />}
          {w.os && <span className={styles.osMark}>{cap(w.os)}</span>}
          {w.status && <StatusPill status={w.status} label={w.status} />}
        </div>
      </header>

      {hasFacts(w) && (
        <dl className={styles.detailFacts}>
          {w.date && (<>
            <dt className={styles.factsLabel}>Date</dt>
            <dd className={styles.factsValue}>{w.date}</dd>
          </>)}
          {w.points != null && (<>
            <dt className={styles.factsLabel}>Points</dt>
            <dd className={styles.factsValue}>{w.points}</dd>
          </>)}
          {w.ip && (<>
            <dt className={styles.factsLabel}>IP</dt>
            <dd className={styles.factsValue}><code>{w.ip}</code></dd>
          </>)}
          {w.techniques && w.techniques.length > 0 && (<>
            <dt className={styles.factsLabel}>Techniques</dt>
            <dd className={styles.factsValue}>{w.techniques.join(' · ')}</dd>
          </>)}
          {w.tags && w.tags.length > 0 && (<>
            <dt className={styles.factsLabel}>Tags</dt>
            <dd className={styles.factsValue}>{w.tags.join(' · ')}</dd>
          </>)}
        </dl>
      )}

      {html && (
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      <Backlinks table="writeups" slug={w.slug} />
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function hasFacts(w: { date?: string; points?: number; ip?: string; techniques?: string[]; tags?: string[] }): boolean {
  return Boolean(
    w.date ||
    w.points != null ||
    w.ip ||
    (w.techniques && w.techniques.length > 0) ||
    (w.tags && w.tags.length > 0),
  );
}
