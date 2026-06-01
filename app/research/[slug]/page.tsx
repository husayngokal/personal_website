import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Eyebrow } from '@/components/Primitives';
import { getResearchTopic, getResearchTopics } from '@/lib/content/research';
import { renderMarkdown } from '@/lib/markdown';
import type { ResearchStatus } from '@/lib/types';
import styles from '../research.module.css';

/*
 * Research topic detail — single page per topic, rendering the body
 * markdown through the standard pipeline (wikilinks, embeds, table
 * treatment). External links inside the body get `target="_blank"`
 * applied at render time so the visitor can follow a resource without
 * losing their place in the topic page.
 */

export const revalidate = 60;

export async function generateStaticParams() {
  const topics = await getResearchTopics();
  return topics.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getResearchTopic(slug);
  if (!t) return {};
  return {
    title: t.title,
    description: t.summary ?? `Research log for ${t.title}.`,
  };
}

const STATUS_LABEL: Record<ResearchStatus, string> = {
  gathering: 'gathering',
  exploring: 'exploring',
  writing:   'writing',
  shipped:   'shipped',
  dormant:   'dormant',
};

export default async function ResearchTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = await getResearchTopic(slug);
  if (!topic) notFound();

  const html = await renderMarkdown(topic.body, 'research_topics');

  return (
    <article className={`page ${styles.detail}`}>
      <Eyebrow number="17">Research</Eyebrow>
      <p className={styles.kicker}>
        <Link href="/research">← Research</Link>
      </p>
      <div className={styles.detailHead}>
        <h1 className={styles.detailTitle}>{topic.title}</h1>
        <span className={`${styles.statusChip} ${styles[`chip-${topic.status}`] ?? ''}`}>
          {STATUS_LABEL[topic.status]}
        </span>
      </div>
      {topic.summary && <p className={styles.dek}>{topic.summary}</p>}
      <p className={styles.detailMeta}>
        {topic.started && <span>started {topic.started}</span>}
        {topic.tags && topic.tags.length > 0 && (
          <span className={styles.tagList}>
            {topic.tags.map((t) => (
              <span key={t} className={styles.tag}>{t}</span>
            ))}
          </span>
        )}
      </p>
      <div
        className={styles.body}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
