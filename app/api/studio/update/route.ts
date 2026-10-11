/*
 * Studio update — POST { type, path, sha, values }. Auth-gated. Rebuilds the
 * file's markdown from the submitted values and commits it back to the SAME
 * path (edit never renames, to avoid orphaning), guarded by the blob sha: if
 * the file changed since it was loaded (e.g. a desktop Obsidian edit), GitHub
 * 409s and we surface a conflict instead of clobbering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStudioSession } from '@/lib/studio/session';
import { getContentType } from '@/lib/studio/schema';
import { buildMarkdown, validate, type Values } from '@/lib/studio/markdown';
import { putFile } from '@/lib/studio/github';
import { revalidatePath } from 'next/cache';
import { parseFile } from '@/lib/vault/parse';
import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let payload: {
    type?: string;
    path?: string;
    sha?: string;
    values?: Values;
    base?: Record<string, unknown>;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'malformed-body' }, { status: 400 });
  }

  const type = payload.type ? getContentType(payload.type) : undefined;
  if (!type) return NextResponse.json({ error: 'unknown-type' }, { status: 400 });
  if (!payload.path || !payload.sha) {
    return NextResponse.json({ error: 'missing-path-or-sha' }, { status: 400 });
  }

  const values = payload.values ?? {};
  const errors = validate(type, values);
  if (errors.length) return NextResponse.json({ error: 'validation', errors }, { status: 400 });

  /* Content is rebuilt from values over the file's original frontmatter, so
     keys the schema doesn't expose are preserved; the path stays what was
     loaded. */
  const built = buildMarkdown(type, values, payload.base);

  try {
    await putFile(session.token, {
      path: payload.path,
      content: built.content,
      message: `studio: edit ${payload.path}`,
      sha: payload.sha,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('putFile 409') || msg.includes('putFile 422')) {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
    return NextResponse.json({ error: 'commit-failed', detail: msg }, { status: 502 });
  }

  /* A file that maps to a current_state row (the job line, now/working.md)
     is a single small fact the homepage reads directly. Write it through
     now so the change shows at once instead of after the ~30s webhook
     sync, which then writes the same value again. Best effort: the commit
     above is the source of truth and has already succeeded. */
  try {
    const parsed = parseFile(payload.path, built.content);
    if (parsed && !parsed.ignored && parsed.table === 'current_state' && isSupabaseConfigured()) {
      const row = parsed.row as { key: string; value: object };
      await getServerAdminClient()
        .from('current_state')
        .upsert({ key: row.key, value: row.value ?? {}, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      revalidatePath('/');
    }
  } catch (err) {
    console.error(`[studio/update] write-through skipped for ${payload.path}: ${(err as Error).message}`);
  }

  return NextResponse.json({ ok: true, path: payload.path, url: built.url });
}
