import type { Book } from '../types';

/*
 * The 2026 reading plan — concrete books drawn from the brief's
 * recurring example ("The Long Partition") plus a representative
 * cross-section of the eight study domains and the polymathic register
 * the site commits to. The full 42-book plan is incrementally filled
 * during Phase 2 (BRIEF.md Part XIV).
 */

export const PLAN_YEAR = 2026;
export const PLAN_TARGET = 42;

export const BOOKS: Book[] = [
  {
    slug: 'the-long-partition',
    title: 'The Long Partition and the Making of Modern South Asia',
    author: 'Vazira Fazila-Yacoobali Zamindar',
    isbn: '9780231138482',
    status: 'reading',
    year: 2026,
    started: '2026-04-10',
    genre: ['history', 'south-asia'],
    language: 'english',
    source: 'recommended by a friend',
    progressPct: 47,
    notes: `
*p.41* — the border is enacted by the rubber stamp before it is enacted by the soldier.

*p.118* — the citizenship form is the most important artefact of the partition because it is what makes "citizen of Pakistan" or "citizen of India" into a category that can be denied.

*p.204* — the long part of the long partition is the bureaucratic part.
`.trim(),
  },
  {
    slug: 'the-pragmatist-imagination',
    title: 'The Pragmatist Imagination',
    author: 'Joan Ockman (ed.)',
    status: 'reading',
    year: 2026,
    started: '2026-03-20',
    genre: ['philosophy', 'architecture'],
    language: 'english',
    progressPct: 22,
  },
  {
    slug: 'designing-data-intensive-applications',
    title: 'Designing Data-Intensive Applications',
    author: 'Martin Kleppmann',
    status: 're-reading',
    year: 2026,
    started: '2026-02-01',
    genre: ['computer-science', 'systems'],
    language: 'english',
    progressPct: 65,
    rating: 5,
    notes: '*Re-read* — coming back to it through the lens of the Slipwise event store work. The chapter on stream processing reads differently when you are actually building one.',
  },
  {
    slug: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    status: 'finished',
    year: 2026,
    started: '2026-01-04',
    finished: '2026-02-12',
    rating: 4,
    genre: ['philosophy', 'classics'],
    language: 'english',
    review: 'A book to re-read once a year rather than to finish. The Hays translation is the one that holds up.',
  },
  {
    slug: 'quantum-computing-explained',
    title: 'Quantum Computing: An Applied Approach',
    author: 'Jack D. Hidary',
    status: 'reading',
    year: 2026,
    started: '2026-03-01',
    genre: ['physics', 'computer-science'],
    language: 'english',
    progressPct: 33,
    source: 'study reference for Qiskit Advocate',
  },
  {
    slug: 'introduction-to-shipping',
    title: 'Introduction to Shipping',
    author: 'Institute of Chartered Shipbrokers',
    status: 'finished',
    year: 2026,
    started: '2026-01-15',
    finished: '2026-04-30',
    rating: 4,
    genre: ['professional', 'shipping'],
    language: 'english',
    review: 'Dense, exam-driven, but the underlying picture of a global chartering market becomes clear by the end.',
  },
  {
    slug: 'marine-insurance-textbook',
    title: 'Marine Insurance',
    author: 'Institute of Chartered Shipbrokers',
    status: 'reading',
    year: 2026,
    started: '2026-03-15',
    genre: ['professional', 'insurance'],
    language: 'english',
    progressPct: 88,
    source: 'study reference for the ICS Marine Insurance exam on May 20',
  },
  {
    slug: 'thinking-in-systems',
    title: 'Thinking in Systems: A Primer',
    author: 'Donella Meadows',
    status: 'planned',
    year: 2026,
    genre: ['systems', 'method'],
    language: 'english',
  },
  {
    slug: 'the-rise-of-the-network-society',
    title: 'The Rise of the Network Society',
    author: 'Manuel Castells',
    status: 'planned',
    year: 2026,
    genre: ['sociology', 'technology'],
    language: 'english',
  },
  {
    slug: 'the-mythical-man-month',
    title: 'The Mythical Man-Month',
    author: 'Fred Brooks',
    status: 'finished',
    year: 2026,
    started: '2026-01-08',
    finished: '2026-01-22',
    rating: 5,
    genre: ['computer-science', 'classics'],
    language: 'english',
    review: 'Sixty years on and the surgical team chapter still describes the team Slipwise has been organising itself toward, badly, for months.',
  },
  {
    slug: 'al-ghazali-deliverance-from-error',
    title: 'Deliverance from Error',
    author: 'Al-Ghazālī',
    status: 'planned',
    year: 2026,
    genre: ['philosophy', 'islamic-thought'],
    language: 'english',
  },
  {
    slug: 'tufte-visual-display',
    title: 'The Visual Display of Quantitative Information',
    author: 'Edward R. Tufte',
    status: 'finished',
    year: 2026,
    started: '2026-02-15',
    finished: '2026-03-10',
    rating: 5,
    genre: ['design', 'data'],
    language: 'english',
    review: 'The sidenote convention on this site is borrowed straight from Tufte. The book is permanent reference, not a one-time read.',
  },
];

export function getBook(slug: string): Book | undefined {
  return BOOKS.find((b) => b.slug === slug);
}

export function planSummary(year: number = PLAN_YEAR) {
  const inYear = BOOKS.filter((b) => b.year === year);
  return {
    target: PLAN_TARGET,
    finished: inYear.filter((b) => b.status === 'finished').length,
    reading: inYear.filter((b) => b.status === 'reading' || b.status === 're-reading').length,
    abandoned: inYear.filter((b) => b.status === 'abandoned').length,
    planned: inYear.filter((b) => b.status === 'planned').length,
  };
}
