import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import type { AthleteOsPayload, DailyMatrix, MetricKey } from '@/lib/athlete-os/types';
import { ALL_METRIC_KEYS } from '@/lib/athlete-os/metrics/registry';
import { computeAthleteScores, latestScore } from '@/lib/athlete-os/services/scoring/athleteScore';
import { dailyTrainingLoad, type ActivityLoadInput } from '@/lib/athlete-os/services/scoring/trainingLoad';

/**
 * Athlete OS data adapter.
 *
 * Reads the same Supabase tables the /fitness dashboard uses — strictly
 * read-only, via new SELECTs — and normalizes everything to one aligned daily
 * matrix keyed by MetricKey. Derived metrics (training load, athlete score,
 * marathon readiness) are computed here so the client just renders.
 *
 * This route does NOT touch or import any existing /fitness code paths beyond
 * the shared Supabase client factory.
 */

const localDay = (iso: string): string => iso.slice(0, 10);

export default async function handler(req: NextApiRequest, res: NextApiResponse<AthleteOsPayload>) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const empty: AthleteOsPayload = {
    matrix: { dates: [], series: {} as DailyMatrix['series'], generatedAt: new Date().toISOString() },
    scores: [], today: null, coverage: [],
  };

  try {
    const supabase = getFitnessSupabase();

    const [sleepRes, recoveryRes, whoopRecRes, whoopSleepRes, whoopCycleRes, activitiesRes] = await Promise.all([
      supabase.from('sleep_records').select('date, duration_minutes, sleep_score, rem_minutes, deep_minutes'),
      supabase.from('recovery_records').select('date, resting_hr, hrv, body_battery_high, stress_avg, training_readiness'),
      supabase.from('whoop_recovery').select('date, recovery_score, hrv_rmssd_milli, resting_heart_rate'),
      supabase.from('whoop_sleep').select('date, nap, sleep_performance_percentage, rem_minutes, slow_wave_minutes'),
      supabase.from('whoop_cycles').select('date, strain'),
      supabase.from('activities').select('source, sport_type, start_time, distance_meters, duration_seconds, avg_heart_rate, max_heart_rate, avg_pace_seconds_per_km, raw_data'),
    ]);

    // Per-metric maps of date → value. WHOOP is preferred where it overlaps
    // Garmin (recovery, HRV, RHR) since it's the dedicated recovery device.
    const maps: Record<MetricKey, Map<string, number>> = Object.fromEntries(
      ALL_METRIC_KEYS.map((k) => [k, new Map<string, number>()]),
    ) as Record<MetricKey, Map<string, number>>;

    const set = (key: MetricKey, date: string, value: number | null | undefined) => {
      if (value == null || Number.isNaN(value)) return;
      maps[key].set(date, value);
    };

    for (const r of recoveryRes.data ?? []) {
      set('restingHr', r.date, r.resting_hr);
      set('hrv', r.date, r.hrv);
      set('bodyBattery', r.date, r.body_battery_high);
      set('stress', r.date, r.stress_avg);
      set('trainingReadiness', r.date, r.training_readiness);
    }
    for (const s of sleepRes.data ?? []) {
      set('sleepScore', s.date, s.sleep_score);
      set('sleepDuration', s.date, s.duration_minutes);
    }
    for (const wr of whoopRecRes.data ?? []) {
      set('recovery', wr.date, wr.recovery_score);
      set('hrv', wr.date, wr.hrv_rmssd_milli);         // WHOOP overrides Garmin HRV
      set('restingHr', wr.date, wr.resting_heart_rate); // WHOOP overrides Garmin RHR
    }
    for (const ws of whoopSleepRes.data ?? []) {
      if (ws.nap) continue;
      set('sleepPerformance', ws.date, ws.sleep_performance_percentage);
      set('remMinutes', ws.date, ws.rem_minutes);
      set('deepMinutes', ws.date, ws.slow_wave_minutes);
    }
    for (const wc of whoopCycleRes.data ?? []) {
      set('strain', wc.date, wc.strain);
    }

    // Activities → daily mileage, run pace, and the training-load proxy.
    const loadInputs: ActivityLoadInput[] = [];
    const mileageByDay = new Map<string, number>();
    const paceAgg = new Map<string, { sum: number; n: number }>();
    for (const a of activitiesRes.data ?? []) {
      if (!a.start_time) continue;
      const day = localDay(a.start_time);
      const isRun = /run|running|treadmill/i.test(a.sport_type ?? '');
      if (a.distance_meters && isRun) {
        mileageByDay.set(day, (mileageByDay.get(day) ?? 0) + a.distance_meters / 1000);
      }
      if (isRun && a.avg_pace_seconds_per_km) {
        const agg = paceAgg.get(day) ?? { sum: 0, n: 0 };
        agg.sum += a.avg_pace_seconds_per_km; agg.n += 1;
        paceAgg.set(day, agg);
      }
      const suffer = (a.raw_data && (a.raw_data.suffer_score ?? a.raw_data.sufferScore)) ?? null;
      loadInputs.push({
        date: day,
        sufferScore: typeof suffer === 'number' ? suffer : null,
        durationSeconds: a.duration_seconds ?? null,
        avgHeartRate: a.avg_heart_rate ?? null,
        maxHeartRate: a.max_heart_rate ?? null,
      });
    }
    mileageByDay.forEach((v, d) => set('mileage', d, v));
    paceAgg.forEach((v, d) => set('runPace', d, v.sum / v.n));
    dailyTrainingLoad(loadInputs).forEach((v, d) => set('trainingLoad', d, v));

    // Build the aligned date axis across everything we collected.
    const dateSet = new Set<string>();
    for (const k of ALL_METRIC_KEYS) maps[k].forEach((_, d) => dateSet.add(d));
    const dates = Array.from(dateSet).sort();

    if (dates.length === 0) {
      res.status(200).json(empty);
      return;
    }

    const series = {} as DailyMatrix['series'];
    for (const k of ALL_METRIC_KEYS) {
      const m = maps[k];
      series[k] = dates.map((d) => (m.has(d) ? m.get(d)! : null));
    }

    const matrix: DailyMatrix = { dates, series, generatedAt: new Date().toISOString() };
    const scores = computeAthleteScores(matrix);
    const today = latestScore(scores);

    const coverage = ALL_METRIC_KEYS.map((metric) => {
      const present = dates.filter((_, i) => series[metric][i] != null);
      return {
        metric,
        days: present.length,
        firstDate: present[0] ?? null,
        lastDate: present[present.length - 1] ?? null,
      };
    });

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ matrix, scores, today, coverage });
  } catch (err) {
    console.error('athlete-os metrics:', err);
    res.status(200).json(empty);
  }
}
