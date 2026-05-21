import type { NotebookPost, NotebookThread } from '../types';

/*
 * Sample notebook posts establishing the surface during Phase 1. Bodies
 * are intentionally short — placeholders for real essays that will
 * arrive through the Obsidian pipeline. Voice is the
 * conversational-with-editorial-discipline register documented in Part I.
 */

export const NOTEBOOK_THREADS: NotebookThread[] = [
  {
    slug: 'certifying-vs-learning',
    name: 'Certifying versus learning',
    summary:
      'On the difference between passing exams and actually knowing things. The argument that credentials are artifacts, not proxies.',
    state: 'active',
  },
  {
    slug: 'building-slipwise-in-public',
    name: 'Building Slipwise in public',
    summary:
      'A bounded thread on what can be said publicly while building a regulated marine insurance product. Decisions, not client work.',
    state: 'active',
  },
  {
    slug: 'partition-citizenship',
    name: 'Partition citizenship',
    summary:
      'Reading notes accumulating around Zamindar and the long aftermath of 1947 — citizenship as bureaucratic invention rather than identity claim.',
    state: 'active',
  },
  {
    slug: 'polymathy-in-practice',
    name: 'Polymathy in practice',
    summary:
      'Notes on working across many domains without becoming a dilettante. Practice as the verb that does the load-bearing.',
    state: 'active',
  },
  {
    slug: 'ai-usage-constitution',
    name: 'The AI usage constitution',
    summary:
      'What it costs to delegate parts of your thinking. The principles I work by, written down to be defended.',
    state: 'dormant',
  },
];

export const NOTEBOOK_POSTS: NotebookPost[] = [
  {
    slug: 'on-certifying-and-learning',
    kind: 'essay',
    title: 'On certifying and learning',
    dek: 'Why credentials are artifacts of learning, not proxies for it.',
    date: '2026-05-12',
    thread: 'certifying-vs-learning',
    tags: ['education', 'credentials', 'learning'],
    epistemicStatus: 'settled, revised twice',
    wordCount: 2840,
    body: `
There is a sort of professional theatre that surrounds adult learning, in which the artefact — the certificate, the badge, the line on the resume — is mistaken for the thing the artefact was supposed to mark. The artefact gets defended, accumulated, listed in chronological order. The thing it was supposed to mark goes unexamined.

I have a five-state taxonomy for my own knowledge, and I keep it visible on this site. The states are *dabbled*, *learning*, *working-in*, *teaching-from*, and *decayed*. The most important of the five is the last one. Most professional sites pretend that knowledge, once acquired, remains. Mine does not. A skill I learned in 2018 and have not used since 2021 is decayed, and the Study Log says so.

This is the test I want to apply to my own credentials. Not "did I pass?" but "what stuck?" The two are not the same question.

The CAPM — the credential I earned in late 2025 — taught me a framework for thinking about scope, schedule, and cost trade-offs that has been quietly useful in client conversations ever since. That is what stuck. The PMI-specific terminology rarely matters outside formal PMI environments; I translate to plain English in practice. That is what did not.

I want every credential I list to carry that pair of paragraphs. Anything else is theatre.
`.trim(),
  },
  {
    slug: 'open-notebook-as-discipline',
    kind: 'note',
    title: 'Open notebook as discipline, not vanity',
    date: '2026-05-09',
    thread: 'polymathy-in-practice',
    tags: ['site', 'method'],
    wordCount: 540,
    body: `
The argument against an open notebook is usually that it is vain. The author is publishing in-progress thinking; the implication is that the thinking is not ready and the publishing is performative.

The argument *for* an open notebook is that it is the only way I have found to be honest with myself about what I am actually thinking, as opposed to what I will later remember thinking. The thread map on this notebook is the receipt of my reasoning; it is harder to revise the past silently when the past is in public.

Vanity would be polishing the notebook. Discipline is leaving it slightly rough.
`.trim(),
  },
  {
    slug: 'partition-as-bureaucratic-invention',
    kind: 'essay',
    title: 'Partition as bureaucratic invention',
    dek: 'Zamindar argues that the boundary made the migration, not the other way around.',
    date: '2026-05-04',
    thread: 'partition-citizenship',
    tags: ['history', 'south-asia', 'reading'],
    epistemicStatus: 'thinking out loud',
    wordCount: 1740,
    body: `
I am forty-seven percent through *The Long Partition* and the most useful thing in the book so far is the way Zamindar reframes the standard "millions migrated across a new border" story. The border did not pre-exist the migration as a fact people moved across. The border *was made* through the act of moving — through the permits, the registrations, the citizenship determinations, the property claims processed at provincial offices.

This is not a small correction. It changes who the actors in the story are. The peasant who walked west in 1947 is in one version a refugee crossing a fact; in Zamindar's version, the peasant is half of a system that *makes* the fact retroactively legible. The official with the rubber stamp is the other half. Together they invent the boundary by enacting it.

I am taking this slowly. It connects to a larger thread I have been wanting to write about — the way institutions retroactively rationalise the contingent, and the way "always was" is most often the past tense of "is being made right now".
`.trim(),
  },
  {
    slug: 'slipwise-may-2026-update',
    kind: 'note',
    title: 'Slipwise — what I can say publicly this month',
    date: '2026-05-02',
    thread: 'building-slipwise-in-public',
    tags: ['slipwise', 'build-in-public'],
    wordCount: 380,
    body: `
The boundary I am working with for what gets published here: nothing client-specific, nothing underwriting-specific, nothing that would surprise a regulator to read on a public blog.

Inside those boundaries: the architectural decisions, the lessons about regulated-tech as a category, the operational disciplines I am developing, the things I have changed my mind about. This month the biggest change is that we have moved the event store decisions out of the application layer and into a separate library; that is a decision I would have argued against six weeks ago, and I want to write up the argument I lost.
`.trim(),
  },
  {
    slug: 'four-channel-real-time-presentation',
    kind: 'note',
    title: 'Four channels is the right number for live presence',
    date: '2026-04-26',
    tags: ['site', 'design'],
    wordCount: 290,
    body: `
The homepage now has three pulse-bearing rails and the typewriter. That is four channels of live presence. I have tried more and it competes; I have tried fewer and the page reads as static.

The trick is that orange — the only color that moves on the site — is doing the work of saying "look here" without me having to label the affordance. Visitors learn the pattern automatically in two visits. The third channel is the one where the legibility tipped from "decorative" to "infrastructure".
`.trim(),
  },
  {
    slug: 'epistemic-status-line',
    kind: 'note',
    title: 'On the epistemic status line',
    date: '2026-04-18',
    thread: 'polymathy-in-practice',
    tags: ['site', 'method'],
    wordCount: 410,
    body: `
A small monospace line at the top of an essay — *epistemic status: thinking out loud*, or *settled, revised twice*, or *deliberately provocative* — does most of the work that a long disclaimer would, with none of the throat-clearing.

It tells the reader what register to read in. It tells me what register I am committing to. It makes the difference between confidence and exploration explicit, which means I can write both without conflating them.

Borrowed from Scott Alexander. Not every post needs one — only the ones where the reader benefits from knowing.
`.trim(),
  },
];

export function getThreadPosts(slug: string) {
  return NOTEBOOK_POSTS.filter((p) => p.thread === slug);
}
