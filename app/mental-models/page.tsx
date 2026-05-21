import Link from 'next/link';
import { Eyebrow, Chip } from '@/components/Primitives';
import { ModelMark } from '@/components/marks/ModelMark';
import { getMentalModels } from '@/lib/content/mental-models';
import styles from './models.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

/*
 * Mental Models index (Part IX). Card grid with bespoke hand-drawn
 * marks at top of each card. The first ten marks are author-drawn,
 * matching the Phase 4 deliverable in Part XIV.
 */

export const metadata = {
  title: 'Mental Models',
  description:
    'Curated frameworks, original models, and hybrid syntheses, each with personal framing and in-the-wild examples from the rest of the site.',
};

export default async function ModelsIndex() {
  const MENTAL_MODELS = await getMentalModels();
  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.head}>
        <Eyebrow number="09">Mental models</Eyebrow>
        <h1 className={styles.title}>Mental Models</h1>
        <p className={styles.dek}>
          Curated frameworks, original models, and hybrid syntheses. Each entry
          carries my personal framing, examples drawn from the rest of the site,
          and (where it applies) a record of how the model has shifted in my use.
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <p className={styles.sidebarLabel}>Type</p>
          <ul className={styles.filterList}>
            {[
              { k: 'all', l: 'All', c: MENTAL_MODELS.length },
              { k: 'curated', l: 'Curated', c: MENTAL_MODELS.filter((m) => m.type === 'curated').length },
              { k: 'original', l: 'Original', c: MENTAL_MODELS.filter((m) => m.type === 'original').length },
              { k: 'hybrid', l: 'Hybrid', c: MENTAL_MODELS.filter((m) => m.type === 'hybrid').length },
            ].map((f) => (
              <li key={f.k} className={styles.filterItem}>
                <span>{f.l}</span>
                <span className={styles.filterCount}>{f.c}</span>
              </li>
            ))}
          </ul>

          <p className={styles.sidebarLabel} style={{ marginTop: 'var(--space-xl)' }}>Depth</p>
          <ul className={styles.filterList}>
            {(['teaching-from', 'working-in', 'learning', 'dabbled', 'decayed'] as const).map((d) => {
              const c = MENTAL_MODELS.filter((m) => m.depth === d).length;
              return (
                <li key={d} className={styles.filterItem}>
                  <span>{d}</span>
                  <span className={styles.filterCount}>{c}</span>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className={styles.grid}>
          {MENTAL_MODELS.map((m) => (
            <Link key={m.slug} href={`/mental-models/${m.slug}`} className={styles.card}>
              <div className={styles.markWrap}>
                <ModelMark slug={m.slug} size={80} />
              </div>
              <p className={styles.cardTitle}>{m.title}</p>
              <p className={styles.cardLine}>{m.oneLine}</p>
              {m.tags && m.tags[0] && (
                <p className={styles.cardTags}>
                  <Chip>{m.tags[0]}</Chip>
                </p>
              )}
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
