import { BookSpine } from './marks/BookSpine';

/*
 * Book cover — renders the actual cover image when one's known
 * (vault frontmatter `cover-url` override, or auto-discovered from
 * Open Library by ISBN during vault sync), and falls back to the
 * BookSpine placeholder when not.
 *
 * Pure server component — no onError fallback dance — because the
 * sync pipeline pre-validates every URL it stores. If you're seeing
 * the placeholder for a book that should have a cover, either add
 * `cover-url: <url>` to its frontmatter or wait for the next sync
 * (it'll re-probe books whose cover_url is still null).
 */

export function BookCover({
  url,
  width,
  height,
  alt = '',
}: {
  url?: string | null;
  width: number;
  height: number;
  alt?: string;
}) {
  if (!url) return <BookSpine width={width} height={height} />;
  return (
    <img
      src={url}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      style={{
        display: 'block',
        width,
        height,
        objectFit: 'cover',
        /* Editorial-grade plate — soft shadow, no decorative frame.
           The cover supplies its own contrast against the page. */
        boxShadow: '0 1px 2px rgba(17,17,17,0.10), 0 6px 16px rgba(17,17,17,0.12)',
        background: '#f1ece0',
      }}
    />
  );
}
