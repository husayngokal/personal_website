/*
 * Subscription confirmation email — sent immediately on subscribe.
 *
 * Plain editorial typography. White background (cream looks broken
 * in dark-mode inbox UIs). Single short paragraph + one prominent
 * confirm link + a one-line reassurance. No images, no buttons styled
 * like UI elements — just typography and a hyperlink. Plain-text
 * version is the source of truth; HTML is the same content with
 * inline styles.
 */

import 'server-only';

export interface ConfirmationEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildConfirmationEmail(opts: {
  email: string;
  token: string;
  siteUrl?: string;
}): ConfirmationEmail {
  const site = opts.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://husayngokal.com';
  const confirmUrl = `${site}/api/newsletter/confirm?t=${opts.token}`;

  const subject = 'Confirm your subscription — husayn gokal.';

  const text = `husayn gokal.

You signed up for the weekly email at ${site.replace(/^https?:\/\//, '')}.

Click here to confirm:
${confirmUrl}

If this wasn't you, ignore this email. Nothing happens until you click the link.

—
${process.env.EMAIL_FROM ?? 'notify@husayngokal.com'}
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

              <p style="margin:0 0 36px 0;font-weight:600;font-size:20px;color:#111111;letter-spacing:-0.01em;">
                husayn gokal<span style="color:#F26B1F;">.</span>
              </p>

              <p style="margin:0 0 20px 0;">
                You signed up for the weekly email at
                <a href="${escape(site)}" style="color:#F26B1F;text-decoration:underline;">${escape(site.replace(/^https?:\/\//, ''))}</a>.
              </p>

              <p style="margin:0 0 32px 0;font-size:18px;">
                <a href="${escape(confirmUrl)}" style="color:#F26B1F;text-decoration:underline;">Click here to confirm →</a>
              </p>

              <p style="margin:0 0 20px 0;color:#888888;font-style:italic;font-size:15px;">
                If this wasn&rsquo;t you, ignore this email. Nothing happens until you click the link.
              </p>

              <hr style="border:0;border-top:1px solid #eaeaea;margin:32px 0;" />

              <p style="margin:0;color:#888888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.04em;">
                ${escape(process.env.EMAIL_FROM ?? 'notify@husayngokal.com')}
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
