import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import { selectWithRetry } from '@/lib/athlete-os/services/fitnessQuery';
import { PLAN_RUNS, PLAN_WEEKS, RACE, ZONES } from '@/lib/athlete-os/plan/miami2027';
import type { PlannedRun, PlanWeek } from '@/lib/athlete-os/plan/types';

/**
 * Plan vs actual. Merges the Runna plan (repo source of truth) with Garmin
 * activities, WHOOP morning recovery and — if the `runna_calendar` table
 * exists — Runna's live calendar (pushed to Garmin ~1 week ahead), so Runna's
 * adaptive changes show up without ever overwriting the original prescription.
 *
 * Status rules (MARATHON_TRAINING.md §17): never "completed" just because a
 * date passed. completed ≥ 90% of prescribed distance; modified = done but
 * shorter; rescheduled = Runna tag (e.g. "W13 Tue") found on another date;
 * skipped only when explicitly set; past + no activity = "unconfirmed".
 */

export type RunStatus = 'planned' | 'today' | 'completed' | 'modified' | 'rescheduled' | 'skipped' | 'unconfirmed';

export interface ActualRun { date: string; name: string; km: number; durationSec: number; avgHr: number | null; paceSecPerKm: number | null }

export interface PlanRunView extends PlannedRun {
  status: RunStatus;
  actual: ActualRun | null;
  morningRecovery: number | null;
  /** Runna's live calendar disagrees with the original prescription. */
  runnaChange: string | null;
}

export interface PlanWeekView extends PlanWeek { actualKm: number; actualLongKm: number | null; rides: { date: string; minutes: number; name: string }[] }

export interface KeySession {
  date: string; week: number | null; type: 'quality' | 'long'; name: string;
  plannedKm: number | null; actualKm: number; paceSecPerKm: number | null; avgHr: number | null; morningRecovery: number | null;
}

export interface LoadPoint { date: string; ctl: number; atl: number; tsb: number }

export type RunType = 'easy' | 'quality' | 'long' | 'other';

export interface PlanPayload {
  today: string;
  race: typeof RACE;
  zones: typeof ZONES;
  runs: PlanRunView[];
  weeks: PlanWeekView[];
  keySessions: KeySession[];
  load: {
    history: LoadPoint[];
    fullPlan: LoadPoint[];
    atAdherence: LoadPoint[];
    adherence: number | null;
    adherenceWeeks: number;
    loadPerKm: number | null;
  };
  longestRecentKm: number;
  runnaCalendarConnected: boolean;
  /** Session type per day from Runna names on Garmin runs (any plan). Long > quality > easy > other. */
  runTypes: Record<string, RunType>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TAG = /\bW(\d{1,2})\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i;
const QUALITY = /tempo|repeat|progress|fartlek|over and under|on off|interval|threshold|hill|speed|strides/i;
const isRun = (t: string | null) => /^(running|treadmill_running|trail_running|track_running|indoor_running)$/.test(t ?? '');
const isRide = (t: string | null) => /^(road_biking|virtual_ride|cycling|indoor_cycling|mountain_biking|gravel_cycling)$/.test(t ?? '');
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const dow = (iso: string) => DAYS[new Date(iso + 'T00:00:00Z').getUTCDay()];

/**
 * Runna reuses tags ("W12 Sat") across plans — an earlier plan began 2026-05-12.
 * A tag only counts if the run falls in that week of THIS plan (±3 days slack).
 */
const PLAN_W12_START = '2026-11-09';
function tagFitsThisPlan(tagWeek: number, date: string): boolean {
  const start = addDays(PLAN_W12_START, (tagWeek - 12) * 7);
  return date >= addDays(start, -3) && date <= addDays(start, 9);
}

function plannedKmFromName(name: string): number | null {
  const paren = /\((\d+(?:\.\d+)?)\s*km\)/i.exec(name);
  if (paren) return Number(paren[1]);
  const any = /(\d+(?:\.\d+)?)\s*km/i.exec(name);
  return any ? Number(any[1]) : null;
}

/** Local "today" in the athlete's timezone (America/New_York). */
function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; };

export default async function handler(req: NextApiRequest, res: NextApiResponse<PlanPayload | { error: string }>) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  try {
    const supabase = getFitnessSupabase();
    const [acts, rec] = await Promise.all([
      selectWithRetry<Record<string, any>>(() => supabase.from('activities').select(
        'sport_type, name, start_time, distance_meters, duration_seconds, avg_heart_rate, '
        + 'local:raw_data->>startTimeLocal, load:raw_data->activityTrainingLoad',
      ).eq('source', 'garmin').order('start_time', { ascending: true }).limit(5000) as any),
      selectWithRetry<Record<string, any>>(() => supabase.from('whoop_recovery').select('date, recovery_score') as any),
    ]);
    // Optional: Runna's live calendar (table may not exist yet).
    const cal = await supabase.from('runna_calendar').select('calendar_date, title, planned_km');
    const runnaCalendarConnected = !cal.error;
    const calendar = (cal.data ?? []) as { calendar_date: string; title: string; planned_km: number | null }[];

    const today = todayLocal();
    const recoveryOn = new Map<string, number>((rec as any[]).filter((r) => r.recovery_score != null).map((r) => [r.date, r.recovery_score]));

    const all = (acts as any[]).map((a) => ({
      date: String(a.local ?? a.start_time).slice(0, 10), name: a.name ?? '', sport: a.sport_type as string | null,
      km: (Number(a.distance_meters) || 0) / 1000, durationSec: Number(a.duration_seconds) || 0,
      avgHr: a.avg_heart_rate ?? null, load: Number(a.load) || 0,
    }));
    const runs = all.filter((a) => isRun(a.sport));
    // Merge a session split across several Garmin recordings into one actual.
    const toActual = (parts: typeof runs): ActualRun => {
      const km = parts.reduce((s, p) => s + p.km, 0), dur = parts.reduce((s, p) => s + p.durationSec, 0);
      const hr = parts.filter((p) => p.avgHr != null), hrDur = hr.reduce((s, p) => s + p.durationSec, 0);
      return {
        date: parts[0].date, name: parts[0].name, km: Math.round(km * 100) / 100, durationSec: dur,
        avgHr: hrDur > 0 ? hr.reduce((s, p) => s + p.avgHr! * p.durationSec, 0) / hrDur : null,
        paceSecPerKm: km > 0 ? dur / km : null,
      };
    };

    // ── Plan runs ↔ Garmin runs ────────────────────────────────────────────
    const used = new Set<typeof runs[number]>();
    const runViews: PlanRunView[] = PLAN_RUNS.map((p) => {
      const day = dow(p.date);
      let match = runs.find((a) => !used.has(a) && (() => { const m = TAG.exec(a.name); return m && Number(m[1]) === p.week && m[2].toLowerCase() === day.toLowerCase() && tagFitsThisPlan(p.week, a.date); })());
      const rescheduled = !!match && match.date !== p.date;
      if (!match) match = runs.find((a) => !used.has(a) && a.date === p.date);
      // Pull in other recordings of the same session (same day, same tag or untagged).
      const tagOf = (n: string) => { const m = TAG.exec(n); return m ? `${m[1]} ${m[2].toLowerCase()}` : null; };
      const parts = match ? runs.filter((a) => !used.has(a) && a.date === match!.date && (a === match || tagOf(a.name) === tagOf(match!.name) || tagOf(a.name) == null)) : [];
      parts.forEach((a) => used.add(a));
      const actual = parts.length ? toActual(parts) : null;

      let status: RunStatus;
      if (p.explicitStatus) status = p.explicitStatus;
      else if (actual) status = rescheduled ? 'rescheduled' : actual.km >= 0.9 * p.plannedDistanceKm ? 'completed' : 'modified';
      else if (p.date > today) status = 'planned';
      else if (p.date === today) status = 'today';
      else status = 'unconfirmed';

      // Runna live-calendar comparison.
      let runnaChange: string | null = null;
      const tagged = calendar.find((c) => { const m = TAG.exec(c.title); return m && Number(m[1]) === p.week && m[2].toLowerCase() === day.toLowerCase() && tagFitsThisPlan(p.week, c.calendar_date); });
      if (tagged) {
        if (tagged.calendar_date !== p.date) runnaChange = `Runna moved this to ${tagged.calendar_date}`;
        else if (tagged.planned_km != null && Math.abs(tagged.planned_km - p.plannedDistanceKm) >= 0.5) runnaChange = `Runna now prescribes ${tagged.planned_km} km`;
      }

      return { ...p, status, actual, morningRecovery: recoveryOn.get(p.date) ?? null, runnaChange };
    });

    // ── Weeks ──────────────────────────────────────────────────────────────
    const weekViews: PlanWeekView[] = PLAN_WEEKS.map((w) => {
      const inWeek = (d: string) => d >= w.start && d <= w.end;
      const wkRuns = runs.filter((a) => inWeek(a.date));
      const longPlan = runViews.find((r) => r.week === w.week && r.workoutType === 'long');
      return {
        ...w,
        actualKm: Math.round(wkRuns.reduce((s, a) => s + a.km, 0) * 10) / 10,
        actualLongKm: longPlan?.actual ? longPlan.actual.km : null,
        rides: all.filter((a) => isRide(a.sport) && inWeek(a.date)).map((a) => ({ date: a.date, minutes: Math.round(a.durationSec / 60), name: a.name })),
      };
    });

    // ── Key sessions: Runna-tagged Garmin runs from THIS plan (W1 = 2026-08-24) ─
    // One session can be split across several Garmin recordings (watch restart
    // mid-run) — merge recordings with the same date + Runna tag.
    const sessionGroups = new Map<string, typeof runs>();
    for (const a of runs) {
      const m = TAG.exec(a.name);
      if (!m || !tagFitsThisPlan(Number(m[1]), a.date) || !(QUALITY.test(a.name) || /long run/i.test(a.name))) continue;
      const key = `${a.date}|W${m[1]} ${m[2].toLowerCase()}`;
      sessionGroups.set(key, [...(sessionGroups.get(key) ?? []), a]);
    }
    const keySessions: KeySession[] = Array.from(sessionGroups.values()).map((parts) => {
      const a = parts[0];
      const km = parts.reduce((s, p) => s + p.km, 0);
      const dur = parts.reduce((s, p) => s + p.durationSec, 0);
      const hrParts = parts.filter((p) => p.avgHr != null);
      const hrDur = hrParts.reduce((s, p) => s + p.durationSec, 0);
      return {
        date: a.date, week: Number(TAG.exec(a.name)![1]), type: (/long run/i.test(a.name) ? 'long' : 'quality') as 'long' | 'quality',
        name: a.name.replace(/^[^-]*?-\s*(?=W\d)/, '') + (parts.length > 1 ? ` (${parts.length} recordings)` : ''),
        plannedKm: plannedKmFromName(a.name),
        actualKm: Math.round(km * 100) / 100, paceSecPerKm: km > 0 ? dur / km : null,
        avgHr: hrDur > 0 ? hrParts.reduce((s, p) => s + p.avgHr! * p.durationSec, 0) / hrDur : null,
        morningRecovery: recoveryOn.get(a.date) ?? null,
      };
    }).sort((x, y) => y.date.localeCompare(x.date));

    // ── Training load (Garmin activityTrainingLoad, all sports) ────────────
    const loadByDay = new Map<string, number>();
    for (const a of all) loadByDay.set(a.date, (loadByDay.get(a.date) ?? 0) + a.load);
    const first = all.length ? all[0].date : today;
    const history: LoadPoint[] = [];
    let ctl = 0, atl = 0;
    for (let d = first; d <= today; d = addDays(d, 1)) {
      const L = loadByDay.get(d) ?? 0;
      ctl += (L - ctl) / 42; atl += (L - atl) / 7;
      history.push({ date: d, ctl, atl, tsb: ctl - atl });
    }
    // Projection assumptions: planned run load = km × your median load/km (last
    // 8 weeks); non-running load continues at its recent daily average.
    const since = addDays(today, -56);
    const recentRuns = runs.filter((a) => a.date > since && a.km > 1 && a.load > 0);
    const loadPerKm = median(recentRuns.map((a) => a.load / a.km));
    const nonRunDaily = all.filter((a) => !isRun(a.sport) && a.date > since).reduce((s, a) => s + a.load, 0) / 56;
    const elapsed = weekViews.filter((w) => w.end < today);
    const plannedElapsed = elapsed.reduce((s, w) => s + w.plannedKm, 0);
    const adherence = plannedElapsed > 0 ? Math.min(1, elapsed.reduce((s, w) => s + w.actualKm, 0) / plannedElapsed) : null;

    const project = (factor: number): LoadPoint[] => {
      const out: LoadPoint[] = [];
      let c = history.at(-1)?.ctl ?? 0, t = history.at(-1)?.atl ?? 0;
      for (let d = addDays(today, 1); d <= RACE.date; d = addDays(d, 1)) {
        const planned = runViews.filter((r) => r.date === d && r.workoutType !== 'race').reduce((s, r) => s + r.plannedDistanceKm, 0);
        const L = (loadPerKm ?? 0) * planned * factor + nonRunDaily;
        c += (L - c) / 42; t += (L - t) / 7;
        out.push({ date: d, ctl: c, atl: t, tsb: c - t });
      }
      return out;
    };

    // Session type per day (all Runna-named runs, any plan) for recovery analysis.
    const rank: Record<RunType, number> = { long: 3, quality: 2, easy: 1, other: 0 };
    const runTypes: Record<string, RunType> = {};
    for (const a of runs) {
      const t: RunType = /long run/i.test(a.name) ? 'long' : QUALITY.test(a.name) ? 'quality' : /easy/i.test(a.name) ? 'easy' : 'other';
      if (!runTypes[a.date] || rank[t] > rank[runTypes[a.date]]) runTypes[a.date] = t;
    }

    const longestRecentKm = Math.round(Math.max(0, ...runs.filter((a) => a.date > since).map((a) => a.km)) * 10) / 10;
    const r1 = (p: LoadPoint) => ({ date: p.date, ctl: Math.round(p.ctl * 10) / 10, atl: Math.round(p.atl * 10) / 10, tsb: Math.round(p.tsb * 10) / 10 });

    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      today, race: RACE, zones: ZONES, runs: runViews, weeks: weekViews, keySessions,
      load: {
        history: history.slice(-150).map(r1), fullPlan: project(1).map(r1),
        atAdherence: adherence != null ? project(adherence).map(r1) : [],
        adherence, adherenceWeeks: elapsed.length, loadPerKm: loadPerKm != null ? Math.round(loadPerKm * 10) / 10 : null,
      },
      longestRecentKm, runnaCalendarConnected, runTypes,
    });
  } catch (err) {
    console.error('athlete-os plan:', err);
    res.status(503).json({ error: 'plan unavailable' });
  }
}
