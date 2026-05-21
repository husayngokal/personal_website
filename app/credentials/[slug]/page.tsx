import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip } from '@/components/Primitives';
import { Backlinks } from '@/components/Backlinks';
import { getCredential, getCredentials, credentialFileUrl } from '@/lib/content/credentials';
import { renderMarkdown } from '@/lib/markdown';
import styles from '../credentials.module.css';

/*
 * Credential detail — masthead with type/year/institution, a
 * prominent download link to the R2-hosted file, optional verifier
 * link, optional body explaining what the document is. Inline PDF
 * preview via <object> with a download fallback so the page stays
 * useful on mobile (where most browsers refuse to render PDF inline).
 */

export const revalidate = 60; // ISR — regenerates every 60s in the background; vault webhook calls revalidatePath() on push for immediate freshness

const TYPE_LABEL: Record<string, string> = {
  transcript:  'Transcript',
  diploma:     'Diploma',
  certificate: 'Certificate',
  letter:      'Letter',
  other:       'Other',
};

export async function generateStaticParams() {
  const all = await getCredentials();
  return all.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCredential(slug);
  return c ? { title: `${c.title} — Credentials` } : {};
}

export default async function CredentialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getCredential(slug);
  if (!c) notFound();

  const fileUrl = c.filePath ? credentialFileUrl(c.filePath) : null;
  const isPdf = c.filePath ? /\.pdf$/i.test(c.filePath) : false;
  const html  = c.body ? await renderMarkdown(c.body, 'credentials') : null;

  return (
    <div className="page" style={{ paddingTop: 'var(--space-l)', paddingBottom: 'var(--space-2xl)' }}>
      <header className={styles.detailHead}>
        <p className={styles.detailKicker}>
          <Link href="/credentials">← Credentials</Link>
        </p>
        <h1 className={styles.detailTitle}>{c.title}</h1>
        <div className={styles.detailMetaRow}>
          <Chip>{TYPE_LABEL[c.type] ?? c.type}</Chip>
          {c.year && <span className={styles.year}>{c.year}</span>}
          {c.institution && <span className={styles.institutionInline}>{c.institution}</span>}
        </div>
        {c.description && (
          <p className={styles.detailDescription}>{c.description}</p>
        )}
      </header>

      {(fileUrl || c.verificationUrl) && (
        <div className={styles.actions}>
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={styles.primaryAction}>
              Download {isPdf ? 'PDF' : 'file'} →
            </a>
          )}
          {c.verificationUrl && (
            /* When there's no downloadable file (LinkedIn-imported
               certifications etc.), the verifier link IS the primary
               CTA; promote it to the prominent button style. */
            <a
              href={c.verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={fileUrl ? styles.secondaryAction : styles.primaryAction}
            >
              Verify on {tryHostname(c.verificationUrl)} →
            </a>
          )}
        </div>
      )}

      {html && (
        <div
          className={styles.body}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {isPdf && fileUrl && (
        <div className={styles.previewWrap}>
          <p className={styles.previewLabel}>Preview</p>
          <object
            data={fileUrl}
            type="application/pdf"
            className={styles.preview}
            aria-label={`${c.title} — PDF preview`}
          >
            <p className={styles.previewFallback}>
              Your browser can&apos;t embed the PDF inline.{' '}
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">Open it in a new tab →</a>
            </p>
          </object>
        </div>
      )}

      <Backlinks table="credentials" slug={c.slug} />
    </div>
  );
}

function tryHostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return 'verifier'; }
}
