'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { ContentType } from '@/lib/studio/schema';
import { clockTime, relativeTime, useDraft, type Draft } from './use-draft';
import styles from './studio.module.css';

/*
 * Generic create form, rendered from a ContentType. Every field type maps to a
 * plain input so it's mobile-native. Submits JSON to /api/studio/create and
 * reports the result (with a link to the entry, which goes live after the
 * ~30s vault sync).
 */
export function StudioForm({
  type,
  initialValues,
  mode = 'create',
  editPath,
  sha,
  initialBody = '',
  initialSections = {},
}: {
  type: ContentType;
  initialValues: Record<string, string>;
  mode?: 'create' | 'edit';
  editPath?: string;
  sha?: string;
  initialBody?: string;
  initialSections?: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);
  const [sections, setSections] = useState<Record<string, string>>(initialSections);
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; url?: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));

  /* Draft autosave. Keyed per form so a half-written essay and a half-written
     book note don't overwrite each other, and so editing two entries of the
     same type keeps two drafts. */
  const draftKey = `${mode}:${type.key}:${editPath ?? 'new'}`;
  const pristine = useRef(JSON.stringify({ values: initialValues, sections: initialSections, body: initialBody }));
  const snapshot = useMemo(() => ({ values, sections, body }), [values, sections, body]);
  const dirty = JSON.stringify(snapshot) !== pristine.current;

  const applyDraft = useCallback((d: Draft) => {
    setValues((prev) => ({ ...prev, ...d.values }));
    setSections(d.sections);
    setBody(d.body);
  }, []);

  const { restoredFrom, savedAt, clear: clearDraft, dismissRestoreNotice } = useDraft({
    key: draftKey,
    snapshot,
    dirty,
    onRestore: applyDraft,
  });

  function discardDraft() {
    setValues(initialValues);
    setSections(initialSections);
    setBody(initialBody);
    clearDraft();
  }

  /* Image upload: track which text area is focused so an uploaded image's
     markdown lands where the cursor was. */
  const [activeTarget, setActiveTarget] = useState<{ kind: 'body' } | { kind: 'section'; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const appendMd = (existing: string, md: string) => (existing.trim() ? `${existing}\n\n${md}` : md);

  function insertImage(url: string) {
    const md = `![](${url})`;
    if (activeTarget?.kind === 'section') {
      const name = activeTarget.name;
      setSections((prev) => ({ ...prev, [name]: appendMd(prev[name] ?? '', md) }));
    } else if (type.body.mode === 'freeform') {
      setBody((b) => appendMd(b, md));
    } else if (type.body.mode === 'sections') {
      const first = type.body.sections[0];
      setSections((prev) => ({ ...prev, [first]: appendMd(prev[first] ?? '', md) }));
    } else if (type.body.mode === 'split') {
      const first = type.body.parts[0];
      setSections((prev) => ({ ...prev, [first]: appendMd(prev[first] ?? '', md) }));
    }
  }

  async function handleFiles(files: FileList) {
    setUploading(true);
    setUploadMsg(null);
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/studio/upload', { method: 'POST', body: fd });
        const j = await res.json();
        if (res.ok) { insertImage(j.url); setUploadMsg(`Inserted ${file.name}`); }
        else { setUploadMsg(j.detail || j.error || 'Upload failed'); }
      } catch (err) {
        setUploadMsg((err as Error).message);
      }
    }
    setUploading(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const payloadValues: Record<string, unknown> = { ...values };
    if (type.body.mode === 'freeform') payloadValues.body = body;
    if (type.body.mode === 'sections' || type.body.mode === 'split') payloadValues.sections = sections;

    const endpoint = mode === 'edit' ? '/api/studio/update' : '/api/studio/create';
    const requestBody =
      mode === 'edit'
        ? { type: type.key, path: editPath, sha, values: payloadValues }
        : { type: type.key, values: payloadValues };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const j = await res.json();
      if (res.ok) {
        /* Safely in the vault now, so the local copy has done its job. Mark
           the current state pristine first, or the save effect immediately
           writes a fresh draft from the still-populated fields. */
        pristine.current = JSON.stringify(snapshot);
        clearDraft();
        setResult({
          ok: true,
          msg: `${mode === 'edit' ? 'Saved' : 'Created'} ${j.path}. Live in ~30s.`,
          url: j.url,
        });
      } else if (j.error === 'exists') {
        setResult({ ok: false, msg: `A file already exists at ${j.path}. Change the title.` });
      } else if (j.error === 'conflict') {
        setResult({ ok: false, msg: 'This entry changed elsewhere since you opened it. Reload and redo your edit.' });
      } else if (j.error === 'validation') {
        setResult({ ok: false, msg: (j.errors as string[]).join('. ') });
      } else {
        setResult({ ok: false, msg: j.detail || j.error || 'Something went wrong.' });
      }
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!editPath || !sha) return;
    setDeleting(true);
    setResult(null);
    try {
      const res = await fetch('/api/studio/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: editPath, sha }),
      });
      const j = await res.json();
      if (res.ok) {
        pristine.current = JSON.stringify(snapshot);
        clearDraft();
        setResult({ ok: true, msg: `Deleted ${j.path}. Removed in ~30s.` });
      }
      else if (j.error === 'conflict') setResult({ ok: false, msg: 'This entry changed elsewhere since you opened it. Reload before deleting.' });
      else setResult({ ok: false, msg: j.detail || j.error || 'Delete failed.' });
    } catch (err) {
      setResult({ ok: false, msg: (err as Error).message });
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {type.fields.map((f) => (
        <label key={f.name} className={styles.field}>
          <span className={styles.label}>
            {f.label}
            {f.required && <span className={styles.req}> *</span>}
          </span>
          {f.type === 'select' ? (
            <select
              className={styles.input}
              value={String(values[f.name] ?? '')}
              onChange={(e) => set(f.name, e.target.value)}
              required={f.required}
            >
              {f.options?.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : f.type === 'boolean' ? (
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={Boolean(values[f.name])}
              onChange={(e) => set(f.name, e.target.checked)}
            />
          ) : (
            <input
              className={styles.input}
              type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
              value={String(values[f.name] ?? '')}
              placeholder={f.placeholder}
              required={f.required}
              onChange={(e) => set(f.name, e.target.value)}
            />
          )}
          {f.help && <span className={styles.help}>{f.help}</span>}
        </label>
      ))}

      {type.body.mode !== 'none' && (
        <label className={styles.field}>
          <span className={styles.label}>Images</span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
          />
          <span className={styles.help}>
            {uploading ? 'Uploading…' : uploadMsg ?? 'Uploads to the CDN and inserts markdown into the focused text area.'}
          </span>
        </label>
      )}

      {type.body.mode === 'freeform' && (
        <label className={styles.field}>
          <span className={styles.label}>{type.body.label}</span>
          <textarea
            className={styles.textarea}
            rows={12}
            placeholder={type.body.placeholder}
            value={body}
            onFocus={() => setActiveTarget({ kind: 'body' })}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
      )}

      {(type.body.mode === 'sections' || type.body.mode === 'split') &&
        (type.body.mode === 'sections' ? type.body.sections : type.body.parts).map((s) => (
          <label key={s} className={styles.field}>
            <span className={styles.label}>{s}</span>
            <textarea
              className={styles.textarea}
              rows={6}
              value={sections[s] ?? ''}
              onFocus={() => setActiveTarget({ kind: 'section', name: s })}
              onChange={(e) => setSections((prev) => ({ ...prev, [s]: e.target.value }))}
            />
          </label>
        ))}

      {restoredFrom !== null ? (
        <p className={styles.draftNote}>
          Restored an unsaved draft from {relativeTime(restoredFrom)}, saved on this device.{' '}
          <button type="button" className={styles.cancel} onClick={dismissRestoreNotice}>keep it</button>
          {' · '}
          <button type="button" className={styles.cancel} onClick={discardDraft}>discard it</button>
        </p>
      ) : savedAt !== null ? (
        <p className={styles.draftNote}>Draft saved on this device, {clockTime(savedAt)}. Nothing is published until you press {mode === 'edit' ? 'save changes' : 'create'}.</p>
      ) : null}

      <div className={styles.actions}>
        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? 'Publishing…' : mode === 'edit' ? 'Save changes' : `Create ${type.label}`}
        </button>
        <a className={styles.cancel} href="/studio">Cancel</a>
        {mode === 'edit' && (
          <span className={styles.deleteZone}>
            {confirmingDelete ? (
              <>
                <button type="button" className={styles.deleteBtn} onClick={doDelete} disabled={deleting}>
                  {deleting ? 'Deleting…' : 'Confirm delete'}
                </button>
                <button type="button" className={styles.cancel} onClick={() => setConfirmingDelete(false)}>keep</button>
              </>
            ) : (
              <button type="button" className={styles.deleteBtn} onClick={() => setConfirmingDelete(true)}>Delete</button>
            )}
          </span>
        )}
      </div>

      {result && (
        <p className={result.ok ? styles.ok : styles.error}>
          {result.msg}{' '}
          {result.ok && result.url && (
            <a href={result.url} target="_blank" rel="noreferrer">view</a>
          )}
        </p>
      )}
    </form>
  );
}
