import Link from 'next/link';
import { Eyebrow } from '@/components/Primitives';

export const metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <Eyebrow number="404">Not found</Eyebrow>
      <h1 style={{ fontSize: 'var(--type-display-m)', margin: '0 0 var(--space-l)' }}>
        That page does not exist.
      </h1>
      <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-body)', maxWidth: '60ch' }}>
        Either the link is stale or the slug never resolved. If you arrived here
        from a wikilink in someone else's post, the target may have been renamed —
        old slugs become 301 redirects when content is renamed, but only after the
        rename is committed.
      </p>
      <ul style={{ marginTop: 'var(--space-l)' }}>
        <li><Link href="/">homepage</Link></li>
        <li><Link href="/notebook">notebook</Link></li>
        <li><Link href="/library">library</Link></li>
        <li><Link href="/projects">projects</Link></li>
        <li><Link href="/mental-models">mental models</Link></li>
        <li><Link href="/study">study log</Link></li>
        <li><Link href="/life">life plan</Link></li>
      </ul>
    </div>
  );
}
