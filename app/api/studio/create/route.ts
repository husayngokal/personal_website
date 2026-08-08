/*
 * Studio create — POST { type, values }. Auth-gated (session re-checked here;
 * a layout can't protect a route handler). Validates against the schema, builds
 * the markdown, refuses to overwrite an existing slug, and commits to the vault
 * repo as the signed-in author. The vault webhook syncs it live (~30s).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStudioSession } from '@/lib/studio/session';
import { getContentType } from '@/lib/studio/schema';
import { buildMarkdown, validate, type Values } from '@/lib/studio/markdown';
import { getFile, putFile } from '@/lib/studio/github';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let payload: { type?: string; values?: Values };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'malformed-body' }, { status: 400 });
  }

  const type = payload.type ? getContentType(payload.type) : undefined;
  if (!type) return NextResponse.json({ error: 'unknown-type' }, { status: 400 });

  const values = payload.values ?? {};
  const errors = validate(type, values);
  if (errors.length) return NextResponse.json({ error: 'validation', errors }, { status: 400 });

  const built = buildMarkdown(type, values);
  if (!built.slug) return NextResponse.json({ error: 'empty-title' }, { status: 400 });

  try {
    const existing = await getFile(session.token, built.path);
    if (existing) {
      return NextResponse.json({ error: 'exists', path: built.path }, { status: 409 });
    }
    await putFile(session.token, {
      path: built.path,
      content: built.content,
      message: `studio: add ${built.path}`,
    });
  } catch (err) {
    return NextResponse.json({ error: 'commit-failed', detail: (err as Error).message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, path: built.path, url: built.url, slug: built.slug });
}
