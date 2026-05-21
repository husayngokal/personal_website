/*
 * Library dedup — delete `<slug>-N.md` files (N >= 2) when there's a
 * matching `<slug>.md` with the SAME title in the frontmatter. These
 * are artefacts of the second remarkable-import run, which suffixed
 * everything to avoid overwriting hand-edits, but in practice nothing
 * had been hand-edited and the suffixes are pure duplicates.
 *
 * Preserves -N files whose title genuinely differs from the base
 * slug's title — those are real separate books that happen to slugify
 * the same way (e.g. two different editions).
 *
 *   npm run library:dedup --dry-run    # report only
 *   npm run library:dedup              # actually delete
 *
 * Also drops the matching R2 cover for any file deleted, so we don't
 * leave orphaned objects sitting in the bucket.
 */

import { readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import matter from 'gray-matter';

const exec = promisify(execFile);
const LIBRARY = '/Users/husayngokal/Documents/obsidian_vault/library';
const R2_REMOTE = 'r2:husayngokal-media';

interface FrontMatter {
  title?: string;
  source?: string;
}

async function readTitle(slug: string): Promise<string | null> {
  try {
    const raw = await readFile(join(LIBRARY, `${slug}.md`), 'utf8');
    const data = matter(raw).data as FrontMatter;
    return data.title?.toString().trim() ?? null;
  } catch { return null; }
}

async function deleteR2Cover(slug: string): Promise<void> {
  try {
    await exec('rclone', ['deletefile', `${R2_REMOTE}/library/covers/${slug}.jpg`, '--s3-no-check-bucket']);
  } catch { /* file might not exist — fine */ }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const files = (await readdir(LIBRARY)).filter((f) => f.endsWith('.md'));

  /* Group by base slug. A suffixed file like foo-2.md gets matched
     against foo.md. Anything without a numeric suffix is a base. */
  const suffixRe = /^(.+)-(\d+)\.md$/;
  const candidates: { suffixed: string; base: string; suffix: number }[] = [];
  for (const f of files) {
    const m = f.match(suffixRe);
    if (!m) continue;
    const base = m[1];
    const suffix = Number(m[2]);
    if (suffix < 2) continue;
    if (!files.includes(`${base}.md`)) continue;
    candidates.push({ suffixed: f.replace(/\.md$/, ''), base, suffix });
  }

  console.log(`Scanning ${files.length} library files; ${candidates.length} have a -N suffix sibling.`);

  let deleted = 0;
  let kept = 0;
  for (const c of candidates) {
    const baseTitle = await readTitle(c.base);
    const suffixedTitle = await readTitle(c.suffixed);
    if (!baseTitle || !suffixedTitle) continue;
    if (baseTitle === suffixedTitle) {
      /* True duplicate. Delete the suffixed file + its R2 cover. */
      console.log(`  ${dryRun ? '[dry-run]' : 'delete'} library/${c.suffixed}.md  (same title as ${c.base}.md: "${baseTitle.slice(0, 60)}")`);
      if (!dryRun) {
        await unlink(join(LIBRARY, `${c.suffixed}.md`));
        await deleteR2Cover(c.suffixed);
      }
      deleted++;
    } else {
      console.log(`  keep   library/${c.suffixed}.md  (different title: "${suffixedTitle.slice(0, 40)}" vs "${baseTitle.slice(0, 40)}")`);
      kept++;
    }
  }

  console.log(`\n${dryRun ? 'Would delete' : 'Deleted'} ${deleted} duplicate file${deleted === 1 ? '' : 's'}.`);
  console.log(`Kept ${kept} suffixed file${kept === 1 ? '' : 's'} where titles genuinely differ.`);
  if (dryRun) console.log('\nRe-run without --dry-run to actually delete.');
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
