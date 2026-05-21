/*
 * Vault /submissions mirror — pushes a single moderation file into
 * the Obsidian vault repo when a reader submits a comment.
 *
 * The DB row is the source of truth; this file is the moderation
 * convenience surface (BRIEF Part XIII). Author opens the file in
 * Obsidian, changes `status: pending` → `accepted` | `rejected`,
 * commits + pushes. The vault webhook + sync.ts then reflect the
 * change back to the comments table.
 *
 * If GITHUB_PAT lacks write access to the vault repo, the GitHub
 * call fails gracefully — the comment still lands in the DB with
 * status=pending; the author can moderate via the Supabase
 * dashboard. A submission is never lost due to this path failing.
 */

import 'server-only';

export interface SubmissionFileInput {
  id: string;
  postSlug: string;
  body: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export async function writeSubmissionToVault(
  input: SubmissionFileInput,
): Promise<{ ok: boolean; error?: string }> {
  const owner = process.env.VAULT_REPO_OWNER;
  const repo  = process.env.VAULT_REPO_NAME;
  const branch = process.env.VAULT_REPO_BRANCH || 'main';
  const pat   = process.env.GITHUB_PAT;
  if (!owner || !repo || !pat) {
    return { ok: false, error: 'vault env not configured' };
  }

  const path = `submissions/${input.id}.md`;
  const url  = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const fileContent = renderSubmissionFile(input);
  const message =
    `comment submission ${input.id.slice(0, 8)} on ${input.postSlug}`;

  const body = JSON.stringify({
    message,
    content: Buffer.from(fileContent, 'utf8').toString('base64'),
    branch,
    committer: { name: 'husayngokal.com', email: 'no-reply@husayngokal.com' },
  });

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'husayngokal-comment-sink',
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `GitHub ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function renderSubmissionFile(input: SubmissionFileInput): string {
  const fm = [
    '---',
    `id: ${input.id}`,
    `status: pending`,
    `post: ${input.postSlug}`,
    `email: ${escapeYaml(input.email)}`,
    `name: ${input.name ? escapeYaml(input.name) : '~'}`,
    `created-at: ${input.createdAt}`,
    '---',
    '',
  ].join('\n');
  return fm + input.body.trimEnd() + '\n';
}

function escapeYaml(s: string): string {
  /* Quote anything containing characters that would break YAML inline
     scalar parsing. Conservative — easier to over-quote than not. */
  if (/[":#@\n]/.test(s) || s !== s.trim()) {
    return JSON.stringify(s);
  }
  return s;
}
