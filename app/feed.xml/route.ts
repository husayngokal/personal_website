import { getNotebookPosts } from '@/lib/content/notebook';

/*
 * RSS feed — the Notebook only. RSS is the only subscription mechanism
 * the site offers; email subscriptions are deferred per Part XVI.
 *
 * Reads the live getter, not lib/data. It used to import the static
 * fallback module directly, which meant the public feed served six
 * placeholder posts that were never on the site. Drafts are filtered by
 * getNotebookPosts, so an unpublished essay never reaches a reader.
 */

export const revalidate = 600;

const BASE = 'https://husayngokal.com';

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET() {
  const posts = await getNotebookPosts();

  const items = [...posts]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30)
    .map((p) => `
      <item>
        <title>${escape(p.title)}</title>
        <link>${BASE}/notebook/${p.slug}</link>
        <guid>${BASE}/notebook/${p.slug}</guid>
        <pubDate>${new Date(p.date).toUTCString()}</pubDate>
        ${p.dek ? `<description>${escape(p.dek)}</description>` : ''}
      </item>
    `).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>husayn gokal · Notebook</title>
    <link>${BASE}/notebook</link>
    <description>Long-form essays from husayngokal.com</description>
    <language>en</language>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
}
