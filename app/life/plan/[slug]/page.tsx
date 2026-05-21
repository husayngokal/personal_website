import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMasterPlanPart, getMasterPlanParts } from '@/lib/content/master-plan';
import { renderMarkdown } from '@/lib/markdown';
import styles from '../plan.module.css';

/*
 * Master Plan detail — one Part as a long-form document. The body is
 * markdown rendered through the standard pipeline (wikilink rewrite,
 * editorial table treatment, Obsidian image embeds). At the bottom,
 * prev/next links for sequential reading of the eighteen Parts.
 *
 * generateStaticParams pre-builds every Part at build time so the
 * detail pages serve as static HTML. ISR re-validates on vault push.
 */

export const revalidate = 60;

export async function generateStaticParams() {
  const parts = await getMasterPlanParts();
  return parts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getMasterPlanPart(slug);
  if (!p) return {};
  return {
    title: `${p.title} — The Master Plan`,
    description: p.summary ?? `Part ${p.partNumber} of the operating document for the entire life.`,
  };
}

export default async function MasterPlanPartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [part, allParts] = await Promise.all([
    getMasterPlanPart(slug),
    getMasterPlanParts(),
  ]);
  if (!part) notFound();

  const html = await renderMarkdown(part.body, 'life_master_plan');

  /* Sequential nav — prev/next sit at the bottom so readers can move
     through the document linearly when they want to. */
  const idx = allParts.findIndex((p) => p.slug === part.slug);
  const prev = idx > 0 ? allParts[idx - 1] : null;
  const next = idx < allParts.length - 1 ? allParts[idx + 1] : null;

  return (
    <div className="page page--life">
      <p className={styles.kicker}>
        <Link href="/life/plan">← The Master Plan</Link>
      </p>
      <p className={styles.detailMeta}>
        Part {String(part.partNumber).padStart(2, '0')} of 18
      </p>
      <h1 className={styles.detailTitle}>{part.title}</h1>

      <div
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {(prev || next) && (
        <nav className={styles.partNav} aria-label="Master Plan navigation">
          {prev ? (
            <Link href={`/life/plan/${prev.slug}`} className={styles.partNavLink}>
              <span className={styles.partNavLinkLabel}>← Part {String(prev.partNumber).padStart(2, '0')}</span>
              <span className={styles.partNavLinkTitle}>{prev.title}</span>
            </Link>
          ) : <span />}
          {next ? (
            <Link href={`/life/plan/${next.slug}`} className={`${styles.partNavLink} ${styles.partNavLinkRight}`}>
              <span className={styles.partNavLinkLabel}>Part {String(next.partNumber).padStart(2, '0')} →</span>
              <span className={styles.partNavLinkTitle}>{next.title}</span>
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
