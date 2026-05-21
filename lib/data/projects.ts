import type { ProjectPage } from '../types';

/*
 * Projects per BRIEF.md Part XIV — Phase 4 commits to entries for
 * Slipwise, PawCare, Helm, DubaiSignal, ECE SaaS, and the brief itself
 * as a meta-project. Slipwise is treated as a more-skeleton-than-substance
 * page per Part VIII privacy considerations.
 */

export const PROJECTS: ProjectPage[] = [
  {
    slug: 'slipwise',
    title: 'Slipwise',
    tagline: 'AI-powered marine insurance technology platform.',
    status: 'active',
    started: '2026-04-01',
    tags: ['marine-insurance', 'ai', 'regulated-tech'],
    repo: 'private',
    repoPrivate: true,
    externalUrl: 'https://slipwise.ai',
    lastActive: '2026-05-16',
    // Currentstate / stuck / decisions deliberately empty per Part VIII —
    // the substance lives outside the public site.
    activity: [
      { date: '2026-05-16T19:47', line: 'commit', branch: 'feat/event-store' },
      { date: '2026-05-16T16:12', line: 'commit', branch: 'feat/event-store' },
      { date: '2026-05-15T22:01', line: 'commit', branch: 'main' },
    ],
  },
  {
    slug: 'pawcare',
    title: 'PawCare',
    tagline: 'A pet-care coordination project — final-year university work.',
    status: 'concluded',
    started: '2026-01-10',
    ended: '2026-04-30',
    tags: ['product', 'university', 'mobile'],
    lastActive: '2026-04-30',
    currentState:
      'Submitted and graded. The project page exists as an archive of what was built and what I learned about coordinating a four-person student team under deadline.',
    decisions: [
      {
        date: '2026-03-08',
        title: 'Drop the social-feed feature from MVP',
        body:
          'Cutting the social feed bought us the four weeks we needed for the booking flow. The right cut, against the team\'s initial instincts.',
      },
      {
        date: '2026-02-12',
        title: 'Use a single Postgres rather than per-microservice DBs',
        body:
          'A single database with schemas per concern was the right call for a four-person, twelve-week project. We would have lost the time reconciling event streams.',
      },
    ],
  },
  {
    slug: 'helm',
    title: 'Helm',
    tagline: 'A personal operating-system project — habit, attention, and deep-work scaffolding.',
    status: 'paused',
    started: '2025-11-01',
    tags: ['personal', 'productivity'],
    lastActive: '2026-04-12',
    currentState:
      'Paused while Slipwise and the MI exam take precedence. The architecture is sound, the daily-pattern code works, and I will come back to it after the UK trip.',
    stuckOn: [
      'Whether to back the morning-review surface with a local SQLite or commit to Postgres up front. The former is faster to ship; the latter matches the longer-term direction.',
    ],
  },
  {
    slug: 'dubaisignal',
    title: 'DubaiSignal',
    tagline: 'A small daily-newsletter experiment around UAE economic and policy signal.',
    status: 'dormant',
    started: '2025-09-01',
    ended: '2025-12-15',
    tags: ['newsletter', 'experiment'],
    lastActive: '2025-12-15',
    currentState:
      'Dormant rather than dead. The hypothesis (that there is room for a serious daily UAE signal newsletter) holds; the constraint is that I do not currently have the time to research and write it well. The archive remains.',
  },
  {
    slug: 'ece-saas',
    title: 'ECE SaaS',
    tagline: 'A teaching-management SaaS for early-childhood educators in the UAE market.',
    status: 'shipped',
    started: '2024-06-01',
    ended: '2025-08-10',
    tags: ['saas', 'edtech'],
    lastActive: '2025-08-10',
    externalUrl: 'https://example.com/ece',
    currentState:
      'Shipped and operational with a small set of paying clients. Maintenance-only from my side; the surface area is intentionally bounded.',
  },
  {
    slug: 'husayngokal-brief',
    title: 'husayngokal.com — the brief',
    tagline: 'The operating document for this site. A meta-project sitting under the Projects Hub deliberately.',
    status: 'active',
    started: '2026-04-15',
    tags: ['site', 'meta'],
    lastActive: '2026-05-16',
    currentState:
      'The brief is the operating document for husayngokal.com — every visual, structural, and architectural decision documented to be defended. The build follows the brief; the brief refers to the build only through the changed-my-mind log when revision is warranted.',
    decisions: [
      {
        date: '2026-04-30',
        title: 'No dark mode',
        body:
          'The entire identity is paper. Dark mode would be hedging on the paper identity. The decision is locked; the posture move is the commitment, not the absence.',
      },
      {
        date: '2026-04-22',
        title: 'Wikilinks plus backlinks is the only knowledge-graph mechanic',
        body:
          'No second linking system, no separate related-posts metadata. One mechanic, all surfaces. The discipline is in not adding a second one.',
      },
      {
        date: '2026-04-18',
        title: 'The personal site and Slipwise are visually separate',
        body:
          'Personal sites that adopt their company\'s identity end up as recruiting pages; company brands that absorb founder aesthetics end up as vanity vehicles. Keep them visually distinct.',
      },
    ],
  },
];

export function getProject(slug: string): ProjectPage | undefined {
  return PROJECTS.find((p) => p.slug === slug);
}
