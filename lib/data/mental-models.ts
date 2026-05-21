import type { MentalModel } from '../types';

/*
 * Mental Models — the working set as of May 2026.
 *
 * Six entries, all curated rather than original — these are well-known
 * frameworks I reach for. Each carries a bespoke mark in /components/
 * marks/ModelMark.tsx and a personal framing as the manifesto callout.
 *
 * Husayn's framings here are first-draft placeholders that capture the
 * shape; revise as the actual use of each model deepens. The model body
 * sticks closer to the canonical explanation so that someone unfamiliar
 * with the model can read the body alone and understand it.
 */

export const MENTAL_MODELS: MentalModel[] = [
  {
    slug: 'eisenhower-matrix',
    title: 'Eisenhower Matrix',
    origin: 'Dwight D. Eisenhower (paraphrased), popularised by Stephen Covey',
    type: 'curated',
    related: ['decision-matrix', 'iceberg-model'],
    tags: ['prioritisation', 'method'],
    lastReviewed: '2026-05-17',
    depth: 'working-in',
    oneLine: 'Urgent and important are not the same word. Force them apart.',
    body:
      'Tasks classified across two axes — urgency on one and importance on the other — into four quadrants. Q1 (urgent and important) gets done; Q2 (important but not urgent) gets scheduled; Q3 (urgent but not important) gets delegated or batched; Q4 (neither) gets dropped. The attribution is to Eisenhower\'s 1954 Northwestern speech and the popularisation is owed to Stephen Covey\'s The 7 Habits of Highly Effective People.',
    framing:
      'The matrix is two questions stapled together — is this urgent, and is this important — and the value is in forcing them to be different questions. By default I conflate them; urgency is loud and importance is silent, so urgency wins. I do not draw the matrix every day. I draw it when a week has slipped past on urgent-but-not-important things and I need to see the leak.',
    whenToReach: [
      'Triaging a backlog when "everything feels urgent".',
      'End-of-week reviews when the week\'s output does not match the week\'s stated priorities.',
      'Deciding what to drop, not just what to add.',
    ],
    whenNotTo: [
      'For real-time prioritisation where the cost of writing it down exceeds the cost of just doing the next thing.',
      'When the actual problem is that "important" is undefined — fix that first.',
    ],
    inTheWild: [
      { href: '/projects/husayngokal-brief', label: 'The brief', sub: 'meta-project — a Q2 commitment that earned the time' },
    ],
    sources: [
      { label: 'Stephen Covey — The 7 Habits of Highly Effective People (1989)' },
    ],
  },

  {
    slug: 'iceberg-model',
    title: 'Iceberg Model',
    origin: 'Systems-thinking tradition (Donella Meadows, Peter Senge)',
    type: 'curated',
    related: ['reinforcing-feedback-loop', 'first-principles'],
    tags: ['systems', 'method'],
    lastReviewed: '2026-05-17',
    depth: 'working-in',
    oneLine: 'The visible event is the smallest part of what is going on.',
    body:
      'A visible event sits above the waterline. Below are patterns over time, then the underlying structures that produce those patterns, then the mental models that produced those structures. To change events durably you have to operate below the waterline — at the structures and the models. The model comes from the systems-thinking tradition, codified by Donella Meadows and folded into wider practice via Peter Senge.',
    framing:
      'Most arguments stay at the event layer because events are visible and structures are not. The iceberg is the reminder to ask three times — "what pattern is this an instance of?" — before settling on a fix. The fix at the event layer almost always recurs; the fix at the structure layer almost never does.',
    whenToReach: [
      'A recurring problem that "shouldn\'t" keep happening.',
      'Designing an organisation, a process, or a long-running project.',
      'Diagnosing why a fix did not stick.',
    ],
    whenNotTo: [
      'Genuine one-off events with no pattern attached.',
      'Acute crises that need a first-order response now; do the iceberg pass afterwards.',
    ],
    inTheWild: [
      { href: '/projects/slipwise', label: 'Slipwise', sub: 'regulated-tech — most fixes have to live below the waterline' },
    ],
    sources: [
      { label: 'Donella Meadows — Thinking in Systems (2008)' },
      { label: 'Peter Senge — The Fifth Discipline (1990)' },
    ],
  },

  {
    slug: 'decision-matrix',
    title: 'Decision Matrix',
    origin: 'Stuart Pugh and the formal decision-analysis tradition',
    type: 'curated',
    related: ['eisenhower-matrix', 'first-principles'],
    tags: ['decision-making', 'method'],
    lastReviewed: '2026-05-17',
    depth: 'dabbled',
    oneLine: 'A scoring tool that mostly works by surfacing the preference you already had.',
    body:
      'Options as rows, criteria as columns, weights assigned to each criterion, scores assigned to each option, totals computed. The option with the highest weighted total is the "winner". Formalised in engineering decision-making by Stuart Pugh and widely used in design and product contexts.',
    framing:
      'I use this sparingly because it pretends decisions are computable. The actual value is in the act of writing the criteria honestly. Most of the time when I run a decision matrix the criteria reveal that I had a preferred option before I started — and at that point the matrix has done its work and I can just admit the preference. The model is, in practice, a preference-surfacing tool wearing the costume of a scoring tool.',
    whenToReach: [
      'Genuinely-comparable options where my own preference is not yet clear.',
      'Conversations with collaborators where shared criteria need to be made explicit.',
    ],
    whenNotTo: [
      'Decisions where the dimensions cannot honestly be reduced to numbers — identity decisions, ethical decisions, decisions about what to do with a life.',
      'When you find yourself adjusting the weights to make the matrix agree with the answer you wanted. Stop weighting and admit the answer.',
    ],
    sources: [
      { label: 'Stuart Pugh — Total Design (1991)' },
    ],
  },

  {
    slug: 'concept-map',
    title: 'Concept Map',
    origin: 'Joseph Novak and D. Bob Gowin, Cornell University (1970s)',
    type: 'curated',
    related: ['first-principles', 'iceberg-model'],
    tags: ['learning', 'method', 'writing'],
    lastReviewed: '2026-05-17',
    depth: 'working-in',
    oneLine: 'Label the arrow, not just the boxes.',
    body:
      'A diagram of concepts (nodes) connected by lines (edges), where each edge carries a labeled relationship — a verb, a preposition, a phrase. Developed by Joseph Novak\'s team at Cornell in the 1970s as a tool for surfacing what a learner understands. The labeled-edge constraint is the load-bearing part: an unlabeled arrow is not yet a concept map.',
    framing:
      'I draw concept maps before I am ready to write. The discipline of labeling the arrow — making the relationship an actual verb rather than the word "related" — is what exposes which connections I understand and which I am waving at. A concept map with unlabeled arrows is a draft that has not been thought through; a concept map with three-word verbs on every arrow is a paragraph in disguise.',
    whenToReach: [
      'Studying a new domain — concept maps are the artifact that proves you have learned it.',
      'Planning a long essay; the map becomes the outline.',
      'Trying to understand someone else\'s mental model by mapping their writing.',
    ],
    whenNotTo: [
      'Communicating to readers who do not share the underlying vocabulary — concept maps demand the reader read both nodes and edges, and most readers will not.',
    ],
    sources: [
      { label: 'Joseph Novak — Learning, Creating, and Using Knowledge (1998)' },
    ],
  },

  {
    slug: 'first-principles',
    title: 'First Principles',
    origin: 'Aristotle; revived in modern usage by physicists and (more loosely) startup discourse',
    type: 'curated',
    related: ['concept-map', 'decision-matrix'],
    tags: ['epistemics', 'method'],
    lastReviewed: '2026-05-17',
    depth: 'learning',
    oneLine: 'Reason from the irreducibles, but earn the right to first.',
    body:
      'Reduce a problem to its irreducible truths — propositions that cannot be deduced from anything more basic — and reason up from there, rather than reasoning by analogy to existing solutions. The tradition runs from Aristotle\'s Posterior Analytics through Descartes to the working physicist who reaches for it whenever the textbook answer breaks.',
    framing:
      'Most invocations of first-principles thinking on the internet are "I do not like the conventional answer". The real discipline is harder: it requires knowing the conventional answer well enough to identify which premise is actually negotiable, and that requires having done the conventional learning first. I reach for first principles when the conventional approach has obviously failed my specific case and I have spent enough time inside it to know why it usually works.',
    whenToReach: [
      'When the conventional approach concretely fails the situation and you have a clear account of which premise it is failing on.',
      'In domains where you have done the foundational learning and have earned the standing to question the defaults.',
    ],
    whenNotTo: [
      'As a rhetorical move to dismiss the conventional answer without engaging with it.',
      'In domains where you have not yet learned what the defaults are. You cannot reason "from first principles" against assumptions you have not understood.',
    ],
    sources: [
      { label: 'Aristotle — Posterior Analytics' },
      { label: 'René Descartes — Discourse on the Method (1637)' },
    ],
  },

  {
    slug: 'reinforcing-feedback-loop',
    title: 'Reinforcing Feedback Loop',
    origin: 'Cybernetics — Norbert Wiener, Jay Forrester, Donella Meadows',
    type: 'curated',
    related: ['iceberg-model'],
    tags: ['systems', 'method'],
    lastReviewed: '2026-05-17',
    depth: 'working-in',
    oneLine: 'An output that increases its own input. Most things worth building are one of these.',
    body:
      'A feedback loop in which an output of a system feeds back into the system in a way that increases the same output. Growth, runaway, virality, compounding. Distinct from balancing loops, which seek equilibrium. The vocabulary comes from cybernetics — Norbert Wiener\'s 1948 book, then Jay Forrester\'s system dynamics work, then Donella Meadows\' popularisation.',
    framing:
      'Most ambitious things worth building are reinforcing loops in disguise. Writing makes my thinking sharper, which makes the next piece of writing better, which earns readers who push back, which sharpens the thinking again. The hard part is not designing the loop. It is noticing when one is forming around something I am doing — and not killing it accidentally with a process improvement that breaks the cycle.',
    whenToReach: [
      'Designing systems that are supposed to grow over time.',
      'Diagnosing why something is accelerating, for good or for bad.',
      'Building products where retention and momentum matter more than first use.',
    ],
    whenNotTo: [
      'For systems you want to remain stable; you want a balancing loop there, not a reinforcing one.',
      'When the apparent acceleration is actually external — do not credit your loop for a tailwind.',
    ],
    inTheWild: [
      { href: '/notebook/threads/polymathy-in-practice', label: 'Polymathy in practice (thread)', sub: 'the writing → thinking → writing loop' },
    ],
    sources: [
      { label: 'Norbert Wiener — Cybernetics (1948)' },
      { label: 'Donella Meadows — Thinking in Systems (2008)' },
    ],
  },
];

export function getModel(slug: string): MentalModel | undefined {
  return MENTAL_MODELS.find((m) => m.slug === slug);
}
