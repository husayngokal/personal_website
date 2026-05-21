/*
 * Submission notification email — fired to the author whenever a
 * reader submits a comment on a Notebook post. Plain editorial
 * typography matching the confirmation/digest emails, so author's
 * inbox stays visually consistent.
 *
 * The author moderates by opening the matching /submissions/{id}.md
 * file in Obsidian, changing the `status` frontmatter from `pending`
 * to `accepted` or `rejected`, and committing. The next vault sync
 * picks up the change and propagates it to the post page.
 */

import 'server-only';

export interface SubmissionEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildSubmissionNotificationEmail(opts: {
  id: string;
  postSlug: string;
  body: string;
  email: string;
  name: string | null;
  siteUrl?: string;
}): SubmissionEmail {
  const site = opts.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://husayngokal.com';
  const postUrl = `${site}/notebook/${opts.postSlug}`;
  const author = opts.name?.trim() || 'Anonymous';
  const preview = opts.body.length > 600 ? opts.body.slice(0, 600).trim() + '…' : opts.body;

  const subject = `Comment submission — ${opts.postSlug}`;

  const text = `husayn gokal.

A new note was submitted on ${opts.postSlug}.

From:  ${author} <${opts.email}>
Post:  ${postUrl}
Vault: submissions/${opts.id}.md  (edit "status: pending" → "accepted" | "rejected")

----- BODY -----

${opts.body}

----- /BODY -----

To moderate: open the vault file, change the status field, commit + push. The
post page updates within ~30 seconds.
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
          <tr>
            <td style="font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.65;color:#444444;">

              <p style="margin:0 0 8px 0;font-weight:600;font-size:20px;color:#111111;letter-spacing:-0.01em;">
                husayn gokal<span style="color:#F26B1F;">.</span>
              </p>
              <p style="margin:0 0 28px 0;color:#888888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">
                Comment submission · awaiting moderation
              </p>

              <p style="margin:0 0 6px 0;color:#888888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.04em;">
                From
              </p>
              <p style="margin:0 0 18px 0;">
                ${escape(author)} &lt;<a href="mailto:${escape(opts.email)}" style="color:#F26B1F;text-decoration:underline;">${escape(opts.email)}</a>&gt;
              </p>

              <p style="margin:0 0 6px 0;color:#888888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.04em;">
                On post
              </p>
              <p style="margin:0 0 18px 0;">
                <a href="${escape(postUrl)}" style="color:#111111;text-decoration:none;border-bottom:1px solid #F26B1F;">${escape(opts.postSlug)}</a>
              </p>

              <p style="margin:0 0 6px 0;color:#888888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.04em;">
                Vault file
              </p>
              <p style="margin:0 0 28px 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#111111;">
                submissions/${escape(opts.id)}.md
              </p>

              <p style="margin:0 0 6px 0;color:#888888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.04em;">
                Body
              </p>
              <div style="margin:0 0 32px 0;padding:16px 20px;border-left:3px solid #F26B1F;background:#fafafa;font-style:italic;color:#333333;white-space:pre-wrap;">
${escape(preview)}
              </div>

              <p style="margin:0;color:#6B6B6B;font-style:italic;font-size:15px;">
                Open the vault file in Obsidian, change <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f3f3f3;padding:1px 5px;border-radius:2px;">status: pending</code> to <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f3f3f3;padding:1px 5px;border-radius:2px;">accepted</code> or <code style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;background:#f3f3f3;padding:1px 5px;border-radius:2px;">rejected</code>, commit + push. The post page updates within ~30 seconds.
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
