import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import { selectWithRetry } from '@/lib/athlete-os/services/fitnessQuery';
import { isGarminRun } from '@/lib/athlete-os/services/performance/garminPerformance';

/**
 * Marathon projection inputs — Garmin runs only.
 *
 * Three independent estimators of current marathon ability, each over a
 * trailing 8-week window:
 *   1. race   — Riegel from your best Garmin fastest-splits (half > 10K > 5K,
 *               longer distances weighted more; they predict a marathon better).
 *   2. aerobic— your grade-adjusted speed-vs-HR line evaluated at a sustainable
 *               marathon HR (82% of observed max HR).
 *   3. vo2    — Daniels VDOT from Garmin VO₂max. Reported as a CEILING
 *               (potential), not blended — for most runners it's optimistic.
 * Headline = 60% race + 40% aerobic; range = the spread between them.
 * The same calc is rolled weekly so the client can fit a trajectory.
 */

export interface EstimateSet {
  raceSec: number | null;
  raceFrom: string | null;
  aerobicSec: number | null;
  vo2Sec: number | null;
  vo2max: number | null;
  ensembleSec: number | null;
  lowSec: number | null;
  highSec: number | null;
}

export interface MarathonPayload {
  current: EstimateSet;
  /** Weekly rolling ensemble (week = ISO date of the window end, Sundays). */
  weekly: { week: string; ensembleSec: number | null; vo2Sec: number | null }[];
  prs: { name: string; distanceM: number; seconds: number; date: string }[];
  weeklyMileage: { week: string; km: number }[];
  longestRunKm: number;
  recentWeeklyAvgKm: number;
  /** Max HR used for the aerobic estimator (2nd-highest run max, last 12 months). */
  hrMax: number | null;
}

const MARATHON_M = 42195;
const WINDOW_MS = 56 * 864e5;
const RIEGEL = 1.06;
const MARATHON_HR_FRAC = 0.82;
const SPLITS: { key: string; name: string; m: number; w: number }[] = [
  { key: 'fastestSplit_21098', name: 'half marathon', m: 21097.5, w: 4 },
  { key: 'fastestSplit_10000', name: '10K', m: 10000, w: 2 },
  { key: 'fastestSplit_5000', name: '5K', m: 5000, w: 1 },
];
const PR_SPLITS = [
  { key: 'fastestSplit_1000', name: '1K', m: 1000 },
  { key: 'fastestSplit_1609', name: '1 mile', m: 1609.34 },
  ...SPLITS.slice().reverse().map(({ key, name, m }) => ({ key, name, m })),
];

interface Run {
  t: number; day: string; dur: number; hr: number | null; maxHr: number | null;
  gap: number | null; km: number; vo2: number | null; splits: Record<string, number>;
}

const riegel = (sec: number, m: number) => sec * Math.pow(MARATHON_M / m, RIEGEL);

/** Daniels/Gilbert: marathon time (s) for a given VDOT, solved by bisection. */
function vdotMarathon(vdot: number): number {
  const f = (tMin: number) => {
    const v = MARATHON_M / tMin; // m/min
    const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
    const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
    return vo2 / pct - vdot;
  };
  let lo = 100, hi = 720;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
  return ((lo + hi) / 2) * 60;
}

function linfit(pts: { x: number; y: number }[]) {
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0);
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0), sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const d = n * sxx - sx * sx;
  if (!d) return null;
  const b = (n * sxy - sx * sy) / d;
  return { a: (sy - b * sx) / n, b };
}

function estimate(runs: Run[], endMs: number, hrMax: number | null): EstimateSet {
  const win = runs.filter((r) => r.t <= endMs && r.t > endMs - WINDOW_MS);

  // 1. Race-effort (Riegel), weighted by split distance.
  let wSum = 0, wTot = 0, raceFrom: string | null = null, bestW = 0;
  for (const s of SPLITS) {
    const best = Math.min(...win.map((r) => r.splits[s.key] ?? Infinity));
    if (!Number.isFinite(best)) continue;
    wSum += riegel(best, s.m) * s.w; wTot += s.w;
    if (s.w > bestW) { bestW = s.w; raceFrom = s.name; }
  }
  const raceSec = wTot ? wSum / wTot : null;

  // 2. Aerobic: GAP speed vs HR on ≥20-min runs, read at marathon HR.
  let aerobicSec: number | null = null;
  const pts = win.filter((r) => r.dur >= 1200 && r.hr && r.gap && r.gap > 1.5).map((r) => ({ x: r.hr!, y: r.gap! }));
  if (hrMax && pts.length >= 6) {
    const fit = linfit(pts);
    const hrs = pts.map((p) => p.x);
    const mHr = Math.min(Math.max(MARATHON_HR_FRAC * hrMax, Math.min(...hrs)), Math.max(...hrs)); // no wild extrapolation
    if (fit && fit.b > 0) {
      const speed = fit.a + fit.b * mHr;
      if (speed > 1.5) aerobicSec = MARATHON_M / speed;
    }
  }

  // 3. VO₂max ceiling — median of the window's readings.
  const v = win.map((r) => r.vo2).filter((x): x is number => x != null).sort((a, b) => a - b);
  const vo2max = v.length ? v[v.length >> 1] : null;
  const vo2Sec = vo2max ? vdotMarathon(vo2max) : null;

  const parts = [raceSec, aerobicSec].filter((x): x is number => x != null);
  const ensembleSec = raceSec != null && aerobicSec != null ? 0.6 * raceSec + 0.4 * aerobicSec : parts[0] ?? null;

  const r0 = (x: number | null) => (x == null ? null : Math.round(x));
  return {
    raceSec: r0(raceSec), raceFrom, aerobicSec: r0(aerobicSec), vo2Sec: r0(vo2Sec), vo2max,
    ensembleSec: r0(ensembleSec),
    lowSec: parts.length ? Math.round(Math.min(...parts)) : null,
    highSec: parts.length ? Math.round(Math.max(...parts)) : null,
  };
}

function weekStart(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<MarathonPayload>) {
  const emptySet: EstimateSet = { raceSec: null, raceFrom: null, aerobicSec: null, vo2Sec: null, vo2max: null, ensembleSec: null, lowSec: null, highSec: null };
  const empty: MarathonPayload = { current: emptySet, weekly: [], prs: [], weeklyMileage: [], longestRunKm: 0, recentWeeklyAvgKm: 0, hrMax: null };
  if (req.method !== 'GET') { res.status(405).end(); return; }

  try {
    const sel = 'sport_type, start_time, duration_seconds, distance_meters, avg_heart_rate, max_heart_rate, '
      + 'startTimeLocal:raw_data->>startTimeLocal, gap:raw_data->avgGradeAdjustedSpeed, vo2:raw_data->vO2MaxValue, '
      + [...PR_SPLITS].map((s) => `${s.key}:raw_data->${s.key}`).join(', ');
    const data = await selectWithRetry<Record<string, unknown>>(() =>
      getFitnessSupabase().from('activities').select(sel)
        .eq('source', 'garmin').order('start_time', { ascending: true }).limit(5000) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>,
    );

    const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
    const runs: Run[] = data
      .filter((a) => isGarminRun(a.sport_type as string) && a.start_time)
      .map((a) => {
        const day = String(a.startTimeLocal ?? a.start_time).slice(0, 10);
        const splits: Record<string, number> = {};
        for (const s of PR_SPLITS) { const v = num(a[s.key]); if (v) splits[s.key] = v; }
        return {
          t: Date.parse(day + 'T12:00:00Z'), day, dur: Number(a.duration_seconds) || 0,
          hr: num(a.avg_heart_rate), maxHr: num(a.max_heart_rate), gap: num(a.gap),
          km: (Number(a.distance_meters) || 0) / 1000, vo2: num(a.vo2), splits,
        };
      });

    const now = Date.now();
    const yearHr = runs.filter((r) => r.t > now - 365 * 864e5).map((r) => r.maxHr).filter((x): x is number => x != null && x < 230).sort((a, b) => b - a);
    const hrMax = yearHr.length >= 2 ? yearHr[1] : yearHr[0] ?? null;

    const current = estimate(runs, now, hrMax);

    // Weekly rolling estimates for the last 26 weeks (window end = Sunday 23:59).
    const weekly: MarathonPayload['weekly'] = [];
    const thisMonday = Date.parse(weekStart(new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
    for (let w = 25; w >= 0; w--) {
      const end = thisMonday - w * 7 * 864e5 + 7 * 864e5 - 1;
      const e = estimate(runs, Math.min(end, now), hrMax);
      weekly.push({ week: new Date(end).toISOString().slice(0, 10), ensembleSec: e.ensembleSec, vo2Sec: e.vo2Sec });
    }

    const prs = PR_SPLITS.map((s) => {
      let best: Run | null = null;
      for (const r of runs) if (r.splits[s.key] && (!best || r.splits[s.key] < best.splits[s.key])) best = r;
      return best ? { name: s.name, distanceM: s.m, seconds: Math.round(best.splits[s.key]), date: best.day } : null;
    }).filter((x): x is NonNullable<typeof x> => x != null);

    const byWeek = new Map<string, number>();
    for (const r of runs) byWeek.set(weekStart(r.day), (byWeek.get(weekStart(r.day)) ?? 0) + r.km);
    const weeklyMileage = Array.from(byWeek.entries()).map(([week, km]) => ({ week, km: Math.round(km) }))
      .sort((a, b) => a.week.localeCompare(b.week)).slice(-20);
    const recent8 = runs.filter((r) => r.t > now - 56 * 864e5);
    const longestRunKm = Math.round(Math.max(0, ...recent8.map((r) => r.km)) * 10) / 10;
    const last4 = weeklyMileage.slice(-4);
    const recentWeeklyAvgKm = last4.length ? Math.round(last4.reduce((s, w) => s + w.km, 0) / last4.length) : 0;

    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ current, weekly, prs, weeklyMileage, longestRunKm, recentWeeklyAvgKm, hrMax });
  } catch (err) {
    console.error('athlete-os marathon:', err);
    res.status(503).json(empty);
  }
}
