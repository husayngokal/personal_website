'use client';

import { useState } from 'react';
import type { ContentType } from '@/lib/studio/schema';
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

  const set = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));

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

      {type.body.mode === 'freeform' && (
        <label className={styles.field}>
          <span className={styles.label}>{type.body.label}</span>
          <textarea
            className={styles.textarea}
            rows={12}
            placeholder={type.body.placeholder}
            value={body}
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
              onChange={(e) => setSections((prev) => ({ ...prev, [s]: e.target.value }))}
            />
          </label>
        ))}

      <div className={styles.actions}>
        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? 'Publishing…' : mode === 'edit' ? 'Save changes' : `Create ${type.label}`}
        </button>
        <a className={styles.cancel} href="/studio">Cancel</a>
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
