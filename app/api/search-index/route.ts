import { NextResponse } from 'next/server';
import { getSearchIndex } from '@/lib/content/search-index';

/*
 * Search index endpoint — returns the flat list of every searchable
 * item across every public surface. Called by the SearchPalette the
 * first time the user opens it; cached client-side for the rest of
 * the session.
 *
 * Why an endpoint and not a layout fetch: building the index touches
 * ~12 tables. Doing that on every page render so the palette can
 * load instantly is a bad trade — most visitors never open Cmd-K.
 * Fetch on demand, once per session.
 *
 * Cache strategy:
 *   - 5-minute s-maxage at the CDN. Vault edits push through a
 *     webhook that calls revalidatePath('/'), so a brand new piece
 *     of content shows up at the next palette open after the sync
 *     finishes.
 *   - stale-while-revalidate keeps the response instant during
 *     background revalidation.
 */
export async function GET() {
  const items = await getSearchIndex();
  return NextResponse.json(items, {
    headers: {
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
