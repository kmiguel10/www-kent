import type { DailyMatrix, MetricKey } from '@/lib/athlete-os/types';
import { METRICS, DRIVER_METRICS, PERFORMANCE_TARGETS } from '@/lib/athlete-os/metrics/registry';

/**
 * Performance drivers — which WHOOP sleep / recovery / behavior signals move
 * your Garmin training performance.
 *
 * Targets are runPerf / ridePerf: session output vs what your own recent
 * output-vs-HR curve predicts at that session's HR — intensity-controlled, so
 * workout days don't masquerade as "good days". For each (driver, target):
 *   • pair the driver on day D (WHOOP dates by wake day → that morning's sleep
 *     & recovery) with performance on day D; load drivers use day D−1;
 *   • Spearman ρ + an approximate p-value (Fisher z, Spearman-adjusted);
 *   • tercile split → mean performance on your best-third vs worst-third days,
 *     in percentage points — the human-readable effect size.
 * Small samples are reported with an honest confidence label, not hidden.
 */

export type Confidence = 'high' | 'moderate' | 'low';

export interface DriverEffect {
  driver: MetricKey;
  target: MetricKey;
  /** Days the driver precedes the target (1 = yesterday's load). */
  lag: 0 | 1;
  n: number;
  rho: number;
  p: number;
  /** Driver threshold bounding the bottom third (≤) and top third (≥). */
  lowMax: number;
  highMin: number;
  /** Mean target (%) on bottom-third and top-third driver days. */
  lowMean: number;
  highMean: number;
  /** highMean − lowMean, in percentage points. */
  spread: number;
  /** Spread oriented so positive = the healthy side of the driver helps. Null for neutral/load drivers. */
  favorable: number | null;
  confidence: Confidence;
}

// Daytime signals happen AFTER the morning's WHOOP scores → use the previous day.
const LOAD_LAG: Partial<Record<MetricKey, 1>> = { strain: 1, trainingLoad: 1, steps: 1 };
const MIN_N = 10;

function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// Standard normal CDF via Abramowitz–Stegun erf.
function phi(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

function spearmanP(rho: number, n: number): number {
  if (n < 4) return 1;
  const r = Math.max(-0.9999, Math.min(0.9999, rho));
  const z = Math.atanh(r) * Math.sqrt((n - 3) / 1.06);
  return 2 * (1 - phi(Math.abs(z)));
}

const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;

export function computeDrivers(
  matrix: DailyMatrix,
  targets: MetricKey[] = PERFORMANCE_TARGETS,
  drivers: MetricKey[] = DRIVER_METRICS,
): DriverEffect[] {
  const out: DriverEffect[] = [];
  const n = matrix.dates.length;

  for (const target of targets) {
    const tSeries = matrix.series[target];
    if (!tSeries) continue;
    for (const driver of drivers) {
      const dSeries = matrix.series[driver];
      if (!dSeries) continue;
      const lag = LOAD_LAG[driver] ?? 0;

      const pairs: { d: number; t: number }[] = [];
      for (let i = lag; i < n; i++) {
        const t = tSeries[i], d = dSeries[i - lag];
        if (t != null && d != null) pairs.push({ d, t });
      }
      if (pairs.length < MIN_N) continue;

      const dv = pairs.map((p) => p.d), tv = pairs.map((p) => p.t);
      const rho = pearson(ranks(dv), ranks(tv));
      const p = spearmanP(rho, pairs.length);

      const sorted = [...pairs].sort((a, b) => a.d - b.d);
      const k = Math.max(3, Math.floor(sorted.length / 3));
      const low = sorted.slice(0, k), high = sorted.slice(-k);
      const lowMean = mean(low.map((x) => x.t)), highMean = mean(high.map((x) => x.t));
      const spread = highMean - lowMean;

      const dir = METRICS[driver].direction;
      const favorable = dir === 'higherBetter' ? spread : dir === 'lowerBetter' ? -spread : null;
      const confidence: Confidence = pairs.length >= 20 && p < 0.05 ? 'high' : p < 0.15 && pairs.length >= 12 ? 'moderate' : 'low';

      out.push({
        driver, target, lag, n: pairs.length, rho, p,
        lowMax: low[low.length - 1].d, highMin: high[0].d,
        lowMean, highMean, spread, favorable, confidence,
      });
    }
  }

  // Strongest, most trustworthy first.
  const rank = { high: 0, moderate: 1, low: 2 } as const;
  return out.sort((a, b) => rank[a.confidence] - rank[b.confidence] || Math.abs(b.spread) - Math.abs(a.spread));
}

/** Where today's value falls for a driver: 'low' / 'mid' / 'high' tercile. */
export function tercileOf(effect: DriverEffect, value: number): 'low' | 'mid' | 'high' {
  if (value <= effect.lowMax) return 'low';
  if (value >= effect.highMin) return 'high';
  return 'mid';
}
