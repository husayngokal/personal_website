'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * Local draft autosave for the studio forms.
 *
 * The form is a controlled React tree with no persistence, so anything typed
 * before "Create" was only ever in memory: a quit, a crash or a stray reload
 * lost it. Worse, the browser's own form restore did bring the text back on
 * reload, and then the first focus triggered a re-render that overwrote the
 * restored DOM value with the (empty) controlled value. So the browser's
 * safety net actively could not help us.
 *
 * This keeps a copy in localStorage, keyed per form, written on a short
 * debounce and flushed synchronously when the page hides (which is what a
 * cmd-Q looks like from here). Cleared once the entry actually lands in the
 * vault.
 */

export interface Draft {
  values: Record<string, unknown>;
  sections: Record<string, string>;
  body: string;
  savedAt: number;
}

const PREFIX = 'hg-studio-draft:';
const DEBOUNCE_MS = 400;

function read(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (!d || typeof d !== 'object' || typeof d.savedAt !== 'number') return null;
    return {
      values: (d.values as Record<string, unknown>) ?? {},
      sections: (d.sections as Record<string, string>) ?? {},
      body: typeof d.body === 'string' ? d.body : '',
      savedAt: d.savedAt,
    };
  } catch {
    /* Private mode, or corrupt JSON. A missing draft is not an error. */
    return null;
  }
}

function write(key: string, draft: Draft) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(draft));
  } catch {
    /* Quota or private mode. Nothing useful to do, and never block typing. */
  }
}

function drop(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* see write() */
  }
}

export function useDraft({
  key,
  snapshot,
  dirty,
  onRestore,
}: {
  key: string;
  snapshot: Omit<Draft, 'savedAt'>;
  dirty: boolean;
  onRestore: (draft: Draft) => void;
}) {
  const [restoredFrom, setRestoredFrom] = useState<number | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  /* Latest state, readable from event handlers without re-binding them. */
  const latest = useRef({ snapshot, dirty });
  latest.current = { snapshot, dirty };

  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;

  /* Restore once, on mount, before the first save runs. */
  useEffect(() => {
    const found = read(key);
    if (found) {
      restoreRef.current(found);
      setRestoredFrom(found.savedAt);
      setSavedAt(found.savedAt);
    }
    setReady(true);
  }, [key]);

  /* Debounced save. An untouched form clears its draft instead of writing. */
  useEffect(() => {
    if (!ready) return;
    if (!dirty) {
      drop(key);
      setSavedAt(null);
      return;
    }
    const t = setTimeout(() => {
      const now = Date.now();
      write(key, { ...snapshot, savedAt: now });
      setSavedAt(now);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [ready, dirty, key, snapshot]);

  /* Flush on the way out. pagehide fires on quit, tab close and navigation;
     the debounce timer would not survive any of them. */
  useEffect(() => {
    if (!ready) return;

    const flush = () => {
      if (!latest.current.dirty) return;
      write(key, { ...latest.current.snapshot, savedAt: Date.now() });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      if (!latest.current.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [ready, key]);

  const clear = useCallback(() => {
    drop(key);
    setSavedAt(null);
    setRestoredFrom(null);
  }, [key]);

  const dismissRestoreNotice = useCallback(() => setRestoredFrom(null), []);

  return { restoredFrom, savedAt, clear, dismissRestoreNotice };
}

export function relativeTime(ts: number): string {
  const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (secs < 60) return 'moments ago';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
