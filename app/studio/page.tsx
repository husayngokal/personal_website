/*
 * Studio landing. Reached only with a valid session (the layout gates it).
 * This is the auth-foundation increment: it confirms sign-in works and shows
 * the error register from the OAuth callback. Create/edit surfaces land next.
 */

import styles from './studio.module.css';

export const dynamic = 'force-dynamic';

const ERROR_COPY: Record<string, string> = {
  'state-mismatch': 'Sign-in expired or was tampered with. Try again.',
  'token-exchange-failed': 'GitHub would not exchange the code. Try again.',
  'no-token': 'GitHub returned no access token. Try again.',
  'user-fetch-failed': 'Could not read your GitHub identity. Try again.',
  forbidden: 'That GitHub account is not allowed here.',
};

export default async function StudioHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      {error && <p className={styles.error}>{ERROR_COPY[error] ?? `Sign-in error: ${error}`}</p>}
      <h1 className={styles.h1}>Studio</h1>
      <p className={styles.p}>
        You are signed in. This is the authoring surface for the site: create and
        edit any page from here, phone or desktop.
      </p>
      <p className={styles.pMuted}>
        Auth is live. The create and edit forms for every surface are being built on
        top of this and will appear here next.
      </p>
    </div>
  );
}
