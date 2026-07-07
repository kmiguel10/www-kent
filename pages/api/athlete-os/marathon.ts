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
  /** Distance name of the effort behind the most recent month's prediction. */
  latestPredictionFrom: string | null;
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
  const empty: MarathonPayload = { prs: [], predictionTrend: [], weeklyMileage: [], longestRunKm: 0, recentWeeklyAvgKm: 0, latestPredictionFrom: null };
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

    // Best efforts (PRs) per standard distance + monthly best predicted marathon.
    const prByName = new Map<string, { distanceM: number; seconds: number; date: string }>();
    const monthBest = new Map<string, { pred: number; name: string }>(); // YYYY-MM → best predicted + source

    for (const r of runs) {
      const day = r.start_time.slice(0, 10);
      const month = day.slice(0, 7);
      const efforts = (r.raw_data?.best_efforts ?? []) as { name: string; distance: number; moving_time?: number; elapsed_time?: number }[];
      for (const e of efforts) {
        const sec = e.moving_time ?? e.elapsed_time;
        if (!sec || !e.distance) continue;
        const cur = prByName.get(e.name);
        if (!cur || sec < cur.seconds) prByName.set(e.name, { distanceM: e.distance, seconds: sec, date: day });
        // Prediction from efforts ≥ 3 km (5k+) only — short sprints mispredict.
        if (e.distance >= 3000) {
          const pred = riegel(sec, e.distance);
          const m = monthBest.get(month);
          if (m == null || pred < m.pred) monthBest.set(month, { pred, name: e.name });
        }
      }
    }

    const STD = ['1 mile', '2 mile', '5k', '10k', '15k', '10 mile', '20k', 'Half-Marathon', 'Marathon'];
    const prs = STD.filter((n) => prByName.has(n)).map((n) => ({ name: n, ...prByName.get(n)! }));

    const trendAll = Array.from(monthBest.entries())
      .map(([month, v]) => ({ month, predictedSec: Math.round(v.pred), name: v.name }))
      .sort((a, b) => a.month.localeCompare(b.month));
    const predictionTrend = trendAll.slice(-12).map(({ month, predictedSec }) => ({ month, predictedSec }));
    const latestPredictionFrom = trendAll.length ? trendAll[trendAll.length - 1].name : null;

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
    res.status(200).json({ prs, predictionTrend, weeklyMileage, longestRunKm, recentWeeklyAvgKm, latestPredictionFrom });
  } catch (err) {
    // 503 (not 200-empty) so the client retries instead of blanking the panel.
    console.error('athlete-os marathon:', err);
    res.status(503).json(empty);
  }
}
