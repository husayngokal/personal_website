/*
 * Studio image upload — POST multipart (field "file"). Auth-gated. Streams the
 * image to R2 and returns its public CDN URL for the author to drop into a
 * post body as markdown. Images go to R2, not the vault repo, so they don't
 * bloat the git history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getStudioSession } from '@/lib/studio/session';
import { uploadToR2, r2Configured } from '@/lib/studio/r2';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/heic': 'heic',
};

export async function POST(req: NextRequest) {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!r2Configured()) return NextResponse.json({ error: 'r2-not-configured' }, { status: 500 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: 'malformed-body' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ error: 'no-file' }, { status: 400 });
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'not-an-image' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too-large', maxMb: 15 }, { status: 413 });

  const ext = EXT[file.type] ?? file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const date = new Date().toISOString().slice(0, 10);
  const key = `uploads/${date}/${randomUUID()}.${ext}`;

  try {
    const url = await uploadToR2(key, await file.arrayBuffer(), file.type);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return NextResponse.json({ error: 'upload-failed', detail: (err as Error).message }, { status: 502 });
  }
}
