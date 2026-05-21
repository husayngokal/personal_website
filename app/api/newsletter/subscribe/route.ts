import { NextRequest, NextResponse } from 'next/server';
import { subscribe } from '@/lib/content/newsletter';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') ?? '';
  let payload: Record<string, string> = {};
  try {
    if (ct.includes('application/json')) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) payload[k] = String(v);
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'malformed-body' }, { status: 400 });
  }

  const email = (payload.email ?? '').trim();
  if (!email) {
    return NextResponse.json({ ok: false, error: 'missing-email' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || undefined;
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 500);

  const result = await subscribe({ email, ip, userAgent });
  if (!result.ok) {
    const status = result.error === 'rate-limited' ? 429
                : result.error === 'invalid-email' ? 400
                : 500;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 201 });
}
