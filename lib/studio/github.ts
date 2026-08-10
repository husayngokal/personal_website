/*
 * GitHub Contents API helpers for Studio writes. Commits go to the vault repo
 * using the signed-in author's OAuth token (repo scope), so the commit is
 * attributed to them and no shared machine token is involved. The vault
 * webhook then syncs the change to Postgres as usual.
 */

import 'server-only';

const API = 'https://api.github.com';

function repo() {
  const owner = process.env.VAULT_REPO_OWNER;
  const name = process.env.VAULT_REPO_NAME;
  const branch = process.env.VAULT_REPO_BRANCH || 'main';
  if (!owner || !name) throw new Error('VAULT_REPO_OWNER / VAULT_REPO_NAME not set');
  return { owner, name, branch };
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'husayngokal-studio',
  };
}

/* Encode each path segment but keep the slashes the Contents API expects. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export interface RepoFile {
  sha: string;
  content: string;
}

/** List the .md files directly inside a folder (non-recursive), newest name
 *  order left to the caller. README is skipped. Empty array if the folder
 *  doesn't exist yet. */
export async function listFolder(token: string, folder: string): Promise<{ name: string; path: string }[]> {
  const { owner, name, branch } = repo();
  const res = await fetch(
    `${API}/repos/${owner}/${name}/contents/${encodePath(folder)}?ref=${branch}`,
    { headers: headers(token), cache: 'no-store' },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`listFolder ${res.status}: ${await res.text()}`);
  const entries = (await res.json()) as Array<{ name: string; path: string; type: string }>;
  return entries
    .filter((e) => e.type === 'file' && e.name.endsWith('.md') && e.name !== 'README.md')
    .map((e) => ({ name: e.name, path: e.path }));
}

/** Fetch a file's content + blob sha, or null if it doesn't exist. */
export async function getFile(token: string, path: string): Promise<RepoFile | null> {
  const { owner, name, branch } = repo();
  const res = await fetch(
    `${API}/repos/${owner}/${name}/contents/${encodePath(path)}?ref=${branch}`,
    { headers: headers(token), cache: 'no-store' },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getFile ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { sha: string; content: string; encoding: string };
  const content = j.encoding === 'base64' ? Buffer.from(j.content, 'base64').toString('utf8') : j.content;
  return { sha: j.sha, content };
}

/** Delete a file by path + blob sha. Throws with the GitHub message on failure
 *  (e.g. 409 sha mismatch if it changed since load). */
export async function deleteFile(
  token: string,
  opts: { path: string; sha: string; message: string },
): Promise<void> {
  const { owner, name, branch } = repo();
  const res = await fetch(`${API}/repos/${owner}/${name}/contents/${encodePath(opts.path)}`, {
    method: 'DELETE',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: opts.message, sha: opts.sha, branch }),
  });
  if (!res.ok) throw new Error(`deleteFile ${res.status}: ${await res.text()}`);
}

/** Create or update a file. Pass sha to update (conflict-guarded); omit to
 *  create. Throws with the GitHub message on failure (e.g. 409 sha mismatch,
 *  422 already exists). */
export async function putFile(
  token: string,
  opts: { path: string; content: string; message: string; sha?: string },
): Promise<{ commitSha: string }> {
  const { owner, name, branch } = repo();
  const res = await fetch(`${API}/repos/${owner}/${name}/contents/${encodePath(opts.path)}`, {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: opts.message,
      content: Buffer.from(opts.content, 'utf8').toString('base64'),
      branch,
      ...(opts.sha ? { sha: opts.sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`putFile ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { commit?: { sha?: string } };
  return { commitSha: j.commit?.sha ?? '' };
}
