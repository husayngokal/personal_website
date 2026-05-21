/*
 * Weekly digest email — sent Sunday mornings UTC if anything changed.
 *
 * Sections are emitted only when they have entries; if everything is
 * empty the caller skips the send entirely. Sections in the same order
 * as the site's navigation. Each entry is one or two lines + a deep
 * link.
 *
 * Plain-text version is the source of truth; HTML is the same content
 * with inline-styled paragraph blocks.
 */

import 'server-only';

export interface DigestSection {
  heading: string;
  items: DigestItem[];
}
export interface DigestItem {
  title: string;
  detail?: string;       // sub-line (dek, author, etc.)
  href: string;
}

export interface DigestPayload {
  weekOf: string;        // human-readable date, e.g. "May 18, 2026"
  sections: DigestSection[];
}

export interface DigestEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildDigestEmail(opts: {
  payload: DigestPayload;
  unsubscribeToken: string;
  siteUrl?: string;
}): DigestEmail {
  const site = opts.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://husayngokal.com';
  const unsubUrl = `${site}/api/newsletter/unsubscribe?t=${opts.unsubscribeToken}`;

  const subject = `husayn gokal. — week of ${opts.payload.weekOf}`;

  /* ----- Plain text ------------------------------------------------ */
  const textSections = opts.payload.sections.map((s) => {
    const items = s.items.map((it) => {
      const detail = it.detail ? `\n  ${it.detail}` : '';
      return `• ${it.title}${detail}\n  → ${it.href}`;
    }).join('\n\n');
    return `${s.heading.toUpperCase()}\n\n${items}`;
  }).join('\n\n────────\n\n');

  const text = `husayn gokal.

The weekly email — week of ${opts.payload.weekOf}

Sunday morning. Here's what changed on the site this week.

${textSections}

—
Unsubscribe in one click: ${unsubUrl}
${site.replace(/^https?:\/\//, '')}
`;

  /* ----- HTML ------------------------------------------------------ */
  const htmlSections = opts.payload.sections.map((s) => {
    const items = s.items.map((it) => `
      <p style="margin:0 0 14px 0;">
        <a href="${escape(it.href)}" style="color:#111111;text-decoration:none;border-bottom:1px solid #F26B1F;">${escape(it.title)}</a>
        ${it.detail ? `<br/><span style="color:#888888;font-style:italic;font-size:15px;">${escape(it.detail)}</span>` : ''}
      </p>
    `).join('');
    return `
      <p style="margin:32px 0 14px 0;color:#F26B1F;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">
        ${escape(s.heading)}
      </p>
      ${items}
    `;
  }).join('\n<hr style="border:0;border-top:1px solid #eaeaea;margin:24px 0;" />\n');

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
              <p style="margin:0 0 32px 0;color:#888888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">
                The weekly email · week of ${escape(opts.payload.weekOf)}
              </p>

              <p style="margin:0 0 0 0;font-style:italic;color:#6B6B6B;">
                Sunday morning. Here&rsquo;s what changed on the site this week.
              </p>

              ${htmlSections}

              <hr style="border:0;border-top:1px solid #eaeaea;margin:48px 0 24px 0;" />

              <p style="margin:0;color:#888888;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.04em;">
                <a href="${escape(unsubUrl)}" style="color:#888888;text-decoration:underline;">Unsubscribe in one click</a>
                · ${escape(site.replace(/^https?:\/\//, ''))}
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
