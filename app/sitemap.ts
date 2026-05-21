import type { MetadataRoute } from 'next';
import { getNotebookPosts, getNotebookThreads } from '@/lib/content/notebook';
import { getBooks } from '@/lib/content/library';
import { getProjects } from '@/lib/content/projects';
import { getCourses } from '@/lib/content/courses';
import { getWriteups } from '@/lib/content/writeups';
import { getCredentials } from '@/lib/content/credentials';
import { getMasterPlanParts } from '@/lib/content/master-plan';
import { getIdeas } from '@/lib/content/ideas';
/* Mental Models + Study remain archived — re-introduce alongside
   the index loop entries + the menu drawer + the search index:
   import { getMentalModels } from '@/lib/content/mental-models';
   import { getStudyCredentials, getStudyDomains } from '@/lib/content/study';
*/

const BASE = 'https://husayngokal.com';

/*
 * Sitemap — drives Google + LinkedIn + social-card crawlers to every
 * indexable URL on the site. Static index routes first, then every
 * detail-page slug pulled from the live DB so the sitemap stays
 * accurate as content moves through the vault → Postgres pipeline.
 */

/* ISR — sitemap regenerates hourly. Search engines don't need
   second-level freshness; the cost of regenerating on every crawler
   hit was wasted budget. Vault webhook calls revalidatePath('/sitemap.xml')
   too, so new content shows up in the sitemap immediately on push. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  /* Mental Models and Study are still archived from the public
     sitemap while the author writes real content. Routes resolve;
     they just aren't surfaced to crawlers / Cmd-K / menu. */
  const indexRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`,               lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/notebook`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/library`,        lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/projects`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE}/courses`,        lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/writeups`,       lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/credentials`,    lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/ideas`,          lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${BASE}/food`,           lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/life`,           lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/life/changed-my-mind`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/life/plan`,      lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/life/tasks`,     lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
  ];

  const [
    posts, threads, books, projects, courses, writeups, credentials,
    masterPlanParts, ideas,
  ] = await Promise.all([
    getNotebookPosts(), getNotebookThreads(),
    getBooks(), getProjects(), getCourses(), getWriteups(), getCredentials(),
    getMasterPlanParts(), getIdeas(),
  ]);

  const detailRoutes: MetadataRoute.Sitemap = [];
  for (const p of posts)        detailRoutes.push({ url: `${BASE}/notebook/${p.slug}`,             lastModified: p.date ? new Date(p.date) : now });
  for (const t of threads)      detailRoutes.push({ url: `${BASE}/notebook/threads/${t.slug}`,    lastModified: now });
  for (const b of books)        detailRoutes.push({ url: `${BASE}/library/${b.slug}`,             lastModified: b.finished ? new Date(b.finished) : now });
  for (const p of projects)     detailRoutes.push({ url: `${BASE}/projects/${p.slug}`,            lastModified: p.lastActive ? new Date(p.lastActive) : now });
  for (const c of courses)      detailRoutes.push({ url: `${BASE}/courses/${c.slug}`,             lastModified: now });
  for (const w of writeups)     detailRoutes.push({ url: `${BASE}/writeups/${w.slug}`,            lastModified: w.date ? new Date(w.date) : now });
  for (const c of credentials)  detailRoutes.push({ url: `${BASE}/credentials/${c.slug}`,         lastModified: now });
  for (const m of masterPlanParts) detailRoutes.push({ url: `${BASE}/life/plan/${m.slug}`,        lastModified: now });
  for (const i of ideas)        detailRoutes.push({ url: `${BASE}/ideas/${i.slug}`,             lastModified: i.proposed ? new Date(i.proposed) : now });

  return [...indexRoutes, ...detailRoutes];
}
