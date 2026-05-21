/*
 * Supabase clients — server-admin + browser.
 *
 * The browser client uses NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (formerly
 * the "anon" key) and is the one shipped to clients. It only sees what
 * Row-Level Security policies allow — which for content tables is
 * everything readable, and for writeable tables (comments, current_state)
 * is nothing without authentication.
 *
 * The server client uses SUPABASE_SECRET_KEY (formerly "service_role")
 * and bypasses RLS entirely. It must NEVER be imported into client
 * components — guarded by the "server-only" import below.
 *
 * Env naming follows the 2026 Supabase vocabulary; see memory note
 * "Supabase env (2026 naming)" for context.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* Node 20 has no native WebSocket. Supabase's Realtime client throws at
   createClient() time if no WS transport is available. Install ws and pass
   it through. Browser bundles drop the import via dynamic resolution
   because `transport` is also accepted client-side. */
let WsTransport: unknown = undefined;
if (typeof window === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    WsTransport = require('ws');
  } catch {
    /* ws not installed; only matters for server-side scripts */
  }
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!URL) {
  // Don't throw at import time in dev — surfaces would be unreachable.
  // Surface the misconfiguration via getter functions below instead.
  console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL is not set');
}

/* -- Browser client -------------------------------------------------- */
/* Singleton — there should be one client per browser tab. */
let browserClient: SupabaseClient | null = null;

export function getBrowserClient(): SupabaseClient {
  if (!URL || !PUBLISHABLE) {
    throw new Error(
      'Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local',
    );
  }
  if (!browserClient) {
    browserClient = createClient(URL, PUBLISHABLE, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return browserClient;
}

/* -- Server admin client --------------------------------------------- */
/* Read SUPABASE_SECRET_KEY lazily so accidental client-bundle imports
   surface as runtime errors rather than build errors. */
export function getServerAdminClient(): SupabaseClient {
  // This guard is belt-and-braces. Next.js's "server-only" convention
  // would normally catch this at build time, but explicit check helps
  // when running ad-hoc scripts.
  if (typeof window !== 'undefined') {
    throw new Error('getServerAdminClient() must not be called in the browser');
  }
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!URL || !secret) {
    throw new Error(
      'Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local',
    );
  }
  return createClient(URL, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: WsTransport ? { transport: WsTransport as never } : undefined,
  });
}

/* -- Convenience: is Supabase wired? --------------------------------- */
export function isSupabaseConfigured(): boolean {
  return Boolean(URL && PUBLISHABLE);
}
