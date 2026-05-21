'use client';

import { useState } from 'react';
import styles from './NewsletterForm.module.css';

/*
 * Newsletter signup form.
 *
 * Minimal by design — single input + submit, brief one-line explanation
 * above, two reassurance lines below. POSTs to /api/newsletter/subscribe;
 * shows inline success or error without redirect.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success'; alreadySubscribed: boolean }
  | { kind: 'error'; message: string };

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [email, setEmail] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === 'submitting') return;
    setState({ kind: 'submitting' });
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.ok) {
        setState({ kind: 'success', alreadySubscribed: !!data.alreadySubscribed });
        setEmail('');
      } else {
        setState({ kind: 'error', message: errorMessage(data.error) });
      }
    } catch {
      setState({ kind: 'error', message: 'Network error. Try again in a moment.' });
    }
  }

  return (
    <section className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      {!compact && (
        <p className={styles.intro}>
          A weekly email when anything changes on the site. One email a week at
          most, unsubscribe anytime.
        </p>
      )}

      {state.kind === 'success' ? (
        <p className={styles.success}>
          {state.alreadySubscribed
            ? "You're already subscribed. Nothing else to do."
            : 'Subscribed. You\'ll get the next weekly digest.'}
        </p>
      ) : (
        <form onSubmit={submit} className={styles.form} aria-label="Subscribe to weekly updates">
          <input
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            placeholder="you@somewhere.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            disabled={state.kind === 'submitting'}
            aria-label="Email address"
          />
          <button type="submit" disabled={state.kind === 'submitting'} className={styles.button}>
            {state.kind === 'submitting' ? 'Subscribing…' : 'Subscribe →'}
          </button>
        </form>
      )}

      {state.kind === 'error' && (
        <p className={styles.error}>{state.message}</p>
      )}

      {!compact && state.kind !== 'success' && (
        <p className={styles.fineprint}>
          The list is mine, kept in Postgres. Not sold or shared.
        </p>
      )}
    </section>
  );
}

function errorMessage(code: string): string {
  switch (code) {
    case 'invalid-email':  return 'That doesn\'t look like a valid email.';
    case 'rate-limited':   return 'Too many attempts. Wait a minute and try again.';
    case 'missing-email':  return 'Email is required.';
    default:               return 'Something went wrong. Try again in a moment.';
  }
}
