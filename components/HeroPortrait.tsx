'use client';

/*
 * Hero portrait — cut-out studio photograph with background removed via
 * the rembg pipeline (per BRIEF.md Part V). Sits directly on page beige
 * without a frame; proportions preserved via object-fit: contain.
 *
 * Loading order:
 *   1. /public/hero.webp (smallest, modern browsers)
 *   2. /public/hero.png (broad support fallback)
 *   3. /public/hero.svg (silhouette placeholder, last resort)
 *
 * The CSS reserves the 220×282 box so layout never shifts.
 *
 * The pointing-hand mark is no longer a child of this component; it
 * lives in its own slot in the hero layout, between text and portrait.
 *
 * 'use client' because the <img> onError fallback runs in the browser.
 */

import { useState } from 'react';
import styles from './HeroPortrait.module.css';

const SOURCES = ['/hero.webp', '/hero.png', '/hero.svg'] as const;

export function HeroPortrait() {
  const [i, setI] = useState(0);

  return (
    <div className={styles.portraitWrap}>
      <div className={styles.portraitInner}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SOURCES[i]}
          alt="Husayn Gokal — portrait"
          className={styles.portrait}
          width={220}
          height={282}
          onError={() => {
            if (i < SOURCES.length - 1) setI(i + 1);
          }}
        />
      </div>
    </div>
  );
}
