/* Studio sign-out — clears the session cookie and returns to the homepage. */

import { NextRequest, NextResponse } from 'next/server';
import { STUDIO_SESSION_COOKIE } from '@/lib/studio/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.delete(STUDIO_SESSION_COOKIE);
  return res;
}
