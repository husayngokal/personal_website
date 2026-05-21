'use client';

import { useCallback, useEffect, useState } from 'react';
import { foodThumb, foodFull, type FoodItem } from '@/lib/content/food';
import styles from './FoodGallery.module.css';

/*
 * Food gallery — a labelled masonry of dish photos. Thumbnails flow in
 * CSS columns (no JS layout); clicking one opens a lightbox that loads
 * the full-size image. Keyboard: Esc closes, arrow keys move between
 * photos.
 *
 * Client component because of the lightbox state + keyboard handling.
 * The image list itself is static (passed from the server page), so the
 * grid markup is cheap and the thumbnails lazy-load as the reader
 * scrolls.
 */

export function FoodGallery({ items }: { items: FoodItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const move = useCallback(
    (dir: 1 | -1) =>
      setOpen((i) => {
        if (i === null) return i;
        return (i + dir + items.length) % items.length;
      }),
    [items.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    /* Lock background scroll while the lightbox is up. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close, move]);

  const active = open === null ? null : items[open];

  return (
    <>
      <div className={styles.masonry}>
        {items.map((it, i) => (
          /* id lets a /food#food-NNN link (from Cmd-K search) scroll to
             the exact photo. scroll-margin keeps it clear of the nav. */
          <figure key={it.id} id={it.id} className={styles.item}>
            <button
              type="button"
              className={styles.tile}
              onClick={() => setOpen(i)}
              aria-label={`View ${it.label}`}
              /* Reserve the exact box before the image loads so the
                 masonry lays out once instead of reshuffling as photos
                 decode. The ratio matches the image, so nothing crops. */
              style={{ aspectRatio: `${it.w} / ${it.h}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={foodThumb(it.id)}
                alt={it.label}
                width={it.w}
                height={it.h}
                loading="lazy"
                decoding="async"
                className={styles.img}
              />
            </button>
            <figcaption className={styles.label}>{it.label}</figcaption>
          </figure>
        ))}
      </div>

      {active && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={active.label}
          onClick={close}
        >
          <button type="button" className={styles.close} onClick={close} aria-label="Close">
            <CloseMark />
          </button>
          <button
            type="button"
            className={`${styles.nav} ${styles.prev}`}
            onClick={(e) => { e.stopPropagation(); move(-1); }}
            aria-label="Previous"
          >
            <ArrowMark dir="left" />
          </button>
          <figure className={styles.stage} onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foodFull(active.id)} alt={active.label} className={styles.full} />
            <figcaption className={styles.fullLabel}>{active.label}</figcaption>
          </figure>
          <button
            type="button"
            className={`${styles.nav} ${styles.next}`}
            onClick={(e) => { e.stopPropagation(); move(1); }}
            aria-label="Next"
          >
            <ArrowMark dir="right" />
          </button>
        </div>
      )}
    </>
  );
}

/* Bespoke hand-line marks (no stock icon sets, per the brief). */
function CloseMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <line x1="5" y1="5" x2="15" y2="15" />
        <line x1="15" y1="5" x2="5" y2="15" />
      </g>
    </svg>
  );
}

function ArrowMark({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={dir === 'left' ? 'translate(22,0) scale(-1,1)' : undefined}
      >
        <polyline points="8,5 14,11 8,17" />
      </g>
    </svg>
  );
}
