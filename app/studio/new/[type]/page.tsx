/*
 * Create-entry page. Resolves the ContentType from the route, computes dynamic
 * defaults (@today / @year) into concrete initial values, and hands off to the
 * client form. The gated layout guarantees a valid session before this renders.
 */

import { notFound } from 'next/navigation';
import { getContentType } from '@/lib/studio/schema';
import { StudioForm } from '../../StudioForm';
import styles from '../../studio.module.css';

export const dynamic = 'force-dynamic';

function resolveDefault(def: string | boolean | undefined): string {
  if (def === '@today') return new Date().toISOString().slice(0, 10);
  if (def === '@year') return String(new Date().getFullYear());
  if (typeof def === 'boolean') return def ? 'true' : '';
  return def ?? '';
}

export default async function NewEntryPage({ params }: { params: Promise<{ type: string }> }) {
  const { type: key } = await params;
  const type = getContentType(key);
  if (!type) notFound();

  const initialValues: Record<string, string> = {};
  for (const f of type.fields) initialValues[f.name] = resolveDefault(f.default);

  return (
    <div>
      <p className={styles.crumb}>
        <a href="/studio">Studio</a> / New {type.label.toLowerCase()}
      </p>
      <h1 className={styles.h1}>New {type.label.toLowerCase()}</h1>
      <StudioForm type={type} initialValues={initialValues} />
    </div>
  );
}
