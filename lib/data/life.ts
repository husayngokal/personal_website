import type {
  LifePrinciple,
  JourneyEntry,
  LifeGoal,
  ChangedMyMindEntry,
  StoryVignette,
} from '../types';

/*
 * Life Plan fallback content. Used only when Supabase is offline or
 * the vault tables are empty. Real content lives in the vault at
 * /life/{motto,principles,story,journey,goals,changed-my-mind}/ and
 * is upserted to Postgres on every vault push.
 *
 * Keep arrays empty here on purpose. A fallback principle invented by
 * the maintainer would surface as if the author had written it, which
 * is dishonest. Better to render an empty section while the vault is
 * still being populated than to lie.
 */

export const MOTTO = {
  text: 'Understand deeply. Build honestly. Ship publicly. Serve usefully. Repeat forever.',
  language: 'en',
};

export const STORY_VIGNETTES: StoryVignette[] = [];

export const LIFE_PRINCIPLES: LifePrinciple[] = [];

export const JOURNEY: JourneyEntry[] = [];

export const LIFE_GOALS: LifeGoal[] = [];

export const CHANGED_MY_MIND: ChangedMyMindEntry[] = [];
