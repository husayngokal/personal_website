/*
 * Vault exporter — converts the in-memory lib/data/* modules into the
 * full Obsidian vault structure (markdown + YAML frontmatter per
 * BRIEF.md Appendix D), writes to disk, and pushes to the GitHub repo.
 *
 *   npm run vault:export                  — write to /tmp/<repo>-export/
 *   npm run vault:export -- --push        — also commit + push to GitHub
 *
 * Once this has run, the GitHub repo IS the source of truth. Subsequent
 * edits should happen in Obsidian (not in lib/data/*) and propagate
 * through the vault webhook / vault-sync script.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

import { NOTEBOOK_POSTS, NOTEBOOK_THREADS } from '../lib/data/notebook';
import { BOOKS } from '../lib/data/library';
import { PROJECTS } from '../lib/data/projects';
import { MENTAL_MODELS } from '../lib/data/mental-models';
import {
  STUDY_CREDENTIALS, STUDY_DOMAINS, PUBLICATIONS, CONFERENCES,
} from '../lib/data/study';
import {
  MOTTO, STORY_VIGNETTES, LIFE_PRINCIPLES,
  JOURNEY, LIFE_GOALS, CHANGED_MY_MIND,
} from '../lib/data/life';

const OWNER  = process.env.VAULT_REPO_OWNER;
const REPO   = process.env.VAULT_REPO_NAME;
const BRANCH = process.env.VAULT_REPO_BRANCH || 'main';
const PAT    = process.env.GITHUB_PAT;

if (!OWNER || !REPO) {
  console.error('VAULT_REPO_OWNER and VAULT_REPO_NAME must be set in .env');
  process.exit(1);
}

const OUT_DIR = `/tmp/${REPO}-export`;
const PUSH = process.argv.includes('--push');

/* -- YAML serializer (small, focused — avoids the js-yaml dependency)  */
function yaml(obj: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    lines.push(yamlLine(k, v));
  }
  lines.push('---', '');
  return lines.join('\n');
}

function yamlLine(key: string, value: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}${key}: []`;
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return `${pad}${key}: [${value.map(yamlScalar).join(', ')}]`;
    }
    /* Array of objects */
    const out = [`${pad}${key}:`];
    for (const v of value) {
      const first = true;
      const entries = Object.entries(v as object);
      entries.forEach(([k2, v2], i) => {
        const prefix = i === 0 ? `${pad}  - ` : `${pad}    `;
        out.push(`${prefix}${k2}: ${yamlScalar(v2)}`);
      });
    }
    return out.join('\n');
  }
  if (typeof value === 'object') {
    const out = [`${pad}${key}:`];
    for (const [k2, v2] of Object.entries(value as object)) {
      out.push(yamlLine(k2, v2, indent + 2));
    }
    return out.join('\n');
  }
  if (typeof value === 'string' && (value.includes('\n') || value.length > 80)) {
    /* Multi-line block scalar */
    const escaped = value.split('\n').map((l) => `  ${l}`).join('\n');
    return `${pad}${key}: |\n${escaped}`;
  }
  return `${pad}${key}: ${yamlScalar(value)}`;
}

function yamlScalar(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (/^[A-Za-z0-9_./@:-]+$/.test(s) && !/^(true|false|null|yes|no)$/i.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/* -- Write a single .md file ---------------------------------------- */
async function write(relPath: string, frontmatter: Record<string, unknown>, body = '') {
  const full = join(OUT_DIR, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, yaml(frontmatter) + body, 'utf8');
}

/* -- Generate everything -------------------------------------------- */
async function build() {
  console.log(`Exporting vault to ${OUT_DIR}\n`);
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  /* Notebook */
  for (const t of NOTEBOOK_THREADS) {
    await write(`notebook/threads/${t.slug}.md`, {
      type: 'thread', name: t.name, state: t.state,
    }, t.summary);
  }
  for (const p of NOTEBOOK_POSTS) {
    await write(`notebook/${p.slug}.md`, {
      type: p.kind, title: p.title, dek: p.dek,
      date: p.date, thread: p.thread, tags: p.tags,
      'epistemic-status': p.epistemicStatus,
      'word-count': p.wordCount, draft: p.draft ?? false,
    }, p.body);
  }
  console.log(`  notebook: ${NOTEBOOK_POSTS.length} posts + ${NOTEBOOK_THREADS.length} threads`);

  /* Library */
  for (const b of BOOKS) {
    const sections: string[] = [];
    if (b.notes)  sections.push(`## Notes\n\n${b.notes}`);
    if (b.review) sections.push(`## Review\n\n${b.review}`);
    if (b.passages?.length) {
      sections.push(`## Passages\n\n` + b.passages.map((p) =>
        `> ${p.text}${p.page ? `\n>\n> *p.${p.page}*` : ''}`
      ).join('\n\n'));
    }
    await write(`library/${b.slug}.md`, {
      title: b.title, author: b.author, isbn: b.isbn,
      status: b.status, year: b.year,
      started: b.started, finished: b.finished, rating: b.rating,
      genre: b.genre, language: b.language, source: b.source,
      'progress-pct': b.progressPct,
    }, sections.join('\n\n'));
  }
  console.log(`  library: ${BOOKS.length} books`);

  /* Projects */
  for (const p of PROJECTS) {
    const sections: string[] = [];
    if (p.currentState) sections.push(`## Current state\n\n${p.currentState}`);
    if (p.stuckOn?.length) {
      sections.push(`## Currently stuck on\n\n` + p.stuckOn.map((s) => `- ${s}`).join('\n'));
    }
    if (p.decisions?.length) {
      sections.push(`## Decisions\n\n` + p.decisions.map((d) =>
        `### ${d.date} — ${d.title}\n\n${d.body}`
      ).join('\n\n'));
    }
    await write(`projects/${p.slug}.md`, {
      title: p.title, tagline: p.tagline, status: p.status,
      started: p.started, ended: p.ended, tags: p.tags,
      repo: p.repo, 'repo-private': p.repoPrivate ?? false,
      'external-url': p.externalUrl, 'last-active': p.lastActive,
      tasks: p.tasks, activity: p.activity,
    }, sections.join('\n\n'));
  }
  console.log(`  projects: ${PROJECTS.length}`);

  /* Mental Models */
  for (const m of MENTAL_MODELS) {
    const sections: string[] = [];
    sections.push(`## The model\n\n${m.body ?? ''}`);
    if (m.framing) sections.push(`## Husayn's framing\n\n${m.framing}`);
    if (m.whenToReach?.length) {
      sections.push(`## When to reach for it\n\n` + m.whenToReach.map((s) => `- ${s}`).join('\n'));
    }
    if (m.whenNotTo?.length) {
      sections.push(`## When not to\n\n` + m.whenNotTo.map((s) => `- ${s}`).join('\n'));
    }
    if (m.sources?.length) {
      sections.push(`## Sources\n\n` + m.sources.map((s) =>
        s.href ? `- [${s.label}](${s.href})` : `- ${s.label}`
      ).join('\n'));
    }
    await write(`mental-models/${m.slug}.md`, {
      title: m.title, origin: m.origin, type: m.type,
      related: m.related, tags: m.tags,
      'last-reviewed': m.lastReviewed, depth: m.depth,
      'one-line': m.oneLine,
      'in-the-wild': m.inTheWild,
      'changed-my-mind': m.changedMyMind,
    }, sections.join('\n\n'));
  }
  console.log(`  mental-models: ${MENTAL_MODELS.length}`);

  /* Study */
  for (const c of STUDY_CREDENTIALS) {
    await write(`study/credentials/${c.slug}.md`, {
      title: c.title, 'full-title': c.fullTitle, institution: c.institution,
      earned: c.earned, pending: c.pending ?? false, expires: c.expires,
      depth: c.depth, 'last-assessed': c.lastAssessed, tags: c.tags,
      sources: c.sources,
    }, `## What stuck\n\n${c.whatStuck}\n\n## What didn't\n\n${c.whatDidnt}`);
  }
  for (const d of STUDY_DOMAINS) {
    await write(`study/domains/${d.slug}.md`, {
      title: d.title, depth: d.depth,
    }, d.body);
  }
  await write('study/publications.md',
    { type: 'collection', title: 'Publications' },
    PUBLICATIONS.map((p) =>
      `### ${p.title}\n\n*${p.venue}, ${p.year}* — ${p.authors}${p.href ? ` · [link](${p.href})` : ''}`
    ).join('\n\n'),
  );
  await write('study/conferences.md',
    { type: 'collection', title: 'Conferences' },
    CONFERENCES.map((c) =>
      `### ${c.name}, ${c.year}\n\n*${c.role}*${c.talk ? ` — ${c.talk}` : ''}`
    ).join('\n\n'),
  );
  console.log(`  study: ${STUDY_CREDENTIALS.length} credentials + ${STUDY_DOMAINS.length} domains + pubs + confs`);

  /* Life */
  await write('life/motto.md',
    { type: 'motto', language: MOTTO.language, active: true },
    MOTTO.text,
  );
  STORY_VIGNETTES.forEach(async (v, i) => {
    await write(`life/story/${String(i).padStart(2, '0')}-${v.slug}.md`,
      { type: 'vignette', title: v.title, ordinal: i }, v.body);
  });
  for (const p of LIFE_PRINCIPLES) {
    await write(`life/principles/${p.slug}.md`, {
      title: p.title, order: p.order, established: p.established, revised: p.revised, tags: p.tags,
    }, `${p.manifesto}\n\n---\n\n${p.body ?? ''}`);
  }
  JOURNEY.forEach(async (j, i) => {
    const safeSlug = j.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-|-$/g, '');
    await write(`life/journey/${String(i).padStart(2, '0')}-${safeSlug}.md`,
      { type: 'journey', date: j.date, title: j.title, ordinal: i },
      j.reflection ?? '');
  });
  for (const g of LIFE_GOALS) {
    await write(`life/goals/${g.slug}.md`, {
      scale: g.scale, year: g.year, title: g.title, status: g.status,
    }, g.note ?? '');
  }
  for (const c of CHANGED_MY_MIND) {
    await write(`life/changed-my-mind/${c.slug}.md`, {
      title: c.title, 'date-changed': c.dateChanged, tags: c.tags,
    }, `## Previously\n\n${c.previous}\n\n## Now\n\n${c.next}`);
  }
  console.log(`  life: motto + ${STORY_VIGNETTES.length} vignettes + ${LIFE_PRINCIPLES.length} principles + ${JOURNEY.length} journey + ${LIFE_GOALS.length} goals + ${CHANGED_MY_MIND.length} changed-my-mind`);

  /* Top-level README */
  await writeFile(join(OUT_DIR, 'README.md'),
`# husayngokal.com — vault

The Obsidian vault for husayngokal.com. Every \`.md\` file here corresponds to a page on the live site. Edits propagate to the site via the vault webhook (production) or \`npm run vault:sync\` (local dev).

Folder structure mirrors the URL routes: one folder per surface.

Every file has YAML frontmatter at the top. The webhook ingestion rejects files with invalid frontmatter and surfaces the rejection back as a warning in a \`vault-warnings/\` folder so you'll see it in Obsidian's file tree.

DO NOT edit \`lib/data/*.ts\` in the website repo any more — once this vault is the source of truth, the website's seed data is just an initial backup. All changes happen here.
`, 'utf8');

  /* .gitignore so Obsidian's local junk doesn't get committed */
  await writeFile(join(OUT_DIR, '.gitignore'),
`.obsidian/workspace*.json
.obsidian/workspaces.json
.obsidian/graph.json
.DS_Store
*.swp
.trash/
`, 'utf8');
}

/* -- Git push (only if --push flag) ---------------------------------- */
function run(cmd: string, args: string[], cwd: string): void {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (exit ${r.status})`);
  }
}

async function push() {
  if (!PAT) {
    console.error('\nGITHUB_PAT must be set to push.');
    process.exit(1);
  }
  console.log(`\nPushing to https://github.com/${OWNER}/${REPO}.git ...\n`);

  run('git', ['init', '-b', BRANCH], OUT_DIR);
  run('git', ['add', '.'], OUT_DIR);
  run('git', ['-c', 'user.email=husayn@husayngokal.com',
              '-c', 'user.name=Husayn Gokal',
              'commit', '-m', 'Initial vault: seed from lib/data'], OUT_DIR);

  const remote = `https://${PAT}@github.com/${OWNER}/${REPO}.git`;
  run('git', ['remote', 'add', 'origin', remote], OUT_DIR);
  run('git', ['push', '-u', 'origin', BRANCH, '--force'], OUT_DIR);

  console.log(`\nPushed. Repo: https://github.com/${OWNER}/${REPO}`);
}

/* -- Main ---------------------------------------------------------- */
build().then(() => {
  console.log(`\nDone. Files written to ${OUT_DIR}.`);
  if (PUSH) return push();
  console.log('Re-run with --push to commit + push to GitHub.');
}).catch((err) => {
  console.error('\nExport failed:', err);
  process.exit(1);
});
