import type { DailyMatrix, MetricKey } from '@/lib/athlete-os/types';

import { seriesOf, toScore0to100 } from '../correlation/normalization';

/**
 * Marathon readiness — a derived 0–100 index. There is no such metric in any
 * source, so this is an explicit composite built from real signals:
 *
 *   • Aerobic base   — 28-day running mileage volume (chronic load)
 *   • Freshness      — recovery / HRV relative to recent norm (acute readiness)
 *   • Consistency    — how regularly training happened over 28 days
 *   • Sleep quality  — 14-day sleep trend (adaptation substrate)
 *
 * It is a *relative* readiness signal for trend-watching, not a race-time
 * predictor. All weights and windows are documented here for transparency.
 */

const WEIGHTS = { base: 0.35, freshness: 0.3, consistency: 0.2, sleep: 0.15 };

function rollingMean(col: (number | null)[], i: number, window: number): number | null {
  const start = Math.max(0, i - window + 1);
  const slice = col.slice(start, i + 1).filter((v): v is number => v != null);
  return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
}

export function computeMarathonReadiness(matrix: DailyMatrix): (number | null)[] {
  const mileage = seriesOf(matrix, 'mileage');
  const recoveryScored = toScore0to100(seriesOf(matrix, 'recovery'), 'recovery');
  const hrvScored = toScore0to100(seriesOf(matrix, 'hrv'), 'hrv');
  const sleepScored = toScore0to100(seriesOf(matrix, 'sleepScore'), 'sleepScore');

  // Normalize 28-day mileage volume across the dataset for the base sub-score.
  const vol28: (number | null)[] = matrix.dates.map((_, i) => {
    const start = Math.max(0, i - 27);
    const slice = mileage.slice(start, i + 1).filter((v): v is number => v != null);
    return slice.length ? slice.reduce((a, b) => a + b, 0) : null;
  });
  const baseScored = toScore0to100(vol28, 'mileage'); // load dir → not flipped; more volume = more base

  return matrix.dates.map((_, i) => {
    const base = baseScored[i];
    const freshness = recoveryScored[i] ?? hrvScored[i];
    const sleep = rollingMean(sleepScored, i, 14);

    // Consistency: fraction of the last 28 days with any mileage.
    const start = Math.max(0, i - 27);
    const window = mileage.slice(start, i + 1);
    const activeDays = window.filter((v) => v != null && v > 0).length;
    const consistency = window.length ? (activeDays / Math.min(28, i + 1)) * 100 : null;

    const parts: { w: number; v: number }[] = [];
    if (base != null) parts.push({ w: WEIGHTS.base, v: base });
    if (freshness != null) parts.push({ w: WEIGHTS.freshness, v: freshness });
    if (consistency != null) parts.push({ w: WEIGHTS.consistency, v: consistency });
    if (sleep != null) parts.push({ w: WEIGHTS.sleep, v: sleep });

    if (parts.length === 0) return null;
    const wSum = parts.reduce((s, p) => s + p.w, 0);
    const val = parts.reduce((s, p) => s + p.v * p.w, 0) / wSum;
    return Math.round(Math.max(0, Math.min(100, val)));
  });
}
