/*
 * R2 (S3-compatible) uploads for Studio image posting. Signs the PUT with
 * aws4fetch using the R2 S3 credentials and returns the public CDN URL.
 * Images live on the same bucket the vault pre-push hook uses
 * (media.husayngokal.com), so a phone upload and a desktop upload land in the
 * same place.
 */

import 'server-only';
import { AwsClient } from 'aws4fetch';

function mediaBase(): string {
  return (process.env.NEXT_PUBLIC_VAULT_MEDIA_URL || 'https://media.husayngokal.com').replace(/\/+$/, '');
}

export function r2Configured(): boolean {
  return Boolean(
    process.env.R2_S3_ENDPOINT &&
    process.env.R2_BUCKET &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY,
  );
}

/** PUT bytes to R2 under `key`, return the public https URL. */
export async function uploadToR2(key: string, body: ArrayBuffer, contentType: string): Promise<string> {
  const endpoint = process.env.R2_S3_ENDPOINT;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 not configured');
  }

  /* R2 uses region "auto". aws4fetch signs SigV4 for the s3 service. */
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const url = `${endpoint.replace(/\/+$/, '')}/${bucket}/${key}`;
  const res = await client.fetch(url, {
    method: 'PUT',
    body,
    headers: { 'Content-Type': contentType },
  });
  if (!res.ok) {
    throw new Error(`R2 PUT ${res.status}: ${await res.text()}`);
  }
  return `${mediaBase()}/${key}`;
}
