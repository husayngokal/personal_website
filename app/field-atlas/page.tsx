import { notFound } from 'next/navigation';
import { getLivingEntry } from '@/lib/content/living';
import { LivingEntryView } from '@/components/LivingEntryView';

/*
 * Field Atlas — the body's domain, GCC edition. 92 entries across
 * hiking, diving and fishing, ordered as a curriculum rather than a
 * bucket list. Tiered, with an artifact (log entry) attached to every
 * outing.
 *
 * Single-document surface backed by living_entries(slug='field-atlas').
 * Edit through the vault (living/field-atlas.md); ISR picks up the
 * change on the next vault push.
 */

export const revalidate = 60;

export const metadata = {
  title: 'The Field Atlas',
  description:
    'The GCC outdoors as a curriculum: 58 hikes, 23 dives, 11 fishing spots, tiered, with a log attached to every outing.',
};

export default async function FieldAtlasPage() {
  const entry = await getLivingEntry('field-atlas');
  if (!entry) notFound();
  return <LivingEntryView entry={entry} kicker="Living · The Field Atlas" />;
}
