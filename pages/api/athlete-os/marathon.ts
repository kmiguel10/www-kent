import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import { selectWithRetry } from '@/lib/athlete-os/services/fitnessQuery';

/**
 * Marathon-goal inputs: best efforts (PRs), a monthly predicted-marathon trend
 * (Riegel), weekly mileage, and recent longest run. Read-only; isolated.
 */

export interface RaceEffort { distanceM: number; seconds: number; date: string; }
export interface MarathonPayload {
  prs: { name: string; distanceM: number; seconds: number; date: string }[];
  predictionTrend: { month: string; predictedSec: number }[];
  weeklyMileage: { week: string; km: number }[];
  longestRunKm: number;
  recentWeeklyAvgKm: number;
  /** Distance name of the effort behind the headline (rolling-window) prediction. */
  latestPredictionFrom: string | null;
  /** Headline prediction: best qualifying effort in the trailing ~8 weeks. */
  currentPredictedSec: number | null;
  currentPredictionFrom: string | null;
}

const isRun = (t: string | null) => /run|treadmill/i.test(t ?? '');
const riegel = (sec: number, distM: number) => sec * Math.pow(42195 / distM, 1.06);

// Monday of the ISO week for a date.
function weekStart(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<MarathonPayload>) {
  const empty: MarathonPayload = { prs: [], predictionTrend: [], weeklyMileage: [], longestRunKm: 0, recentWeeklyAvgKm: 0, latestPredictionFrom: null, currentPredictedSec: null, currentPredictionFrom: null };
  if (req.method !== 'GET') { res.status(405).end(); return; }

  try {
    const data = await selectWithRetry(() =>
      getFitnessSupabase()
        .from('activities')
        .select('sport_type, start_time, distance_meters, raw_data')
        .order('start_time', { ascending: true })
        .limit(3000),
    );

    const runs = (data ?? []).filter((a) => isRun(a.sport_type) && a.start_time);

    // Best efforts (PRs) per standard distance, plus every qualifying (≥3 km)
    // effort's Riegel-projected marathon time with its day — the raw material for
    // a rolling-window prediction.
    const prByName = new Map<string, { distanceM: number; seconds: number; date: string }>();
    const qualifying: { dayMs: number; pred: number; name: string }[] = [];

    for (const r of runs) {
      const day = r.start_time.slice(0, 10);
      const dayMs = new Date(r.start_time).getTime();
      const efforts = (r.raw_data?.best_efforts ?? []) as { name: string; distance: number; moving_time?: number; elapsed_time?: number }[];
      for (const e of efforts) {
        const sec = e.moving_time ?? e.elapsed_time;
        if (!sec || !e.distance) continue;
        const cur = prByName.get(e.name);
        if (!cur || sec < cur.seconds) prByName.set(e.name, { distanceM: e.distance, seconds: sec, date: day });
        // Prediction from efforts ≥ 3 km (5k+) only — short sprints mispredict.
        if (e.distance >= 3000) qualifying.push({ dayMs, pred: riegel(sec, e.distance), name: e.name });
      }
    }

    const STD = ['1 mile', '2 mile', '5k', '10k', '15k', '10 mile', '20k', 'Half-Marathon', 'Marathon'];
    const prs = STD.filter((n) => prByName.has(n)).map((n) => ({ name: n, ...prByName.get(n)! }));

    // Rolling ~8-week window: the prediction reflects the best qualifying effort in
    // the trailing 56 days — NOT just the current calendar month. This stops a
    // stretch of easy-only running (e.g. early in a new month) from suddenly
    // cratering the number, while still tracking recent fitness rather than a
    // stale months-old PR. Applied per month-end so the trend chart stays coherent
    // with the headline.
    const WINDOW_MS = 56 * 864e5;
    const bestInWindow = (endMs: number): { pred: number; name: string } | null => {
      let best: { pred: number; name: string } | null = null;
      for (const q of qualifying) {
        if (q.dayMs > endMs - WINDOW_MS && q.dayMs <= endMs && (!best || q.pred < best.pred)) best = { pred: q.pred, name: q.name };
      }
      return best;
    };
    const monthEndMs = (m: string) => { const [y, mo] = m.split('-').map(Number); return Date.UTC(y, mo, 1) - 1; };

    const monthsWithRuns = Array.from(new Set(runs.map((r) => r.start_time.slice(0, 7)))).sort();
    const trendAll = monthsWithRuns
      .map((month) => { const b = bestInWindow(monthEndMs(month)); return b ? { month, predictedSec: Math.round(b.pred), name: b.name } : null; })
      .filter((x): x is { month: string; predictedSec: number; name: string } => x != null);
    const predictionTrend = trendAll.slice(-12).map(({ month, predictedSec }) => ({ month, predictedSec }));

    // Headline current prediction: best effort in the trailing window ending today.
    const currentBest = bestInWindow(Date.now());
    const currentPredictedSec = currentBest ? Math.round(currentBest.pred) : null;
    const currentPredictionFrom = currentBest ? currentBest.name : null;
    const latestPredictionFrom = currentPredictionFrom ?? (trendAll.length ? trendAll[trendAll.length - 1].name : null);

    // Weekly mileage (last 20 weeks).
    const byWeek = new Map<string, number>();
    for (const r of runs) {
      if (!r.distance_meters) continue;
      const w = weekStart(r.start_time.slice(0, 10));
      byWeek.set(w, (byWeek.get(w) ?? 0) + r.distance_meters / 1000);
    }
    const weeklyMileage = Array.from(byWeek.entries())
      .map(([week, km]) => ({ week, km: Math.round(km) }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-20);

    // Longest run + 4-week avg over the recent stretch.
    const now = Date.now();
    const recent = runs.filter((r) => (now - new Date(r.start_time).getTime()) / 6.048e8 < 8);
    const longestRunKm = Math.round(Math.max(0, ...recent.map((r) => (r.distance_meters ?? 0) / 1000)) * 10) / 10;
    const last4 = weeklyMileage.slice(-4);
    const recentWeeklyAvgKm = last4.length ? Math.round(last4.reduce((s, w) => s + w.km, 0) / last4.length) : 0;

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ prs, predictionTrend, weeklyMileage, longestRunKm, recentWeeklyAvgKm, latestPredictionFrom, currentPredictedSec, currentPredictionFrom });
  } catch (err) {
    // 503 (not 200-empty) so the client retries instead of blanking the panel.
    console.error('athlete-os marathon:', err);
    res.status(503).json(empty);
  }
}
