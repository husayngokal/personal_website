import { NextRequest, NextResponse, after } from 'next/server';
import { createHash } from 'node:crypto';
import { getServerAdminClient } from '@/lib/supabase';
import { sendEmail, isEmailConfigured } from '@/lib/email';
import { buildSubmissionNotificationEmail } from '@/lib/email/submission-notification';
import { writeSubmissionToVault } from '@/lib/vault/submissions';

/*
 * PR-style submission endpoint (BRIEF.md Part VI / Part XIII).
 *
 * Validates input, applies a simple per-IP rate limit (10/hour), and
 * inserts into public.comments with status='pending'. After the DB
 * row lands we kick off two background jobs (via next/server after())
 * so the form response stays fast:
 *
 *   1. Push a /submissions/{id}.md file into the Obsidian vault repo
 *      via the GitHub Contents API. The author moderates by editing
 *      the file's status field and pushing; the vault webhook syncs
 *      the change back to the DB.
 *   2. Email the author a brief notification with the submission body
 *      and the vault file path.
 *
 * The DB row is the source of truth — if either background job fails
 * the submission still exists and the author can moderate manually.
 *
 * The IP itself is never stored — only its SHA-256 hash, scoped by a
 * fixed pepper that lives only on the server. Enough for rate-limiting,
 * useless for tracking.
 */

const MAX_NOTE_LENGTH       = 4000;
const MAX_NAME_LENGTH       = 80;
const MAX_EMAIL_LENGTH      = 254;
const RATE_LIMIT_PER_HOUR   = 10;

/* Fixed peppered hash — same pepper across server starts so the rate
   limit window survives function cold-starts. The pepper is not secret
   in the cryptographic sense (it's only here to prevent a leaked DB
   from being directly reversed into IPs via rainbow tables). */
const IP_PEPPER = 'husayngokal-com-comments-pepper-v1';

export async function POST(req: NextRequest) {
  /* -- Parse body (json or form-encoded) ---------------------------- */
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

  const post  = (payload.post  ?? '').trim();
  const note  = (payload.note  ?? '').trim();
  const email = (payload.email ?? '').trim();
  const name  = (payload.name  ?? '').trim();

  /* -- Validate ------------------------------------------------------ */
  if (!post)  return NextResponse.json({ ok: false, error: 'missing-post' }, { status: 400 });
  if (!note)  return NextResponse.json({ ok: false, error: 'missing-note' }, { status: 400 });
  if (!email) return NextResponse.json({ ok: false, error: 'missing-email' }, { status: 400 });
  if (note.length  > MAX_NOTE_LENGTH)  return NextResponse.json({ ok: false, error: 'note-too-long'  }, { status: 413 });
  if (name.length  > MAX_NAME_LENGTH)  return NextResponse.json({ ok: false, error: 'name-too-long'  }, { status: 413 });
  if (email.length > MAX_EMAIL_LENGTH) return NextResponse.json({ ok: false, error: 'email-too-long' }, { status: 413 });
  if (!email.includes('@') || email.length < 5) {
    return NextResponse.json({ ok: false, error: 'invalid-email' }, { status: 400 });
  }

  /* -- IP + UA capture ---------------------------------------------- */
  const ip = (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
  const ipHash = createHash('sha256').update(IP_PEPPER + ':' + ip).digest('hex');
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 500);

  /* -- Rate limit (10 per IP per rolling hour) ---------------------- */
  const db = getServerAdminClient();
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { count, error: countErr } = await db
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', oneHourAgo);
  if (countErr) {
    return NextResponse.json({ ok: false, error: 'db-count-failed', reason: countErr.message }, { status: 500 });
  }
  if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { ok: false, error: 'rate-limited', maxPerHour: RATE_LIMIT_PER_HOUR },
      { status: 429 },
    );
  }

  /* -- Insert -------------------------------------------------------- */
  const { data, error } = await db
    .from('comments')
    .insert({
      post_slug: post,
      body: note,
      email,
      name: name || null,
      status: 'pending',
      ip_hash: ipHash,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: 'db-insert-failed', reason: error.message }, { status: 500 });
  }

  /* Fire-and-forget side effects: vault file write + author email.
     Both go through next/server after() so the form response returns
     fast and a slow GitHub or Resend call can't break the user flow. */
  const submissionId = data.id as string;
  const createdAt = new Date().toISOString();
  after(async () => {
    const vault = await writeSubmissionToVault({
      id: submissionId, postSlug: post, body: note, email, name: name || null, createdAt,
    });
    if (!vault.ok) {
      console.error(`[submit] vault push failed for ${submissionId}: ${vault.error}`);
    }
  });
  after(async () => {
    if (!isEmailConfigured()) return;
    const built = buildSubmissionNotificationEmail({
      id: submissionId, postSlug: post, body: note, email, name: name || null,
    });
    const r = await sendEmail({
      to: 'husayn@husayngokal.com',
      subject: built.subject,
      html: built.html,
      text: built.text,
      replyTo: email,        // reply lands in reader's inbox if author wants
    });
    if (!r.ok) {
      console.error(`[submit] author email failed for ${submissionId}: ${r.error}`);
    }
  });

  return NextResponse.json(
    { ok: true, id: submissionId, message: 'Submission received. The author reviews the moderation queue periodically.' },
    { status: 201 },
  );
}

export function GET() {
  return NextResponse.json({ ok: true, info: 'POST a comment submission here. See BRIEF.md Part VI.' });
}
