# husayngokal.com

A personal encyclopedia at editorial design grade. The public working files of one
mind across eight domains: software, security, reading, writing, study, and a life
plan kept visible as the work moves.

Built with Next.js 15 (App Router), React 19, and TypeScript. Custom CSS variables,
no Tailwind, no UI library. Type stack: Source Serif 4, IBM Plex Sans, IBM Plex Mono.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
```

Node 22+ required. Copy the environment variables you need into a local `.env`
(Supabase, GitHub vault sync, R2, Spotify, location). The site degrades gracefully
when a service is not configured, so it runs without every integration set.

## How it works

Content is authored in an Obsidian vault (a separate Git repository) and mirrored
into Postgres. On every push to the vault, a webhook fetches the tree, parses each
`.md` file, and upserts it to its mapped table in about thirty seconds. The site
reads from Postgres, with typed getters per surface and small static fallbacks so a
missing database never blanks a page.

The homepage carries a live "now" state: what is currently being read, built,
written, and studied, derived from the content tables and refreshed over a realtime
channel after hydration.

```
npm run vault:sync     # manual sync, same code path as the webhook
npm run derive         # recompute the homepage live state
npm run library:enrich # Open Library lookup + cover upload for the library
```

## Surfaces

| Surface | Route | Notes |
|---|---|---|
| Notebook | `/notebook` | Essays, threads, notes |
| Library | `/library` | Reading log with notes and reviews |
| Projects | `/projects` | Project records and activity |
| Courses | `/courses` | Coursework log |
| Writeups | `/writeups` | Machines and techniques |
| Credentials | `/credentials` | Downloadable PDFs |
| Ideas | `/ideas` | Proposal log |
| Food | `/food` | A labelled photo gallery |
| Life Plan | `/life` | Master plan, tasks, calendar, changed-my-mind log |

## Project layout

```
/app             Next.js App Router pages, one folder per surface
  /api           route handlers (vault webhook, spotify, location, newsletter)
/components      React components
  /marks         bespoke hand-line SVGs
/lib             typed content, state, and search index
  /content       getters per surface, reading from Postgres
  /vault         sync + parse
/scripts         maintenance scripts
/supabase        SQL migrations
/public          static assets
```

## Conventions

- No emoji, anywhere.
- No em-dashes in user-visible copy (period, comma, colon, parentheses instead).
- No dark mode. The paper register is fixed.
- Orange is the only colour that moves.
- Bespoke SVG marks only, no stock icon sets.
- Wikilinks plus backlinks are the single cross-surface linking mechanic.
- WCAG AA minimum on every text-on-background pairing, `prefers-reduced-motion`
  honoured on every animation.

## Deployment

Deployed on Vercel. Media (book covers, the food gallery) is served from Cloudflare
R2 behind `media.husayngokal.com`.
