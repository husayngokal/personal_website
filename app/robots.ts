import type { MetadataRoute } from 'next';

/*
 * Robots — SEO consequences are honored as engineering hygiene only.
 * The site is not optimized for traffic capture (Part I). Indexing is
 * allowed everywhere; the API stub is disallowed because it has no
 * content value.
 */

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
    ],
    sitemap: 'https://husayngokal.com/sitemap.xml',
    host: 'https://husayngokal.com',
  };
}
