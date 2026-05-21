import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getServerAdminClient } from '@/lib/supabase';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { buildDigestEmail, type DigestPayload, type DigestSection } from '@/lib/email/digest';

/*
 * Weekly digest endpoint — called by GitHub Actions on Sunday mornings UTC.
 *
 * Computes what changed in the last 7 days across every content table
 * (using the last_edited_at column populated by vault sync), builds a
 * DigestPayload, and sends one personalised email per confirmed
 * subscriber (each with their own unsubscribe token).
 *
 * Idempotent: a subscriber whose last_email_at is within the past 6
 * days is skipped, so manual re-runs don't double-send.
 *
 * Auth: requires `Authorization: Bearer ${DIGEST_AUTH_TOKEN}` header.
 * Caller is the GitHub Action; secret is shared via .env + GH secret.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SIX_DAYS_MS   = 6 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest)  { return handle(req); }

async function handle(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: false, error: 'email-not-configured' }, { status: 503 });
  }

  const dryRun = req.nextUrl.searchParams.get('dry') === '1';
  const db = getServerAdminClient();
  const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  /* -- Gather changed content from each surface --------------------- */
  const sections: DigestSection[] = [];
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://husayngokal.com';

  const { data: posts } = await db
    .from('notebook_posts')
    .select('slug, title, dek, kind, last_edited_at')
    .gte('last_edited_at', since)
    .eq('draft', false)
    .order('last_edited_at', { ascending: false });
  if (posts?.length) {
    sections.push({
      heading: 'Notebook',
      items: posts.map((p) => ({
        title: p.title,
        detail: p.dek ?? p.kind,
        href: `${site}/notebook/${p.slug}`,
      })),
    });
  }

  const { data: books } = await db
    .from('library_books')
    .select('slug, title, author, status, last_edited_at')
    .gte('last_edited_at', since)
    .in('status', ['finished', 'reading', 're-reading', 'abandoned']);
  if (books?.length) {
    sections.push({
      heading: 'Library',
      items: books.map((b) => ({
        title: `${statusVerb(b.status)} — ${b.title}`,
        detail: b.author,
        href: `${site}/library/${b.slug}`,
      })),
    });
  }

  const { data: projects } = await db
    .from('projects')
    .select('slug, title, tagline, status, last_edited_at')
    .gte('last_edited_at', since)
    .neq('status', 'dormant');
  if (projects?.length) {
    sections.push({
      heading: 'Projects',
      items: projects.map((p) => ({
        title: p.title,
        detail: p.tagline,
        href: `${site}/projects/${p.slug}`,
      })),
    });
  }

  const { data: models } = await db
    .from('mental_models')
    .select('slug, title, one_line, last_edited_at')
    .gte('last_edited_at', since);
  if (models?.length) {
    sections.push({
      heading: 'Mental Models',
      items: models.map((m) => ({
        title: m.title,
        detail: m.one_line,
        href: `${site}/mental-models/${m.slug}`,
      })),
    });
  }

  const { data: courses } = await db
    .from('courses')
    .select('slug, code, title, status, last_edited_at')
    .gte('last_edited_at', since)
    .neq('status', 'planned');
  if (courses?.length) {
    sections.push({
      heading: 'Courses',
      items: courses.map((c) => ({
        title: `${courseStatusVerb(c.status)} — ${c.code ? c.code + ' · ' : ''}${c.title}`,
        href: `${site}/courses/${c.slug}`,
      })),
    });
  }

  const { data: writeups } = await db
    .from('writeups')
    .select('slug, title, kind, category, platform, difficulty, status, last_edited_at')
    .gte('last_edited_at', since)
    .order('last_edited_at', { ascending: false });
  if (writeups?.length) {
    sections.push({
      heading: 'Writeups',
      items: writeups.map((w) => ({
        title: w.title,
        detail: w.kind === 'machine'
          ? [w.platform, w.difficulty, w.status].filter(Boolean).join(' · ')
          : (w.category ?? 'technique'),
        href: `${site}/writeups/${w.slug}`,
      })),
    });
  }

  const { data: credentials } = await db
    .from('credentials')
    .select('slug, title, institution, type, year, last_edited_at')
    .gte('last_edited_at', since)
    .eq('is_public', true)
    .order('last_edited_at', { ascending: false });
  if (credentials?.length) {
    sections.push({
      heading: 'Credentials',
      items: credentials.map((c) => ({
        title: `${credentialTypeVerb(c.type)} — ${c.title}`,
        detail: [c.institution, c.year ? String(c.year) : null].filter(Boolean).join(' · '),
        href: `${site}/credentials/${c.slug}`,
      })),
    });
  }

  const { data: principles } = await db
    .from('life_principles')
    .select('slug, title, last_edited_at')
    .gte('last_edited_at', since);
  const { data: changed } = await db
    .from('life_changed_mind')
    .select('slug, title, last_edited_at')
    .gte('last_edited_at', since);
  const lifeItems: typeof sections[0]['items'] = [];
  for (const p of principles ?? []) {
    lifeItems.push({
      title: `Revised principle — ${p.title}`,
      href: `${site}/life#principle-${p.slug}`,
    });
  }
  for (const c of changed ?? []) {
    lifeItems.push({
      title: `Changed my mind — ${c.title}`,
      href: `${site}/life/changed-my-mind#${c.slug}`,
    });
  }
  if (lifeItems.length) {
    sections.push({ heading: 'Life Plan', items: lifeItems });
  }

  if (sections.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no-content-this-week' });
  }

  /* -- Build payload + send to each eligible subscriber ------------- */
  const payload: DigestPayload = {
    weekOf: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }),
    sections,
  };

  const sixDaysAgo = new Date(Date.now() - SIX_DAYS_MS).toISOString();
  const { data: subscribers } = await db
    .from('newsletter_subscribers')
    .select('id, email, token, last_email_at')
    .eq('status', 'confirmed')
    .or(`last_email_at.is.null,last_email_at.lt.${sixDaysAgo}`);

  if (!subscribers?.length) {
    return NextResponse.json({ ok: true, skipped: 'no-eligible-subscribers', sections: sections.length });
  }

  const results: { email: string; ok: boolean; error?: string }[] = [];
  for (const sub of subscribers) {
    const email = buildDigestEmail({ payload, unsubscribeToken: sub.token });
    if (dryRun) {
      results.push({ email: sub.email, ok: true });
      continue;
    }
    const r = await sendEmail({
      to: sub.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      unsubscribeToken: sub.token,
    });
    if (r.ok) {
      await db
        .from('newsletter_subscribers')
        .update({ last_email_at: new Date().toISOString() })
        .eq('id', sub.id);
    }
    results.push({ email: sub.email, ok: r.ok, error: r.error });
  }

  return NextResponse.json({
    ok: true,
    weekOf: payload.weekOf,
    sections: sections.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results: dryRun ? results : undefined,
  });
}

function checkAuth(req: NextRequest): boolean {
  const expected = process.env.DIGEST_AUTH_TOKEN;
  if (!expected) return false;
  const header = req.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const provided = header.slice(7);
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

function statusVerb(s: string): string {
  switch (s) {
    case 'finished':   return 'Finished';
    case 'reading':    return 'Reading';
    case 're-reading': return 'Re-reading';
    case 'abandoned':  return 'Abandoned';
    default:           return s;
  }
}
function courseStatusVerb(s: string): string {
  switch (s) {
    case 'studying':  return 'Started';
    case 'completed': return 'Completed';
    case 'abandoned': return 'Abandoned';
    default:          return s;
  }
}
function credentialTypeVerb(t: string): string {
  switch (t) {
    case 'transcript':  return 'Added transcript';
    case 'diploma':     return 'Added diploma';
    case 'certificate': return 'Added certificate';
    case 'letter':      return 'Added letter';
    default:            return 'Added';
  }
}
