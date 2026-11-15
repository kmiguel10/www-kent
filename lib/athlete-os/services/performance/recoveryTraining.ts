import type { DailyMatrix } from '@/lib/athlete-os/types';

/**
 * Recovery ↔ training — the two-way relationship.
 *   1. recovery → performance: each run's morning WHOOP recovery vs its
 *      intensity-controlled performance (runPerf), grouped by WHOOP band.
 *   2. training → recovery ("recovery cost"): average recovery on the days
 *      after each session type, relative to the 30-day median before it.
 *   3. readiness calendar: daily recovery with sessions marked (built in the UI).
 * WHOOP dates by wake day, so "day 0" recovery is the morning BEFORE that
 * day's session — it reflects how recovered you were going in, not the cost.
 */

export type Band = 'red' | 'yellow' | 'green';
export type SessionType = 'easy' | 'quality' | 'long' | 'other';

export const BAND_COLOR: Record<Band, string> = { red: '#ef4444', yellow: '#eab308', green: '#10b981' };
export const BAND_LABEL: Record<Band, string> = { red: 'Red <34%', yellow: 'Yellow 34–66%', green: 'Green 67%+' };
export const bandOf = (r: number): Band => (r < 34 ? 'red' : r < 67 ? 'yellow' : 'green');

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export interface PerfPoint { date: string; recovery: number; perf: number; type: SessionType }

export function recoveryPerformance(m: DailyMatrix, runTypes: Record<string, SessionType>): PerfPoint[] {
  const out: PerfPoint[] = [];
  m.dates.forEach((d, i) => {
    const r = m.series.recovery[i], p = m.series.runPerf[i];
    if (r != null && p != null) out.push({ date: d, recovery: r, perf: p, type: runTypes[d] ?? 'other' });
  });
  return out;
}

export interface BandSummary { band: Band; n: number; mean: number | null }

export function summarizeBands(points: PerfPoint[]): BandSummary[] {
  return (['red', 'yellow', 'green'] as Band[]).map((band) => {
    const v = points.filter((p) => bandOf(p.recovery) === band).map((p) => p.perf);
    return { band, n: v.length, mean: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null };
  });
}

export type CostGroup = 'quality' | 'long' | 'easy' | 'rest';
export interface CostCurve { group: CostGroup; points: { day: number; mean: number | null; n: number }[]; sessions: number }

/** Average recovery deviation (pts vs 30-day median before the session) on days 0..3. */
export function recoveryCost(m: DailyMatrix, runTypes: Record<string, SessionType>, maxDay = 3): CostCurve[] {
  const idx = new Map(m.dates.map((d, i) => [d, i]));
  const rec = (d: string) => { const i = idx.get(d); return i == null ? null : m.series.recovery[i]; };
  const base = (d: string): number | null => {
    const vals: number[] = [];
    for (let k = 1; k <= 30; k++) { const v = rec(addDays(d, -k)); if (v != null) vals.push(v); }
    return vals.length >= 7 ? median(vals) : null;
  };
  const days: Record<CostGroup, string[]> = { quality: [], long: [], easy: [], rest: [] };
  for (const [d, t] of Object.entries(runTypes)) if (t === 'quality' || t === 'long' || t === 'easy') days[t].push(d);
  // Rest = no Garmin activity that day (no training load recorded) and WHOOP data present.
  m.dates.forEach((d, i) => { if (m.series.trainingLoad[i] == null && m.series.recovery[i] != null) days.rest.push(d); });

  return (Object.keys(days) as CostGroup[]).map((group) => {
    const usable = days[group].filter((d) => base(d) != null);
    const points = Array.from({ length: maxDay + 1 }, (_, day) => {
      const v = usable.map((d) => { const r = rec(addDays(d, day)); return r == null ? null : r - base(d)!; }).filter((x): x is number => x != null);
      return { day, mean: v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null, n: v.length };
    });
    return { group, points, sessions: usable.length };
  });
}
