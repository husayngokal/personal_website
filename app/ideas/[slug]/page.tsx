import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getIdea, getIdeas } from '@/lib/content/ideas';
import { renderMarkdown } from '@/lib/markdown';
import type { IdeaStatus } from '@/lib/types';
import styles from '../ideas.module.css';

/*
 * Idea detail — title, status chip, one-sentence summary, the full
 * markdown body, plus a small footer linking back to the index. If
 * the idea has shipped and the entry carries a `shipped-as` URL, we
 * surface that as a primary CTA at the top so readers can jump
 * straight to the live thing.
 */

export const revalidate = 60;

export async function generateStaticParams() {
  const ideas = await getIdeas();
  return ideas.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const i = await getIdea(slug);
  if (!i) return {};
  return {
    title: `${i.title} — Ideas`,
    description: i.summary,
  };
}

const STATUS_LABEL: Record<IdeaStatus, string> = {
  open: 'open', exploring: 'exploring', building: 'building',
  shipped: 'shipped', dropped: 'dropped',
};

export default async function IdeaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const idea = await getIdea(slug);
  if (!idea) notFound();

  const bodyHtml = idea.body ? await renderMarkdown(idea.body, 'ideas') : null;

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <p className={styles.detailKicker}>
        <Link href="/ideas">← Ideas</Link>
      </p>
      <div className={styles.detailHead}>
        <h1 className={styles.detailTitle}>{idea.title}</h1>
        <span className={`${styles.statusChip} ${styles[`chip-${idea.status}`] ?? ''}`}>
          {STATUS_LABEL[idea.status]}
        </span>
      </div>
      <p className={styles.detailSummary}>{idea.summary}</p>
      <p className={styles.detailMeta}>
        proposed {idea.proposed}
        {idea.tags && idea.tags.length > 0 && (
          <span className={styles.tagList}>
            {idea.tags.map((t) => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </span>
        )}
      </p>
      {idea.shippedAs && (
        <p style={{ margin: 'var(--space-l) 0 var(--space-2xl)' }}>
          <a href={idea.shippedAs} className={styles.shippedLink}>
            Live: {idea.shippedAs} →
          </a>
        </p>
      )}
      {bodyHtml && (
        <div
          className={styles.detailBody}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      )}
    </div>
  );
}
