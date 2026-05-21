import Link from 'next/link';
import { Eyebrow, DecisionLogEntry } from '@/components/Primitives';
import { getChangedMyMind } from '@/lib/content/life';

export const metadata = {
  title: 'Changed-my-mind log',
  description:
    'A running log of positions formally revised, with dates, previous and new positions, and tags.',
};

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

export default async function ChangedMyMindArchive() {
  const CHANGED_MY_MIND = await getChangedMyMind();
  return (
    <div className="page page--life">
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--type-mono-m)' }}>
        <Link href="/life" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Life Plan</Link>
      </p>
      <Eyebrow number="11.1">Changed my mind</Eyebrow>
      <h1 className="lifeMotto" style={{ fontStyle: 'normal', fontSize: 'var(--type-display-l)' }}>
        Positions I have formally revised.
      </h1>

      {CHANGED_MY_MIND.map((c) => (
        <div id={c.slug} key={c.slug}>
          <DecisionLogEntry date={c.dateChanged} title={c.title}>
            <p><em>Previously:</em> {c.previous}</p>
            <p><em>Now:</em> {c.next}</p>
          </DecisionLogEntry>
        </div>
      ))}
    </div>
  );
}
