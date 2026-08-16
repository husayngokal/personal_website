import type { NotebookPost } from '../types';

/*
 * Fallback notebook posts, used only when Supabase is unconfigured
 * (preview builds, CI, a clone with no env file). Intentionally empty:
 * the vault is the source of truth, and a fabricated entry rendering as
 * if the author wrote it is worse than an empty surface. Every notebook
 * page guards on the empty case.
 */

export const NOTEBOOK_POSTS: NotebookPost[] = [];
