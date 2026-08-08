/*
 * Studio session sealing.
 *
 * The session cookie carries { login, token } where token is the GitHub
 * OAuth access token used to commit to the vault repo. Because that token
 * is sensitive (repo scope), the payload is AES-256-GCM encrypted with a
 * key derived from STUDIO_SESSION_SECRET — signing alone would leave the
 * token readable in the cookie jar. httpOnly + secure + sameSite=lax on the
 * cookie itself; encryption is defense in depth on top.
 *
 * Node runtime only (route handlers + server components), never Edge — it
 * uses node:crypto. We deliberately do not gate Studio via Edge middleware.
 */

import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { studio, STUDIO_SESSION_COOKIE } from './config';

export interface StudioSession {
  login: string;
  token: string;
  iat: number;
}

const ALGO = 'aes-256-gcm';

function key(): Buffer {
  /* sessionSecret is guaranteed present by studioConfigured() at the call
     sites; hash to a fixed 32-byte key regardless of the secret's length. */
  return crypto.createHash('sha256').update(String(studio.sessionSecret)).digest();
}

export function seal(payload: StudioSession): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

export function unseal(value: string): StudioSession | null {
  try {
    const b = Buffer.from(value, 'base64url');
    const iv = b.subarray(0, 12);
    const tag = b.subarray(12, 28);
    const data = b.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(out) as StudioSession;
    if (!parsed.login || !parsed.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Read + validate the current Studio session. Returns null unless a valid
 *  cookie exists AND its login matches the single allowed account. */
export async function getStudioSession(): Promise<StudioSession | null> {
  const raw = (await cookies()).get(STUDIO_SESSION_COOKIE)?.value;
  if (!raw) return null;
  const s = unseal(raw);
  if (!s) return null;
  if (s.login !== studio.allowedLogin) return null;
  return s;
}
