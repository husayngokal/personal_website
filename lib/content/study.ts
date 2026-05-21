import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type { StudyCredential, StudyDomain, Publication, Conference } from '../types';
import {
  STUDY_CREDENTIALS as CREDS_FALLBACK,
  STUDY_DOMAINS as DOMAINS_FALLBACK,
  PUBLICATIONS as PUBS_FALLBACK,
  CONFERENCES as CONFS_FALLBACK,
} from '../data/study';

export async function getStudyCredentials(): Promise<StudyCredential[]> {
  if (!isSupabaseConfigured()) return CREDS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('study_credentials').select('*');
  return (data ?? []).map(fromRow.studyCredential);
}

export async function getStudyCredential(slug: string): Promise<StudyCredential | null> {
  if (!isSupabaseConfigured()) return CREDS_FALLBACK.find((c) => c.slug === slug) ?? null;
  const db = getServerAdminClient();
  const { data } = await db.from('study_credentials').select('*').eq('slug', slug).maybeSingle();
  return data ? fromRow.studyCredential(data) : null;
}

export async function getStudyDomains(): Promise<StudyDomain[]> {
  if (!isSupabaseConfigured()) return DOMAINS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('study_domains').select('*');
  return (data ?? []).map(fromRow.studyDomain);
}

export async function getStudyDomain(slug: string): Promise<StudyDomain | null> {
  if (!isSupabaseConfigured()) return DOMAINS_FALLBACK.find((d) => d.slug === slug) ?? null;
  const db = getServerAdminClient();
  const { data } = await db.from('study_domains').select('*').eq('slug', slug).maybeSingle();
  return data ? fromRow.studyDomain(data) : null;
}

export async function getPublications(): Promise<Publication[]> {
  if (!isSupabaseConfigured()) return PUBS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('publications').select('*');
  return (data ?? []).map(fromRow.publication);
}

export async function getConferences(): Promise<Conference[]> {
  if (!isSupabaseConfigured()) return CONFS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('conferences').select('*');
  return (data ?? []).map(fromRow.conference);
}
