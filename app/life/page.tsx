import Link from 'next/link';
import { Eyebrow, ManifestoCallout } from '@/components/Primitives';
import { getMotto, getLifePrinciples } from '@/lib/content/life';
import { getMasterPlanParts } from '@/lib/content/master-plan';
import { getTasks } from '@/lib/content/tasks';
import { renderMarkdown } from '@/lib/markdown';

export const revalidate = 60; // ISR; regenerates every 60s. Vault webhook calls revalidatePath() on push.

/*
 * Life Plan main page (Part XI).
 *
 * Two pillar cards at the top promote the two surfaces that carry
 * the actual operational weight: the Master Plan (what the work
 * looks like) and the Tasks (what the work is right now). Then the
 * constitutional content: motto + philosophy + building-in-public
 * framework.
 *
 * Story / Journey / Goals / Changed-my-mind are deliberately hidden
 * in this revision while the author writes their real content for
 * those sections. The getters and the underlying tables (and the
 * TimelineEntry / DecisionLogEntry primitives) are kept intact so
 * the sections can be re-enabled by reverting this trim; no schema
 * or data was deleted. Search "HIDDEN SECTIONS" to find the spot.
 */

export const metadata = {
  title: 'Life Plan',
  description:
    'The constitutional surface. Motto, operating principles, and the building-in-public framework. Master Plan and Tasks live at /life/plan and /life/tasks.',
};

export default async function LifePage() {
  const [MOTTO, LIFE_PRINCIPLES, PLAN_PARTS, TASKS] = await Promise.all([
    getMotto(), getLifePrinciples(),
    getMasterPlanParts(), getTasks(),
  ]);

  /* Pre-render each principle's body markdown so wikilinks like
     [[ai-usage-constitution]] resolve to live notebook URLs and don't
     surface as raw double-brackets on the page. */
  const principlesWithHtml = await Promise.all(
    LIFE_PRINCIPLES.map(async (p) => ({
      principle: p,
      bodyHtml: p.body ? await renderMarkdown(p.body, 'life_principles') : null,
    })),
  );

  const taskCounts = {
    total: TASKS.length,
    open: TASKS.filter((t) => t.status === 'open').length,
    inProgress: TASKS.filter((t) => t.status === 'in-progress').length,
    done: TASKS.filter((t) => t.status === 'done').length,
  };

  return (
    <div className="page page--life">
      <Eyebrow number="11">Life Plan</Eyebrow>

      {/* Two pillar cards: the operating document + the live work
          queue. Both deserve to be the first things a reader sees,
          not collapsed to tiny links. */}
      <div className="lifePillars">
        <Link href="/life/plan" className="lifePillar">
          <p className="lifePillarLabel">The Master Plan</p>
          <p className="lifePillarTitle">
            The operating document that underwrites the rest of the site.
          </p>
          <p className="lifePillarDek">
            Eighteen Parts. Roughly 880 pages. Identity, ten technical
            domains, the build-to-understand loop, the AI usage
            constitution, the phases, the season structure, the first
            ninety artifacts. Written privately as a working brief;
            published here for accountability.
          </p>
          <p className="lifePillarCTA">
            {PLAN_PARTS.length} Parts · read in order or jump in →
          </p>
        </Link>

        <Link href="/life/tasks" className="lifePillar">
          <p className="lifePillarLabel">Current Tasks</p>
          <p className="lifePillarTitle">
            What I am actively working on, with status, in public.
          </p>
          <p className="lifePillarDek">
            Smaller than goals. Finer than the Master Plan&apos;s
            artifact backlog. Every item here is something you can
            ask me about. Daily, weekly, monthly, lifetime; recurring
            routines too. Status flips happen in the vault; the
            public view is read-only.
          </p>
          <p className="lifePillarCTA">
            {taskCounts.total} total ·
            {' '}{taskCounts.open} open ·
            {' '}{taskCounts.inProgress} in progress ·
            {' '}{taskCounts.done} done →
          </p>
        </Link>
      </div>

      {/* Motto */}
      <p className="lifeMotto">{MOTTO.text}</p>

      {/* Philosophy / Principles */}
      {principlesWithHtml.length > 0 && (
        <>
          <h2 className="lifeSectionTitle">Philosophy</h2>
          <p className="lifeSubTitle">
            {principlesWithHtml.length === 1
              ? 'One operating principle'
              : `${spellOut(principlesWithHtml.length)} operating principles`}
          </p>
          {principlesWithHtml.map(({ principle: p, bodyHtml }) => (
            <div className="lifePrinciple" key={p.slug} id={`principle-${p.slug}`}>
              <ManifestoCallout label={p.title}>
                <p>{p.manifesto}</p>
              </ManifestoCallout>
              {bodyHtml && (
                <div
                  className="lifePrincipleBody"
                  dangerouslySetInnerHTML={{ __html: bodyHtml }}
                />
              )}
            </div>
          ))}
        </>
      )}

      {/* -------- HIDDEN SECTIONS --------
          Story / Journey / Goals / Changed-my-mind are intentionally
          suppressed in this revision while the author writes their
          real content. To re-enable: restore the JSX from git history
          (commit before this one) and re-add getStoryVignettes /
          getJourneyEntries / getLifeGoals / getChangedMyMind to the
          imports + Promise.all above. The Postgres tables and the
          TimelineEntry / DecisionLogEntry primitives are untouched
          so a revert is the only change needed.
      */}

      {/* Building in public, bounded framework */}
      <h2 className="lifeSectionTitle">Building in public, with edges</h2>
      <p>
        Publishing the work is not the goal. The accountability that
        publishing produces is the goal.
      </p>
      <p>
        I publish architectural decisions, position changes, and what
        I learned this week. I do not publish client work, family
        details, or anything that requires more context than a
        paragraph can carry. The schedule is the discipline. Sunday is
        the weekly accountability note. End of month is the site-state
        note. End of quarter is the goal review. End of year is the
        full retrospective.
      </p>
      <p>
        The framework is the point. Without the framework, building in
        public degrades into either over-sharing or under-sharing.
        Both are worse than not building in public at all.
      </p>
    </div>
  );
}

/* Editorial: render small counts as words ("Seven operating principles",
   not "7 operating principles"). Falls back to digits for >10 because the
   word forms get clunky. */
function spellOut(n: number): string {
  const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
  return n <= 10 ? (words[n] ?? String(n)) : String(n);
}
