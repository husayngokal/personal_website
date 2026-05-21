/*
 * University chip — small mono-text badge next to a course card.
 *
 * Per the brief's single-accent rule, no per-uni colour. All chips
 * share the cream-on-divider-border treatment that the existing Chip
 * primitive uses; differentiation is purely typographic.
 */

import Link from 'next/link';
import { getUniversity } from '@/lib/universities';
import styles from './UniversityChip.module.css';

export function UniversityChip({
  slug,
  href,
}: {
  slug: string;
  href?: string;
}) {
  const u = getUniversity(slug);
  const content = (
    <span className={styles.chip} title={u.name} aria-label={u.name}>
      {u.short}
    </span>
  );
  if (href) return <Link href={href} className={styles.chipLink}>{content}</Link>;
  return content;
}
