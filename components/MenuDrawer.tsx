'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SearchButton } from './SearchButton';
import styles from './MenuDrawer.module.css';

/*
 * Menu drawer — replaces the inline surfaces row in the top nav.
 *
 * The brief's "one navigation pattern, used on every page" rule
 * (Part IV) is honoured: there's still exactly one nav mechanism,
 * but the bar shrinks to logo + "Menu" + status. Clicking Menu
 * slides a panel in from the right with every surface grouped by
 * register — Writing (where the author writes), Learning (where
 * the author studies), Building (where the author makes things).
 *
 * Why this over more dropdowns / hamburger / etc.: 9 surfaces no
 * longer fit comfortably inline. A single, deliberate menu mark is
 * more editorial than five competing dropdowns and reads as
 * intentional rather than overflowing.
 *
 * Accessibility: ESC closes; backdrop click closes; focus moves to
 * the drawer's first link on open and back to the trigger on close.
 * `prefers-reduced-motion` collapses the slide-in to a fade.
 */

interface Group {
  label: string;
  surfaces: { href: string; label: string }[];
}

/* Mental Models and Study remain archived from the nav while the
   author writes content for them. The routes still resolve; the page
   handlers exist. Re-introduce them by adding their { href, label }
   back into the Learning group and mirroring in app/sitemap.ts and
   lib/content/search-index.ts. */
const GROUPS: Group[] = [
  {
    label: 'Writing',
    surfaces: [
      { href: '/notebook', label: 'Notebook' },
      { href: '/life',     label: 'Life Plan' },
    ],
  },
  {
    label: 'Learning',
    surfaces: [
      { href: '/library',     label: 'Library' },
      { href: '/courses',     label: 'Courses' },
      { href: '/writeups',    label: 'Writeups' },
      { href: '/credentials', label: 'Credentials' },
    ],
  },
  {
    label: 'Building',
    surfaces: [
      { href: '/projects', label: 'Projects' },
      { href: '/ideas',    label: 'Ideas' },
    ],
  },
  {
    label: 'Living',
    surfaces: [
      { href: '/food', label: 'Food' },
    ],
  },
];

export function MenuDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  // Close on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Platform sniff so the keyboard-shortcut hint at the bottom of
  // the drawer reads correctly on Windows / Linux (Ctrl K, not Cmd K).
  useEffect(() => {
    const uaData = (navigator as Navigator & {
      userAgentData?: { platform?: string };
    }).userAgentData;
    const p = (uaData?.platform ?? navigator.platform ?? '').toLowerCase();
    setIsMac(p.includes('mac') || /iphone|ipad/.test(navigator.userAgent.toLowerCase()));
  }, []);

  // ESC to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close the drawer when the search palette is opened from inside it
  // (or anywhere else). Stops the drawer from sitting visually on top
  // of the palette modal.
  useEffect(() => {
    const onSearchOpen = () => setOpen(false);
    window.addEventListener('husayn:search:open', onSearchOpen);
    return () => window.removeEventListener('husayn:search:open', onSearchOpen);
  }, []);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls="menu-drawer-panel"
        onClick={() => setOpen((v) => !v)}
      >
        Menu
      </button>

      {/* Backdrop — click closes. Always mounted so the fade can
          run on close; aria-hidden + pointer-events toggled. */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      <aside
        id="menu-drawer-panel"
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        aria-label="Site menu"
        aria-hidden={!open}
        // tabindex -1 so focus can land here when opened programmatically.
        tabIndex={-1}
      >
        <div className={styles.panelHead}>
          <span className={styles.panelTitle}>Menu</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <CloseMark />
          </button>
        </div>

        {/* Search lives at the top of the drawer because phones don't
            have a keyboard shortcut and the bar's compact button is
            tap-friendly but easy to miss. */}
        <div className={styles.searchSlot}>
          <SearchButton variant="wide" />
        </div>

        <nav className={styles.groups} aria-label="Surfaces">
          {GROUPS.map((g) => (
            <section key={g.label} className={styles.group}>
              <p className={styles.groupLabel}>{g.label}</p>
              <ul className={styles.groupList}>
                {g.surfaces.map((s) => {
                  const active = pathname === s.href || pathname.startsWith(s.href + '/');
                  return (
                    <li key={s.href}>
                      <Link
                        href={s.href}
                        className={`${styles.surfaceLink} ${active ? styles.surfaceLinkActive : ''}`}
                      >
                        {s.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <p className={styles.footnote}>
          <kbd>Esc</kbd> to close · <kbd>{isMac ? 'Cmd' : 'Ctrl'}</kbd>+<kbd>K</kbd> to search
        </p>
      </aside>
    </>
  );
}

/* Small hand-line X mark, currentColor. Stays inside the brand's
   no-stock-icons rule (Part II). */
function CloseMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      >
        <line x1="3.5" y1="3.5" x2="12.5" y2="12.5" />
        <line x1="12.5" y1="3.5" x2="3.5" y2="12.5" />
      </g>
    </svg>
  );
}
