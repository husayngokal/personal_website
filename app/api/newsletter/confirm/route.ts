import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? '';
  if (!token || token.length !== 64) {
    return new NextResponse(page('error'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const db = getServerAdminClient();
  const { data, error } = await db
    .from('newsletter_subscribers')
    .update({
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('token', token)
    .in('status', ['pending', 'confirmed'])
    .select('email')
    .maybeSingle();

  if (error || !data) {
    return new NextResponse(page('error'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new NextResponse(page('ok', data.email), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function page(state: 'ok' | 'error', email?: string): string {
  const message = state === 'ok'
    ? `${email ?? 'Your email'} is confirmed. The next weekly email will arrive Sunday morning UTC if anything changed on the site that week.`
    : 'That confirmation link is invalid or expired.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${state === 'ok' ? 'Subscription confirmed' : 'Invalid link'} — husayn gokal.</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font: 17px/1.65 Georgia, serif; background: #EFE7D7; color: #6B6B6B; padding: 80px 32px; max-width: 560px; margin: 0 auto; }
    h1   { font-family: Georgia, serif; color: #111; font-size: 28px; margin: 0 0 24px; font-weight: 600; }
    p    { margin: 0 0 16px; }
    a    { color: #F26B1F; }
  </style>
</head>
<body>
  <h1>${state === 'ok' ? 'Confirmed.' : 'Hmm.'}</h1>
  <p>${message}</p>
  <p style="margin-top: 32px;"><a href="https://husayngokal.com">← back to husayngokal.com</a></p>
</body>
</html>`;
}
