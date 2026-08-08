/*
 * Studio landing. Reached only with a valid session (the layout gates it).
 * Lists the surfaces you can create right now. More types get added to the
 * schema registry as the fan-out proceeds.
 */

import { CONTENT_TYPES } from '@/lib/studio/schema';
import styles from './studio.module.css';

export const dynamic = 'force-dynamic';

const ERROR_COPY: Record<string, string> = {
  'state-mismatch': 'Sign-in expired or was tampered with. Try again.',
  'token-exchange-failed': 'GitHub would not exchange the code. Try again.',
  'no-token': 'GitHub returned no access token. Try again.',
  'user-fetch-failed': 'Could not read your GitHub identity. Try again.',
  forbidden: 'That GitHub account is not allowed here.',
};

export default async function StudioHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  /* Group the types by their `group` field, preserving first-seen order. */
  const groupMap = new Map<string, typeof CONTENT_TYPES>();
  for (const t of CONTENT_TYPES) {
    const list = groupMap.get(t.group) ?? [];
    list.push(t);
    groupMap.set(t.group, list);
  }
  const groups = Array.from(groupMap.entries());

  return (
    <div>
      {error && <p className={styles.error}>{ERROR_COPY[error] ?? `Sign-in error: ${error}`}</p>}
      <h1 className={styles.h1}>Studio</h1>
      <p className={styles.p}>
        Create a new entry, or <a className={styles.inlineLink} href="/studio/edit">edit an existing one</a>.
        It commits to the vault and goes live in about 30 seconds.
      </p>

      {groups.map(([group, types]) => (
        <section key={group} className={styles.group}>
          <h2 className={styles.groupHead}>{group}</h2>
          <div className={styles.grid}>
            {types.map((t) => (
              <a key={t.key} href={`/studio/new/${t.key}`} className={styles.card}>
                <span className={styles.cardLabel}>{t.label}</span>
                <span className={styles.cardFolder}>{t.folder}/</span>
              </a>
            ))}
          </div>
        </section>
      ))}

      <p className={styles.pMuted}>Editing existing entries is being added next.</p>
    </div>
  );
}
