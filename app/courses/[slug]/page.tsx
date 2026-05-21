import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Chip, StatusPill, SectionRule } from '@/components/Primitives';
import { UniversityChip } from '@/components/UniversityChip';
import { getCourse, getCourses } from '@/lib/content/courses';
import { getUniversity } from '@/lib/universities';
import { renderMarkdown } from '@/lib/markdown';
import { Backlinks } from '@/components/Backlinks';
import styles from './course.module.css';

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

export async function generateStaticParams() {
  const cs = await getCourses();
  return cs.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCourse(slug);
  return c ? { title: `${c.code ? c.code + ' — ' : ''}${c.title}` } : {};
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCourse(slug);
  if (!c) notFound();

  const html = c.body ? await renderMarkdown(c.body, 'courses') : null;
  const uni = getUniversity(c.university);

  /* ETA — if user has set weekly_hours and we know the total, derive
     weeks. Else just show the total. */
  const eta = c.estTotalHours && c.weeklyHours
    ? Math.ceil(c.estTotalHours / c.weeklyHours)
    : null;

  /* Prerequisite course lookups for linking */
  const allCourses = c.prerequisites?.length ? await getCourses() : [];
  const prereqLinks = (c.prerequisites ?? []).map((p) => {
    const m = allCourses.find((x) => x.code === p || x.slug === p);
    return m ? { slug: m.slug, label: m.code ? `${m.code} — ${m.title}` : m.title }
             : { slug: null, label: p };
  });

  return (
    <div className="page page--wide" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      {/* Banner */}
      {c.bannerImage && (
        <div className={styles.banner}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.bannerImage} alt="" />
        </div>
      )}

      <header className={styles.head}>
        <p className={styles.kicker}>
          <UniversityChip slug={c.university} />
          {c.department && <span className={styles.dept}>{c.department}</span>}
          {c.code && <span className={styles.code}>{c.code}</span>}
        </p>
        <h1 className={styles.title}>{c.title}</h1>
        <p className={styles.meta}>
          <StatusPill status={c.status as never} label={c.status} />
          {c.estTotalHours && (
            <>
              <span className={styles.dot}>·</span>
              <span>~{c.estTotalHours} hours total</span>
            </>
          )}
          {eta != null && (
            <>
              <span className={styles.dot}>·</span>
              <span className={styles.daysOrange}>
                ETA: {eta} {eta === 1 ? 'week' : 'weeks'} at {c.weeklyHours} h/wk
              </span>
            </>
          )}
        </p>
      </header>

      {/* Professors + textbooks + prereqs in a metadata grid */}
      <section className={styles.metaGrid}>
        {c.professors?.length && (
          <div>
            <p className={styles.metaLabel}>Professor{c.professors.length === 1 ? '' : 's'}</p>
            <ul className={styles.profList}>
              {c.professors.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
        )}
        {c.textbooks?.length && (
          <div>
            <p className={styles.metaLabel}>Textbook{c.textbooks.length === 1 ? '' : 's'}</p>
            <ul className={styles.bookList}>
              {c.textbooks.map((b, i) => (
                <li key={i}>
                  <p className={styles.bookTitle}>{b.title}</p>
                  <p className={styles.bookMeta}>
                    {b.authors}
                    {b.edition && <> · {b.edition}</>}
                    {b.isbn && <> · ISBN {b.isbn}</>}
                    {b.freeLink && (
                      <> · <a href={b.freeLink} rel="noopener" className={styles.bookLink}>free copy</a></>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
        {prereqLinks.length > 0 && (
          <div>
            <p className={styles.metaLabel}>Prerequisites</p>
            <ul className={styles.bullets}>
              {prereqLinks.map((p, i) => (
                <li key={i}>
                  {p.slug ? <Link href={`/courses/${p.slug}`}>{p.label}</Link> : p.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(c.sourceUrl || c.videoUrl) && (
          <div>
            <p className={styles.metaLabel}>Materials</p>
            <ul className={styles.bullets}>
              {c.sourceUrl && <li><a href={c.sourceUrl} rel="noopener">Course page →</a></li>}
              {c.videoUrl && <li><a href={c.videoUrl} rel="noopener">Lecture videos →</a></li>}
            </ul>
          </div>
        )}
      </section>

      {/* Body / personal framing */}
      {html && (
        <section className={styles.body}>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </section>
      )}

      {/* Syllabus */}
      {c.syllabus?.length && (
        <section className={styles.syllabus}>
          <h2 className={styles.h2}>Syllabus</h2>
          <ol className={styles.syllabusList}>
            {c.syllabus.map((s, i) => (
              <li key={i} className={styles.syllabusItem}>
                <div className={styles.syllabusWeek}>{s.week ? `Week ${s.week}` : `#${i + 1}`}</div>
                <div>
                  <p className={styles.syllabusTopic}>{s.topic}</p>
                  {s.reading && <p className={styles.syllabusReading}>{s.reading}</p>}
                  {s.deliverables && <p className={styles.syllabusDeliv}>{s.deliverables}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Backlinks table="courses" slug={c.slug} />
    </div>
  );
}
