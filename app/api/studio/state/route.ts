/*
 * The Quick board as JSON, for the watch app.
 *
 * The same data the quick page renders (lib/studio/quick-data.ts), plus
 * what the page works out in the browser: what needs a hand, each task's
 * price, each Field Atlas outing's points, and the rules the forms are
 * built from. So the watch carries no copy of the scoring logic beyond
 * the few gain formulas it uses to show a tap's points at once.
 *
 * Writes go through the existing routes (quick, timer, plan) unchanged.
 * Auth: a Studio session, from the cookie or an Authorization: Bearer
 * header (lib/studio/session.ts).
 */

import { NextResponse } from 'next/server';
import { getStudioSession } from '@/lib/studio/session';
import { getServerAdminClient, isSupabaseConfigured } from '@/lib/supabase';
import { loadQuickData } from '@/lib/studio/quick-data';
import { needsYou } from '@/lib/score/needs';
import { authorDay } from '@/lib/content/streak';
import {
  ACTIVITIES, MINUTES_PER_POINT, READING_TIERS, TASK_GUT_HOURS, TEMPLATES, UNIT_CAP,
  atlasPoints, estimate, timedPoints,
} from '@/lib/score/rules';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getStudioSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: 'no-database' }, { status: 503 });

  const data = await loadQuickData(getServerAdminClient());
  const s = data.score;
  const today = authorDay();

  /* A task's price as the page shows it: its own frozen points when it
     has them, else the gut figure for its scope. Priced: not offered
     "Size it" again. */
  const tasks = data.tasks.map((t) => {
    const sized = s?.items.find((i) => i.table === 'tasks' && i.slug === t.slug);
    const own = s?.priced?.[t.slug];
    return {
      ...t,
      worth: sized && sized.total > 0 ? sized.total : own ?? estimate.gut(TASK_GUT_HOURS[t.scope] ?? 4),
      priced: !!sized?.hasBlock || own !== undefined,
    };
  });

  /* Items are sent once, in score.items; a need names its item by key. */
  const needs = s
    ? needsYou(s.items, s.load, today, { calibration: s.calibration, refreshAt: data.refreshAt }).map((n) =>
        'item' in n ? { ...n, item: n.item.key }
        : n.kind === 'over' ? { ...n, biggest: n.biggest.map((i) => i.key) }
        : n)
    : [];

  return NextResponse.json(
    {
      now: Date.now(),
      today,
      login: session.login,
      tasks,
      projects: data.projects,
      atlas: data.atlas && {
        slug: data.atlas.slug,
        title: data.atlas.title,
        groups: data.atlas.groups.map((g) => ({
          heading: g.heading,
          items: g.items.map((i) => ({ ...i, worth: atlasPoints(i.text, g.heading) })),
        })),
      },
      score: s && {
        week: s.week,
        lifetime: s.lifetime,
        streak: s.streak,
        items: s.items,
        load: s.load,
        bar: s.bar,
        curiosityCap: s.curiosityCap,
        time: s.time && { weekMinutes: s.time.weekMinutes, weekByLane: s.time.weekByLane, totalByKey: s.time.totalByKey },
      },
      timer: data.timer,
      needs,
      rules: {
        minutesPerPoint: MINUTES_PER_POINT,
        unitCap: UNIT_CAP,
        timedRate: timedPoints(60),
        templates: TEMPLATES,
        tiers: READING_TIERS,
        activities: ACTIVITIES,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
