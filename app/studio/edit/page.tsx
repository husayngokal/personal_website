/*
 * Edit index — pick a surface to browse its existing entries. Gated by the
 * studio layout.
 */

import { CONTENT_TYPES } from '@/lib/studio/schema';
import styles from '../studio.module.css';

export const dynamic = 'force-dynamic';

export default function EditIndex() {
  const groupMap = new Map<string, typeof CONTENT_TYPES>();
  for (const t of CONTENT_TYPES) {
    const list = groupMap.get(t.group) ?? [];
    list.push(t);
    groupMap.set(t.group, list);
  }

  return (
    <div>
      <p className={styles.crumb}><a href="/studio">Studio</a> / Edit</p>
      <h1 className={styles.h1}>Edit an entry</h1>
      <p className={styles.p}>Pick a surface to browse its existing entries.</p>

      {Array.from(groupMap.entries()).map(([group, types]) => (
        <section key={group} className={styles.group}>
          <h2 className={styles.groupHead}>{group}</h2>
          <div className={styles.grid}>
            {types.map((t) => (
              <a key={t.key} href={`/studio/edit/${t.key}`} className={styles.card}>
                <span className={styles.cardLabel}>{t.label}</span>
                <span className={styles.cardFolder}>{t.folder}/</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
