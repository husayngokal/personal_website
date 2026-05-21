import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { Book } from '../types';
import {
  BOOKS as BOOKS_FALLBACK,
  PLAN_TARGET,
  PLAN_YEAR,
} from '../data/library';

export { PLAN_TARGET, PLAN_YEAR };

export async function getBooks(): Promise<Book[]> {
  if (!isSupabaseConfigured()) return BOOKS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('library_books').select('*');
  return (data ?? []).map(fromRow.book);
}

export async function getBook(slug: string): Promise<Book | null> {
  if (!isSupabaseConfigured()) return BOOKS_FALLBACK.find((b) => b.slug === slug) ?? null;
  const db = getServerAdminClient();
  const { data } = await db.from('library_books').select('*').eq('slug', slug).maybeSingle();
  return data ? fromRow.book(data) : null;
}

export async function getPlanSummary(year: number = PLAN_YEAR) {
  const books = await getBooks();
  const inYear = books.filter((b) => b.year === year);
  return {
    target: PLAN_TARGET,
    finished: inYear.filter((b) => b.status === 'finished').length,
    reading: inYear.filter((b) => b.status === 'reading' || b.status === 're-reading').length,
    abandoned: inYear.filter((b) => b.status === 'abandoned').length,
    planned: inYear.filter((b) => b.status === 'planned').length,
  };
}
