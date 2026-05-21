import { notFound } from 'next/navigation';
import { Backlinks } from '@/components/Backlinks';
import {
  Chip, ManifestoCallout, CrossLinkStrip, DecisionLogEntry, SectionRule,
} from '@/components/Primitives';
import { ModelMark } from '@/components/marks/ModelMark';
import { getMentalModels, getMentalModel } from '@/lib/content/mental-models';
import styles from './model.module.css';

/*
 * Mental Model detail (Part IX). The single most distinctive section is
 * "Husayn's framing" rendered as the manifesto callout — the visual
 * centerpiece of the page.
 */

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

export async function generateStaticParams() {
  const models = await getMentalModels();
  return models.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = await getMentalModel(slug);
  return m ? { title: `${m.title} — Mental Models` } : {};
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = await getMentalModel(slug);
  if (!model) notFound();

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <div className={styles.markWrap}>
          <ModelMark slug={model.slug} size={96} />
        </div>
        <div className={styles.headText}>
          <p className={styles.kind}>{model.type} · {model.depth}</p>
          <h1 className={styles.title}>{model.title}</h1>
          <p className={styles.line}>{model.oneLine}</p>
          {model.origin && <p className={styles.origin}>Origin: <span>{model.origin}</span></p>}
          {model.tags && (
            <p className={styles.tags}>
              {model.tags.map((t) => <Chip key={t}>{t}</Chip>)}
            </p>
          )}
        </div>
      </header>

      {model.body && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The model</h2>
          <p className={styles.body}>{model.body}</p>
        </section>
      )}

      {model.framing && (
        <ManifestoCallout label="Husayn's framing">
          <p>{model.framing}</p>
        </ManifestoCallout>
      )}

      {model.whenToReach && model.whenToReach.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>When to reach for it</h2>
          <ul className={styles.bullets}>
            {model.whenToReach.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </section>
      )}

      {model.whenNotTo && model.whenNotTo.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>When not to</h2>
          <ul className={styles.bullets}>
            {model.whenNotTo.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </section>
      )}

      {model.inTheWild && model.inTheWild.length > 0 && (
        <CrossLinkStrip title="In the wild" items={model.inTheWild} />
      )}

      {model.sources && model.sources.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Sources</h2>
          <ul className={styles.bullets}>
            {model.sources.map((s, i) => (
              <li key={i}>
                {s.href ? <a href={s.href}>{s.label}</a> : s.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {model.changedMyMind && model.changedMyMind.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Changed my mind</h2>
          {model.changedMyMind.map((c, i) => (
            <DecisionLogEntry key={i} date={c.date} title="Revision">
              <p>{c.body}</p>
            </DecisionLogEntry>
          ))}
        </section>
      )}

      <Backlinks table="mental_models" slug={model.slug} />
    </div>
  );
}
