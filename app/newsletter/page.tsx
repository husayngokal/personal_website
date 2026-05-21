import { Eyebrow } from '@/components/Primitives';
import { NewsletterForm } from '@/components/NewsletterForm';
import styles from './newsletter.module.css';

export const metadata = {
  title: 'Subscribe',
  description:
    'A weekly email when anything changes on husayngokal.com — new essays, books finished, courses studied, principles revised.',
};

export default function NewsletterPage() {
  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <Eyebrow number="13">Subscribe</Eyebrow>
      <h1 className={styles.title}>The weekly email.</h1>

      <p className={styles.dek}>
        One email a week, at most. It rolls up what changed on the site
        in the previous seven days — new Notebook essays, books finished,
        courses started, principles revised, projects shipped. Nothing
        else. No drip campaigns, no upsells, no read tracking.
      </p>

      <NewsletterForm />

      <hr className={styles.rule} />

      <h2 className={styles.h2}>What you can expect</h2>

      <p>
        Each email is short — the kind that respects your inbox. Plain
        editorial typography, single column, no images unless an essay
        needs one. Sent Sunday mornings UTC. If nothing meaningful
        changed that week, the email doesn&apos;t go out.
      </p>

      <p>
        Unsubscribe is one click on a token link at the bottom of every
        message. No login, no preferences page, no &quot;are you sure?&quot;
        — just gone.
      </p>

      <h2 className={styles.h2}>What I store</h2>

      <p>
        Your email address, a random token (so you can unsubscribe),
        the date you signed up, a hash of your IP for rate-limiting,
        the date of the last email I sent you. That&apos;s it. The list
        lives in this site&apos;s Postgres database and is not shared
        with any third party.
      </p>
    </div>
  );
}
