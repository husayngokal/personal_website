import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeByToken } from '@/lib/content/newsletter';

export const dynamic = 'force-dynamic';

/* GET so the unsubscribe link in emails works without a form submission. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? '';
  const result = await unsubscribeByToken(token);
  if (!result.ok) {
    return new NextResponse(unsubscribePage('error'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  return new NextResponse(unsubscribePage('ok', result.email), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function unsubscribePage(state: 'ok' | 'error', email?: string): string {
  const message = state === 'ok'
    ? `${email ?? 'Your email'} has been unsubscribed. You won't receive any further weekly updates.`
    : 'That unsubscribe link is invalid or expired.';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Unsubscribe — husayn gokal.</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font: 17px/1.65 Georgia, serif; background: #EFE7D7; color: #6B6B6B; padding: 80px 32px; max-width: 560px; margin: 0 auto; }
    h1   { font-family: Georgia, serif; color: #111; font-size: 28px; margin: 0 0 24px; font-weight: 600; }
    p    { margin: 0 0 16px; }
    a    { color: #F26B1F; }
  </style>
</head>
<body>
  <h1>${state === 'ok' ? 'Unsubscribed.' : 'Hmm.'}</h1>
  <p>${message}</p>
  <p style="margin-top: 32px;"><a href="https://husayngokal.com">← back to husayngokal.com</a></p>
</body>
</html>`;
}
