'use client';

import { useEffect, useState } from 'react';
import styles from './SearchButton.module.css';

/*
 * SearchButton — the visible affordance for the search palette.
 *
 * Why this exists: relying on Cmd-K alone hides search from anyone
 * on Windows / Linux (where the shortcut is Ctrl-K, not Cmd-K) and
 * from touch users entirely. A visible button + a platform-adaptive
 * keyboard hint solves both. Pressing the button dispatches a custom
 * window event that the SearchPalette client component already
 * listens for — no shared context, no prop-drilling.
 *
 * On desktop the button shows a small magnifier mark, the word
 * "Search", and the keyboard hint chip (⌘K / Ctrl K).
 * On phones the keyboard chip hides; just the mark + label remain.
 */

export function SearchButton({ variant = 'compact' }: { variant?: 'compact' | 'wide' }) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const uaData = (navigator as Navigator & {
      userAgentData?: { platform?: string };
    }).userAgentData;
    const p = (uaData?.platform ?? navigator.platform ?? '').toLowerCase();
    setIsMac(p.includes('mac') || /iphone|ipad/.test(navigator.userAgent.toLowerCase()));
  }, []);

  const open = () => window.dispatchEvent(new CustomEvent('husayn:search:open'));

  return (
    <button
      type="button"
      className={variant === 'wide' ? styles.triggerWide : styles.trigger}
      onClick={open}
      aria-label="Open search"
    >
      <SearchMark />
      <span className={styles.label}>Search</span>
      <span className={styles.hint} aria-hidden="true">
        <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>
        <kbd>K</kbd>
      </span>
    </button>
  );
}

/* Hand-line magnifying glass mark — currentColor strokes so the
   button colour flows through. Stays inside the no-stock-icons rule
   (BRIEF Part II). */
function SearchMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="6.8" cy="6.8" r="4.5" />
        <line x1="10.4" y1="10.4" x2="13.5" y2="13.5" />
      </g>
    </svg>
  );
}
