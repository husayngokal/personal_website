import type { Idea } from '../types';

/*
 * Ideas fallback. Used when Supabase is offline or the ideas table
 * is empty. Real entries live in the vault at /ideas/<slug>.md.
 */

export const IDEAS: Idea[] = [];
