import Link from 'next/link';
import { Eyebrow, Chip } from '@/components/Primitives';
import { LiveTypewriter } from '@/components/LiveTypewriter';
import { HeroPortrait } from '@/components/HeroPortrait';
import { HeroHand } from '@/components/HeroHand';
import { LiveRails } from '@/components/LiveRails';
import { NewsletterForm } from '@/components/NewsletterForm';
import { ScrollDrop } from '@/components/marks/ScrollDrop';
import { getLiveState } from '@/lib/content/state';
import { getNotebookPosts, getNotebookThreads } from '@/lib/content/notebook';
import { getBooks } from '@/lib/content/library';
import { getProjects } from '@/lib/content/projects';
/* Mental Models still archived — re-introduce alongside acrossModel
   and the "From across the site" Link block. */
// import { getMentalModels } from '@/lib/content/mental-models';
import { getLifePrinciples } from '@/lib/content/life';
import { getWriteups } from '@/lib/content/writeups';
import styles from './page.module.css';

/* ISR, not force-dynamic. The homepage is the navigation hub, so it has
   to be the fastest page to arrive at, not the slowest. force-dynamic
   meant every visit was an uncached server render + 7 Supabase queries
   (x-vercel-cache: MISS, no prefetch), which on a cold instance is the
   multi-second "url changed but the page is frozen" stall.
   With revalidate the page is prerendered, edge-cached, and prefetchable
   on hover. The initial typewriter / rails state can be up to 60s stale,
   but useLiveState subscribes to Realtime on mount and reconciles within
   ~1s of hydration, so the live feel is preserved. */
export const revalidate = 60;

/*
 * Homepage — the front door and the /now page collapsed into one
 * (Part V). Brand introduction, live now-state, and conversion point.
 *
 * The homepage is the surface where the most distinctive design moves
 * concentrate: typewriter, cartoon hand, live rails, orange-dot motion
 * vocabulary. Every element earns its place.
 */

export default async function HomePage() {
  const [
    initialState, NOTEBOOK_POSTS, NOTEBOOK_THREADS, BOOKS, PROJECTS, LIFE_PRINCIPLES, WRITEUPS,
  ] = await Promise.all([
    getLiveState(),
    getNotebookPosts(), getNotebookThreads(),
    getBooks(), getProjects(), getLifePrinciples(), getWriteups(),
  ]);

  const recentEssays = [...NOTEBOOK_POSTS]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const activeThreads = NOTEBOOK_THREADS.filter((t) => t.state === 'active').slice(0, 5).map((t) => ({
    ...t,
    postCount: NOTEBOOK_POSTS.filter((p) => p.thread === t.slug).length,
  }));

  /* One item per surface for the across-the-site row. Mental Models
     is still archived; the row carries book + project + principle +
     essay + writeup. Most-recently-active project wins when no
     specific slug is favourited. */
  const acrossBook = BOOKS.find((b) => b.status === 'reading');
  const acrossProject = PROJECTS.find((p) => p.status === 'active') ?? PROJECTS[0];
  // const acrossModel = MENTAL_MODELS.find((m) => m.slug === 'first-principles') ?? MENTAL_MODELS[0];
  const acrossPrinciple = LIFE_PRINCIPLES.find((p) => p.order === 1);
  const acrossEssay = NOTEBOOK_POSTS.find((p) => p.kind === 'essay');
  /* Latest writeup — getWriteups orders machines before techniques,
     then newest-first per the in-table sort. First element is the
     most recently surfaced item in the unified writeups feed. */
  const acrossWriteup = WRITEUPS[0];

  return (
    <>
      {/* -- Hero ---------------------------------------------------- */}
      <section className={styles.heroSection}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <Eyebrow number="01">Polymathy in practice</Eyebrow>
            <LiveTypewriter initialState={initialState} />
            <p className={styles.heroSubtitle}>
              Working files of one mind across eight domains. What I'm building, reading, writing, and studying; kept visible as the work moves, not waiting for it to be ready. Editorial in form, in-progress in substance.
            </p>
          </div>
          <div className={styles.heroHandSlot}>
            <HeroHand />
          </div>
          <div className={styles.heroPortrait}>
            <HeroPortrait />
          </div>
        </div>

        {/* Three live rails directly below the hero */}
        <div className={styles.heroInner}>
          <LiveRails initialState={initialState} />
        </div>

        <hr className={styles.thinRule} />

        <div className={styles.scrollIndicator}>
          <ScrollDrop />
        </div>
      </section>

      {/* -- Featured Notebook strip --------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <Eyebrow number="02">From the notebook</Eyebrow>
            <Link href="/notebook" className={styles.sectionLink}>
              all posts →
            </Link>
          </div>
          <div className={styles.notebookStrip}>
            {recentEssays.map((p) => (
              <Link key={p.slug} href={`/notebook/${p.slug}`} className={styles.featuredCard}>
                <p className={styles.cardKind}>{p.kind}</p>
                <p className={styles.cardTitle}>{p.title}</p>
                {p.dek && <p className={styles.cardDek}>{p.dek}</p>}
                <p className={styles.cardMeta}>
                  <span>{p.date}</span>
                  {p.thread && (
                    <>
                      <span className={styles.cardSep}>·</span>
                      <span className={styles.cardThread}>
                        {NOTEBOOK_THREADS.find((t) => t.slug === p.thread)?.name ?? p.thread}
                      </span>
                    </>
                  )}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -- Active threads ------------------------------------------ */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead}>
            <Eyebrow number="03">Active threads</Eyebrow>
            <Link href="/notebook" className={styles.sectionLink}>
              thread map →
            </Link>
          </div>
          <div className={styles.threadGrid}>
            {activeThreads.map((t) => (
              <Link
                key={t.slug}
                href={`/notebook/threads/${t.slug}`}
                className={styles.threadCard}
              >
                <p className={styles.threadName}>{t.name}</p>
                <p className={styles.threadSummary}>{t.summary}</p>
                <p className={styles.threadMeta}>
                  {t.postCount} {t.postCount === 1 ? 'post' : 'posts'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* -- From across the site ------------------------------------ */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <Eyebrow number="04">From across the site</Eyebrow>
          <div className={styles.acrossGrid}>
            {acrossBook && (
              <Link href={`/library/${acrossBook.slug}`} className={styles.acrossItem}>
                <span className={styles.acrossLabel}>library</span>
                <span className={styles.acrossTitle}>{acrossBook.title}</span>
                <span className={styles.acrossSub}>{acrossBook.author}</span>
              </Link>
            )}
            {acrossProject && (
              <Link href={`/projects/${acrossProject.slug}`} className={styles.acrossItem}>
                <span className={styles.acrossLabel}>projects</span>
                <span className={styles.acrossTitle}>{acrossProject.title}</span>
                <span className={styles.acrossSub}>{acrossProject.tagline}</span>
              </Link>
            )}
            {/* mental-models block still archived. */}
            {acrossPrinciple && (
              <Link href={`/life#principle-${acrossPrinciple.slug}`} className={styles.acrossItem}>
                <span className={styles.acrossLabel}>life plan</span>
                <span className={styles.acrossTitle}>{acrossPrinciple.title}</span>
                <span className={styles.acrossSub}>principle</span>
              </Link>
            )}
            {acrossEssay && (
              <Link href={`/notebook/${acrossEssay.slug}`} className={styles.acrossItem}>
                <span className={styles.acrossLabel}>notebook</span>
                <span className={styles.acrossTitle}>{acrossEssay.title}</span>
                <span className={styles.acrossSub}>{acrossEssay.dek}</span>
              </Link>
            )}
            {acrossWriteup && (
              <Link href={`/writeups/${acrossWriteup.slug}`} className={styles.acrossItem}>
                <span className={styles.acrossLabel}>writeups</span>
                <span className={styles.acrossTitle}>{acrossWriteup.title}</span>
                <span className={styles.acrossSub}>
                  {acrossWriteup.kind === 'machine'
                    ? `${acrossWriteup.platform ?? 'box'}${acrossWriteup.difficulty ? ' · ' + acrossWriteup.difficulty : ''}`
                    : (acrossWriteup.category ?? 'technique')}
                </span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* -- Newsletter ---------------------------------------------- */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <Eyebrow number="05">The weekly email</Eyebrow>
          <NewsletterForm />
        </div>
      </section>

    </>
  );
}
