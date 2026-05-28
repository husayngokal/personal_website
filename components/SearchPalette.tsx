'use client';

/*
 * Search palette — Cmd-K (or Ctrl-K on non-Mac) opens a modal that
 * searches across all surfaces. Per Part IV, search is intentionally
 * hidden behind a keyboard shortcut to favor browsing over lookup.
 *
 * Index is built server-side (lib/content/search-index) from live DB
 * content and passed in as `items`. Client-side here we just fuzzy-
 * match + render — keeps the keystroke latency tight without needing
 * a Postgres FTS round trip. Index size for a personal site stays
 * well under what's worth shipping to the client raw.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './SearchPalette.module.css';
import type { SearchItem, SurfaceKey } from '@/lib/content/search-index';

const SURFACE_LABEL: Record<SurfaceKey, string> = {
  notebook: 'Notebook',
  library: 'Library',
  projects: 'Projects',
  'mental-models': 'Mental Models',
  courses: 'Courses',
  writeups: 'Writeups',
  study: 'Study Log',
  credentials: 'Credentials',
  life: 'Life Plan',
  ideas: 'Ideas',
  living: 'Living',
  food: 'Food',
};

const SURFACE_ORDER: SurfaceKey[] = [
  'notebook', 'library', 'projects', 'mental-models',
  'courses', 'writeups', 'credentials', 'study', 'life', 'ideas',
  'living', 'food',
];

function score(item: SearchItem, q: string): number {
  if (!q) return 0;
  const needle = q.toLowerCase();
  const t = item.title.toLowerCase();
  const s = item.subtitle?.toLowerCase() ?? '';
  let n = 0;
  if (t.includes(needle)) n += 10;
  if (t.startsWith(needle)) n += 5;
  if (s.includes(needle)) n += 3;
  if (item.body?.toLowerCase().includes(needle)) n += 1;
  return n;
}

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [isMac, setIsMac] = useState(false);
  /* The index is lazy — fetched once on first open. Empty until then.
     This keeps the layout render's Supabase round-trips down to a
     single tiny query for the location pulse. */
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Detect Mac vs everything else for the keyboard-hint label. We do
     this client-side so SSR doesn't lock the hint to one platform.
     Tries the modern UA-Data API first (Chromium) and falls back to
     the legacy `navigator.platform` (everyone else, even though it's
     formally deprecated). */
  useEffect(() => {
    const uaData = (navigator as Navigator & {
      userAgentData?: { platform?: string };
    }).userAgentData;
    const p = (uaData?.platform ?? navigator.platform ?? '').toLowerCase();
    setIsMac(p.includes('mac') || /iphone|ipad/.test(navigator.userAgent.toLowerCase()));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmd = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmd) { e.preventDefault(); setOpen((v) => !v); return; }
      if (e.key === 'Escape') setOpen(false);
    };
    /* Custom event lets non-keyboard surfaces (the SearchButton in
       TopNav, the Search entry in the menu drawer) open the palette
       without needing a shared context or prop-drilling state up to
       the layout. */
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('husayn:search:open', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('husayn:search:open', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else setQ('');
  }, [open]);

  /* Fetch the index the first time the palette is opened. Cached for
     the rest of the session — repeat opens are instant. */
  useEffect(() => {
    if (!open || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    fetch('/api/search-index')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SearchItem[]) => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  const results = useMemo(() => {
    if (!q.trim()) return [] as { surface: SurfaceKey; items: SearchItem[] }[];
    const ranked = items
      .map((it) => ({ it, s: score(it, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.it);
    const grouped: Record<SurfaceKey, SearchItem[]> = {
      notebook: [], library: [], projects: [], 'mental-models': [],
      courses: [], writeups: [], study: [], credentials: [], life: [], ideas: [],
      living: [], food: [],
    };
    for (const r of ranked) grouped[r.surface].push(r);
    return SURFACE_ORDER
      .map((surface) => ({ surface, items: grouped[surface] }))
      .filter((g) => g.items.length > 0);
  }, [q, items]);

  if (!open) return null;

  return (
    <div className={styles.scrim} onClick={() => setOpen(false)} role="presentation">
      <div
        className={styles.palette}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Search across all surfaces"
      >
        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search across all surfaces…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={styles.input}
            aria-label="Search"
          />
          <span className={styles.hint}>esc</span>
        </div>

        <div className={styles.body}>
          {!q.trim() && (
            <p className={styles.empty}>
              Search the Notebook, Library, Projects, Mental Models, Study Log, Life Plan, and Ideas.
              Press <kbd className={styles.kbd}>{isMac ? '⌘' : 'Ctrl'}</kbd>
              <kbd className={styles.kbd}>K</kbd> to reopen,
              {' '}<kbd className={styles.kbd}>esc</kbd> to close.
            </p>
          )}

          {q.trim() && results.length === 0 && (
            <p className={styles.empty}>{loading ? 'Loading the index…' : 'No matches.'}</p>
          )}

          {results.map(({ surface, items }) => (
            <section key={surface} className={styles.group}>
              <p className={styles.groupLabel}>{SURFACE_LABEL[surface]}</p>
              <ul className={styles.groupList}>
                {items.slice(0, 6).map((it) => (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={styles.result}
                      onClick={() => setOpen(false)}
                    >
                      <span className={styles.resultTitle}>{it.title}</span>
                      {it.subtitle && <span className={styles.resultSub}>{it.subtitle}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
