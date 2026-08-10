/*
 * Studio delete — POST { path, sha }. Auth-gated. Removes the file from the
 * vault repo (as the signed-in author); the webhook then drops its row on the
 * next clean sync. sha guards against deleting a file that changed since load.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStudioSession } from '@/lib/studio/session';
import { deleteFile } from '@/lib/studio/github';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let payload: { path?: string; sha?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'malformed-body' }, { status: 400 });
  }
  if (!payload.path || !payload.sha) {
    return NextResponse.json({ error: 'missing-path-or-sha' }, { status: 400 });
  }

  try {
    await deleteFile(session.token, {
      path: payload.path,
      sha: payload.sha,
      message: `studio: delete ${payload.path}`,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('deleteFile 409') || msg.includes('deleteFile 422')) {
      return NextResponse.json({ error: 'conflict' }, { status: 409 });
    }
    return NextResponse.json({ error: 'delete-failed', detail: msg }, { status: 502 });
  }

  return NextResponse.json({ ok: true, path: payload.path });
}
