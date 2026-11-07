import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import type { AthleteOsPayload, DailyMatrix, MetricKey } from '@/lib/athlete-os/types';
import { ALL_METRIC_KEYS } from '@/lib/athlete-os/metrics/registry';
import { computeAthleteScores, latestScore } from '@/lib/athlete-os/services/scoring/athleteScore';
import { dailyTrainingLoad, type ActivityLoadInput } from '@/lib/athlete-os/services/scoring/trainingLoad';
import {
  type GarminActivityRow, activityDay, isGarminRun,
  runEfficiencies, rideEfficiencies, dailyEfficiency, dailyPerformance,
} from '@/lib/athlete-os/services/performance/garminPerformance';

/**
 * Athlete OS data adapter — one aligned daily matrix keyed by MetricKey.
 *
 * Sources (2026-11 revamp):
 *   • Sleep & recovery: WHOOP only (whoop_recovery, whoop_sleep, whoop_cycles).
 *   • Activities: Garmin only (activities where source = 'garmin').
 *   • Behaviors: derived from WHOOP sleep timing / cycles.
 *
 * Activities are dated by Garmin's LOCAL start time so an evening run lines up
 * with the right night's sleep (WHOOP dates sleep by wake day).
 */

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const shiftDay = (day: string, delta: number) =>
  new Date(Date.parse(day + 'T00:00:00Z') + delta * 864e5).toISOString().slice(0, 10);

/** Local bedtime in decimal hours; times before 3 pm roll past midnight (24.5 = 00:30). */
function localBedtime(startIso: string, offset: string | null): number | null {
  const t = Date.parse(startIso);
  if (!Number.isFinite(t)) return null;
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset ?? '+00:00');
  const offMin = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  const local = new Date(t + offMin * 60000);
  const h = local.getUTCHours() + local.getUTCMinutes() / 60;
  return h < 15 ? h + 24 : h;
}

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

    const [recRes, sleepRes, cycleRes, actRes] = await Promise.all([
      supabase.from('whoop_recovery').select('date, recovery_score, hrv_rmssd_milli, resting_heart_rate, spo2_percentage, skin_temp_celsius'),
      supabase.from('whoop_sleep').select(
        'date, nap, sleep_start, in_bed_minutes, awake_minutes, sleep_needed_minutes, sleep_performance_percentage, '
        + 'sleep_efficiency_percentage, sleep_consistency_percentage, respiratory_rate, rem_minutes, slow_wave_minutes, '
        + 'disturbance_count, tz:raw_data->>timezone_offset',
      ),
      supabase.from('whoop_cycles').select('date, strain, steps:raw_data->step_count'),
      // Garmin only. Small fields + specific raw_data keys (never the whole
      // blob — it can be megabytes/row and time the function out).
      supabase.from('activities').select(
        'sport_type, start_time, duration_seconds, distance_meters, avg_heart_rate, max_heart_rate, '
        + 'avg_speed_meters_per_second, weighted_avg_watts, startTimeLocal:raw_data->>startTimeLocal, '
        + 'gap:raw_data->avgGradeAdjustedSpeed, vo2:raw_data->vO2MaxValue, load:raw_data->activityTrainingLoad, '
        + 'z1:raw_data->hrTimeInZone_1, z2:raw_data->hrTimeInZone_2, z3:raw_data->hrTimeInZone_3, '
        + 'z4:raw_data->hrTimeInZone_4, z5:raw_data->hrTimeInZone_5',
      ).eq('source', 'garmin').order('start_time', { ascending: true }).limit(5000),
    ]);
    for (const r of [recRes, sleepRes, cycleRes, actRes]) if (r.error) throw r.error;

    const maps = Object.fromEntries(ALL_METRIC_KEYS.map((k) => [k, new Map<string, number>()])) as Record<MetricKey, Map<string, number>>;
    const set = (key: MetricKey, date: string, value: number | null | undefined) => {
      if (value == null || Number.isNaN(value)) return;
      maps[key].set(date, value);
    };

    // ── WHOOP recovery ──────────────────────────────────────────────────────
    for (const r of recRes.data ?? []) {
      set('recovery', r.date, r.recovery_score);
      set('hrv', r.date, r.hrv_rmssd_milli);
      set('restingHr', r.date, r.resting_heart_rate);
      set('spo2', r.date, r.spo2_percentage);
      set('skinTemp', r.date, r.skin_temp_celsius);
    }

    // ── WHOOP sleep (main sleep per wake-day = the longest non-nap) ─────────
    type SleepRow = { date: string; nap: boolean; sleep_start: string; in_bed_minutes: number | null; awake_minutes: number | null;
      sleep_needed_minutes: number | null; sleep_performance_percentage: number | null; sleep_efficiency_percentage: number | null;
      sleep_consistency_percentage: number | null; respiratory_rate: number | null; rem_minutes: number | null;
      slow_wave_minutes: number | null; disturbance_count: number | null; tz: string | null };
    const mainSleep = new Map<string, SleepRow>();
    for (const s of (sleepRes.data ?? []) as unknown as SleepRow[]) {
      if (s.nap || !s.date) continue;
      const cur = mainSleep.get(s.date);
      if (!cur || (s.in_bed_minutes ?? 0) > (cur.in_bed_minutes ?? 0)) mainSleep.set(s.date, s);
    }
    const bedtimes: { date: string; h: number }[] = [];
    mainSleep.forEach((s, d) => {
      const asleep = s.in_bed_minutes != null ? s.in_bed_minutes - (s.awake_minutes ?? 0) : null;
      set('sleepDuration', d, asleep);
      set('sleepPerformance', d, s.sleep_performance_percentage);
      set('sleepEfficiency', d, s.sleep_efficiency_percentage);
      set('sleepConsistency', d, s.sleep_consistency_percentage);
      set('respiratoryRate', d, s.respiratory_rate);
      set('remMinutes', d, s.rem_minutes);
      set('deepMinutes', d, s.slow_wave_minutes);
      set('disturbances', d, s.disturbance_count);
      set('timeInBed', d, s.in_bed_minutes);
      if (asleep != null && s.sleep_needed_minutes != null) set('sleepDebt', d, s.sleep_needed_minutes - asleep);
      const bt = localBedtime(s.sleep_start, s.tz);
      if (bt != null) { set('bedtime', d, bt); bedtimes.push({ date: d, h: bt }); }
    });

    // Behaviors: bedtime irregularity vs trailing 14-night median; 3-night debt.
    bedtimes.sort((a, b) => a.date.localeCompare(b.date));
    bedtimes.forEach((b, i) => {
      const prior = bedtimes.slice(Math.max(0, i - 14), i).map((x) => x.h);
      if (prior.length >= 5) set('bedtimeShift', b.date, Math.abs(b.h - median(prior)));
    });
    maps.sleepDebt.forEach((_, d) => {
      const vals = [0, -1, -2].map((k) => maps.sleepDebt.get(shiftDay(d, k)));
      if (vals.every((v) => v != null)) set('sleepDebt3d', d, (vals as number[]).reduce((a, b) => a + b, 0));
    });

    // ── WHOOP cycles ────────────────────────────────────────────────────────
    for (const c of (cycleRes.data ?? []) as { date: string; strain: number | null; steps: unknown }[]) {
      set('strain', c.date, c.strain);
      const st = num(c.steps);
      if (st != null && st > 0) set('steps', c.date, st);
    }

    // ── Garmin activities ───────────────────────────────────────────────────
    const acts = (actRes.data ?? []) as unknown as GarminActivityRow[];
    const loadInputs: ActivityLoadInput[] = [];
    const zoneByDay = new Map<string, { easy: number; grey: number; hard: number }>();
    for (const a of acts) {
      if (!a.start_time) continue;
      const day = activityDay(a);
      if (isGarminRun(a.sport_type) && a.distance_meters) {
        set('mileage', day, (maps.mileage.get(day) ?? 0) + a.distance_meters / 1000);
      }
      const z = [a.z1, a.z2, a.z3, a.z4, a.z5].map((v) => num(v) ?? 0);
      if (z.reduce((s, v) => s + v, 0) > 0) {
        const g = zoneByDay.get(day) ?? { easy: 0, grey: 0, hard: 0 };
        g.easy += z[0] + z[1]; g.grey += z[2]; g.hard += z[3] + z[4];
        zoneByDay.set(day, g);
      }
      const vo2 = num(a.vo2);
      if (vo2 != null && vo2 > 0 && isGarminRun(a.sport_type)) set('vo2max', day, vo2);
      // Garmin's own activityTrainingLoad (falls back to an HR-weighted proxy).
      loadInputs.push({
        date: day, sufferScore: num(a.load),
        durationSeconds: a.duration_seconds, avgHeartRate: a.avg_heart_rate, maxHeartRate: a.max_heart_rate,
      });
    }
    zoneByDay.forEach((v, d) => {
      const total = v.easy + v.grey + v.hard;
      if (total > 0) {
        set('aerobicPct', d, (v.easy / total) * 100);
        set('greyZonePct', d, (v.grey / total) * 100);
      }
    });
    dailyTrainingLoad(loadInputs).forEach((v, d) => set('trainingLoad', d, v));

    const runEff = runEfficiencies(acts);
    const rideEff = rideEfficiencies(acts);
    dailyEfficiency(runEff).forEach((v, d) => set('runEfficiency', d, v));
    dailyEfficiency(rideEff).forEach((v, d) => set('rideEfficiency', d, v));
    dailyPerformance(runEff).forEach((v, d) => set('runPerf', d, v));
    dailyPerformance(rideEff).forEach((v, d) => set('ridePerf', d, v));

    // ── Aligned matrix ──────────────────────────────────────────────────────
    const dateSet = new Set<string>();
    for (const k of ALL_METRIC_KEYS) maps[k].forEach((_, d) => dateSet.add(d));
    const dates = Array.from(dateSet).sort();
    if (dates.length === 0) {
      res.status(200).json(empty);
      return;
    }

    const series = {} as DailyMatrix['series'];
    for (const k of ALL_METRIC_KEYS) series[k] = dates.map((d) => maps[k].get(d) ?? null);

    const matrix: DailyMatrix = { dates, series, generatedAt: new Date().toISOString() };
    const scores = computeAthleteScores(matrix);
    const today = latestScore(scores);

    const coverage = ALL_METRIC_KEYS.map((metric) => {
      const present = dates.filter((_, i) => series[metric][i] != null);
      return { metric, days: present.length, firstDate: present[0] ?? null, lastDate: present[present.length - 1] ?? null };
    });

    res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ matrix, scores, today, coverage });
  } catch (err) {
    // 503 (not 200-empty) so the client retries instead of blanking the dashboard.
    console.error('athlete-os metrics:', err);
    res.status(503).json(empty);
  }
}
