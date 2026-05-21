/*
 * Life Plan content — read from Postgres, mapped through db-mappers.
 *
 * Pages call these getters instead of importing from lib/data/life.ts
 * so that vault edits (via the webhook or `npm run vault:sync`) actually
 * surface to readers. The in-memory lib/data/* modules remain as the
 * seed source and as a fallback if Supabase is offline at request time.
 */

import 'server-only';
import { getServerAdminClient, isSupabaseConfigured } from '../supabase';
import { fromRow } from '../db-mappers';
import type {
  LifePrinciple, StoryVignette, JourneyEntry,
  LifeGoal, ChangedMyMindEntry,
} from '../types';
import {
  MOTTO as MOTTO_FALLBACK,
  STORY_VIGNETTES as STORY_FALLBACK,
  LIFE_PRINCIPLES as PRINCIPLES_FALLBACK,
  JOURNEY as JOURNEY_FALLBACK,
  LIFE_GOALS as GOALS_FALLBACK,
  CHANGED_MY_MIND as CMM_FALLBACK,
} from '../data/life';

export async function getMotto(): Promise<{ text: string; language: string }> {
  if (!isSupabaseConfigured()) return MOTTO_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db
    .from('life_motto')
    .select('text, language')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] ?? MOTTO_FALLBACK;
}

export async function getStoryVignettes(): Promise<StoryVignette[]> {
  if (!isSupabaseConfigured()) return STORY_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db
    .from('life_story_vignettes').select('*')
    .order('ordinal', { ascending: true });
  return (data ?? []).map(fromRow.storyVignette);
}

export async function getLifePrinciples(): Promise<LifePrinciple[]> {
  if (!isSupabaseConfigured()) return PRINCIPLES_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db
    .from('life_principles').select('*')
    .order('order_', { ascending: true });
  return (data ?? []).map(fromRow.lifePrinciple);
}

export async function getJourneyEntries(): Promise<JourneyEntry[]> {
  if (!isSupabaseConfigured()) return JOURNEY_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db
    .from('life_journey_entries').select('*')
    .order('ordinal', { ascending: true });
  return (data ?? []).map(fromRow.journeyEntry);
}

export async function getLifeGoals(): Promise<LifeGoal[]> {
  if (!isSupabaseConfigured()) return GOALS_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db.from('life_goals').select('*');
  return (data ?? []).map(fromRow.lifeGoal);
}

export async function getChangedMyMind(): Promise<ChangedMyMindEntry[]> {
  if (!isSupabaseConfigured()) return CMM_FALLBACK;
  const db = getServerAdminClient();
  const { data } = await db
    .from('life_changed_mind').select('*')
    .order('date_changed', { ascending: false });
  return (data ?? []).map(fromRow.changedMyMind);
}
