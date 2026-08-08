/*
 * Studio layout — the auth gate for the whole authoring surface.
 *
 * Not in the menu, sitemap, or search. noindex. If the auth env vars are
 * absent (local dev) it says so; if configured but not signed in, it shows
 * the GitHub sign-in prompt and renders no children; only a valid session
 * for the single allowed account gets through. API write routes re-check
 * the session themselves — a layout cannot protect route handlers.
 */

import type { Metadata } from 'next';
import { studioConfigured } from '@/lib/studio/config';
import { getStudioSession } from '@/lib/studio/session';
import styles from './studio.module.css';

export const metadata: Metadata = {
  title: 'Studio',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const configured = studioConfigured();
  const session = configured ? await getStudioSession() : null;

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <span className={styles.brand}>
          husayn gokal<span className={styles.dot}>.</span> <span className={styles.sub}>studio</span>
        </span>
        {session && (
          <span className={styles.who}>
            {session.login}
            <a className={styles.logout} href="/api/studio/auth/logout">sign out</a>
          </span>
        )}
      </header>

      <main className={styles.main}>
        {!configured ? (
          <div className={styles.notice}>
            <h1 className={styles.h1}>Studio is production-only</h1>
            <p className={styles.p}>
              The authoring surface needs its GitHub OAuth and R2 credentials, which
              live only in the Vercel production environment. Open it at{' '}
              <a href="https://husayngokal.com/studio">husayngokal.com/studio</a>.
            </p>
          </div>
        ) : !session ? (
          <div className={styles.notice}>
            <h1 className={styles.h1}>Sign in</h1>
            <p className={styles.p}>Studio is private. Sign in with GitHub to continue.</p>
            <a className={styles.signin} href="/api/studio/auth/login">Sign in with GitHub</a>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
