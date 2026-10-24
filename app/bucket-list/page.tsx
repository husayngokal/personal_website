import { notFound } from 'next/navigation';
import { getLivingEntry } from '@/lib/content/living';
import { LivingEntryView } from '@/components/LivingEntryView';
import { SurfaceProgress } from '@/components/SurfaceProgress';
import { getScoreState } from '@/lib/content/score';

/*
 * Bucket list — "The List." Sky, sea, mountains, machines. A public
 * record of the things that, if the life ended without them, would
 * have left it unfinished. Pure adventure, on the record.
 *
 * Single-document surface backed by living_entries(slug='bucket-list').
 * Edit through the vault (living/bucket-list.md); ISR picks up the
 * change on the next vault push.
 */

export const revalidate = 60;

export const metadata = {
  title: 'The List',
  description:
    'A public record of the adventures that would leave the life unfinished if undone. Sky, sea, mountains, machines.',
};

export default async function BucketListPage() {
  const [entry, score] = await Promise.all([getLivingEntry('bucket-list'), getScoreState()]);
  if (!entry) notFound();
  const progress = score ? (
    <SurfaceProgress
      label="Done from The List"
      done={score.tallies.list.done}
      total={score.tallies.list.total}
      unit="items"
      weekPoints={score.surfaces.list.weekPoints}
    />
  ) : null;
  return <LivingEntryView entry={entry} kicker="Living · The List" progress={progress} />;
}
