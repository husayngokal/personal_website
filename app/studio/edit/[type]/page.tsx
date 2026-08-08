/*
 * Browse + edit for one content type.
 *   /studio/edit/<type>            -> list the folder's existing files
 *   /studio/edit/<type>?file=x.md  -> load that file into the edit form
 *
 * The file is fetched from GitHub with its blob sha; the sha rides in the form
 * and is sent back on save as the conflict guard. Gated by the studio layout,
 * so a session (with the OAuth token) is always present.
 */

import { notFound } from 'next/navigation';
import { getContentType } from '@/lib/studio/schema';
import { getStudioSession } from '@/lib/studio/session';
import { getFile, listFolder } from '@/lib/studio/github';
import { parseExisting } from '@/lib/studio/markdown';
import { StudioForm } from '../../StudioForm';
import styles from '../../studio.module.css';

export const dynamic = 'force-dynamic';

export default async function EditTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ file?: string }>;
}) {
  const { type: key } = await params;
  const { file } = await searchParams;
  const type = getContentType(key);
  if (!type) notFound();

  const session = await getStudioSession();
  if (!session) notFound(); // layout already guards, this narrows the type

  /* No file selected -> list the folder. */
  if (!file) {
    let entries: { name: string; path: string }[] = [];
    let listError = '';
    try {
      entries = await listFolder(session.token, type.folder);
      entries.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      listError = (err as Error).message;
    }
    return (
      <div>
        <p className={styles.crumb}>
          <a href="/studio">Studio</a> / <a href="/studio/edit">Edit</a> / {type.label}
        </p>
        <h1 className={styles.h1}>Edit {type.label.toLowerCase()}</h1>
        <p className={styles.p}>
          <a className={styles.inlineLink} href={`/studio/new/${type.key}`}>+ New {type.label.toLowerCase()}</a>
        </p>
        {listError && <p className={styles.error}>{listError}</p>}
        {!listError && entries.length === 0 && <p className={styles.pMuted}>No entries yet in {type.folder}/.</p>}
        <ul className={styles.list}>
          {entries.map((e) => (
            <li key={e.path}>
              <a className={styles.listItem} href={`/studio/edit/${type.key}?file=${encodeURIComponent(e.name)}`}>
                {e.name.replace(/\.md$/, '')}
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  /* File selected -> load it into the edit form. */
  const path = `${type.folder}/${file}`;
  let loaded: { sha: string; content: string } | null = null;
  let loadError = '';
  try {
    loaded = await getFile(session.token, path);
  } catch (err) {
    loadError = (err as Error).message;
  }
  if (loadError || !loaded) {
    return (
      <div>
        <p className={styles.crumb}>
          <a href="/studio">Studio</a> / <a href={`/studio/edit/${type.key}`}>{type.label}</a>
        </p>
        <p className={styles.error}>{loadError || 'File not found.'}</p>
      </div>
    );
  }

  const parsed = parseExisting(type, loaded.content);

  /* Numeric-prefixed types (life plan parts, story vignettes) keep their order
     number in the filename, not the frontmatter — recover it so the field
     isn't blank on edit. */
  if (type.numberPrefix && !parsed.values[type.numberPrefix.field]) {
    const m = file.match(/^(\d+)-/);
    if (m) parsed.values[type.numberPrefix.field] = String(Number(m[1]));
  }

  return (
    <div>
      <p className={styles.crumb}>
        <a href="/studio">Studio</a> / <a href={`/studio/edit/${type.key}`}>{type.label}</a> / {file}
      </p>
      <h1 className={styles.h1}>Edit: {file.replace(/\.md$/, '')}</h1>
      <StudioForm
        type={type}
        initialValues={parsed.values}
        mode="edit"
        editPath={path}
        sha={loaded.sha}
        initialBody={parsed.body}
        initialSections={parsed.sections}
      />
    </div>
  );
}
