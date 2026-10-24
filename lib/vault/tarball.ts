/*
 * The whole vault as one gzipped tarball, untarred in memory.
 *
 * One GitHub API request regardless of file count (see the header of
 * sync.ts for why the per-file fetch was retired). Shared by the sync and
 * by the score refresh that runs after a Studio tap.
 *
 * The tarball endpoint 302s to a pre-signed codeload URL; fetch follows
 * it, and undici drops the Authorization header on that cross-origin hop,
 * which is fine: the signed URL needs no auth.
 */

import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { extract as tarExtract } from 'tar-stream';

export interface VaultFile { path: string; content: string }

export function vaultRepo() {
  const owner  = process.env.VAULT_REPO_OWNER;
  const repo   = process.env.VAULT_REPO_NAME;
  const branch = process.env.VAULT_REPO_BRANCH || 'main';
  const pat    = process.env.GITHUB_PAT;
  if (!owner || !repo || !pat) {
    throw new Error('VAULT_REPO_OWNER, VAULT_REPO_NAME, GITHUB_PAT must be set');
  }
  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'husayngokal-vault-sync',
  };
  return { owner, repo, branch, headers };
}

/** Every .md file in the vault, path relative to the repo root. */
export async function fetchVaultMarkdown(): Promise<VaultFile[]> {
  const { owner, repo, branch, headers } = vaultRepo();
  const tarUrl = `https://api.github.com/repos/${owner}/${repo}/tarball/${branch}`;
  const tarRes = await fetch(tarUrl, { headers, cache: 'no-store' });
  if (!tarRes.ok) {
    throw new Error(`GitHub tarball API failed (${tarRes.status}): ${await tarRes.text()}`);
  }
  const tarballGz = Buffer.from(await tarRes.arrayBuffer());

  const files: VaultFile[] = [];
  await new Promise<void>((resolve, reject) => {
    const extract = tarExtract();
    extract.on('entry', (header, stream, next) => {
      /* Every entry sits under a top-level `<owner>-<repo>-<sha>/` folder
         GitHub adds; strip that first segment for the vault-relative path. */
      const rel = header.name.replace(/^[^/]+\//, '');
      if (header.type !== 'file' || !rel.endsWith('.md')) {
        stream.on('end', next);
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c) => { chunks.push(c as Buffer); });
      stream.on('end', () => {
        files.push({ path: rel, content: Buffer.concat(chunks).toString('utf8') });
        next();
      });
      stream.on('error', reject);
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    const gunzip = createGunzip();
    gunzip.on('error', reject);
    Readable.from(tarballGz).pipe(gunzip).pipe(extract);
  });
  return files;
}
