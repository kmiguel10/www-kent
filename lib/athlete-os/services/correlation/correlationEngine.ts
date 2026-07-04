import type {
  Correlation,
  CorrelationMethod,
  DailyMatrix,
  LagDays,
  MetricKey,
  RollingWindow,
} from '@/lib/athlete-os/types';

import { pairwise, seriesOf, sliceWindow } from './normalization';
import { bestLag } from './lagAnalysis';
import { scoreConfidence } from './confidenceScoring';

/**
 * The correlation engine — pure statistics, no React, no data fetching.
 * Everything downstream (explorer, graph, insights) consumes its output.
 */

/** Pearson product-moment correlation of two equal-length numeric arrays. */
export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i];
    sxx += xs[i] * xs[i]; syy += ys[i] * ys[i];
    sxy += xs[i] * ys[i];
  }
  const cov = n * sxy - sx * sy;
  const denom = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (denom === 0) return 0;
  const r = cov / denom;
  // Guard against tiny floating-point overshoot beyond [-1, 1].
  return Math.max(-1, Math.min(1, r));
}

/** Convert values to fractional ranks (ties share the average rank). */
function rank(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based average rank across the tie group
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

/** Spearman rank correlation — robust to non-linear monotonic relationships. */
export function spearman(xs: number[], ys: number[]): number {
  if (xs.length < 2) return 0;
  return pearson(rank(xs), rank(ys));
}

export function coefficient(method: CorrelationMethod, xs: number[], ys: number[]): number {
  return method === 'spearman' ? spearman(xs, ys) : pearson(xs, ys);
}

/**
 * Full analysis for a metric pair: slice to the window, scan lags to find the
 * strongest relationship, then attach confidence and the paired points.
 *
 * `lagDays` is applied to `metricA` — i.e. metricA leads metricB by `lag` days,
 * answering "does A today predict B in `lag` days?".
 */
export function analyzePair(
  matrix: DailyMatrix,
  metricA: MetricKey,
  metricB: MetricKey,
  opts: { method?: CorrelationMethod; window?: RollingWindow; lag?: LagDays | 'auto' } = {},
): Correlation {
  const method = opts.method ?? 'pearson';
  const window = opts.window ?? 0;
  const windowed = sliceWindow(matrix, window);
  const a = seriesOf(windowed, metricA);
  const b = seriesOf(windowed, metricB);

  const chosen =
    opts.lag === undefined || opts.lag === 'auto'
      ? bestLag(a, b, windowed.dates, method)
      : lagAt(a, b, windowed.dates, opts.lag, method);

  const confidence = scoreConfidence(chosen.pairs.length, chosen.correlation, windowed.dates.length);

  return {
    metricA,
    metricB,
    method,
    correlation: chosen.correlation,
    lagDays: chosen.lagDays,
    window,
    sampleSize: chosen.pairs.length,
    confidence,
    pairs: chosen.pairs,
  };
}

/** Correlation at a fixed lag (metricA shifted forward by `lag` days). */
export function lagAt(
  a: (number | null)[],
  b: (number | null)[],
  dates: string[],
  lag: LagDays,
  method: CorrelationMethod,
): { lagDays: LagDays; correlation: number; pairs: { x: number; y: number; date: string }[] } {
  // Shift A so that A[i] aligns with B[i + lag].
  const shiftedA = lag === 0 ? a : a.slice(0, a.length - lag);
  const shiftedB = lag === 0 ? b : b.slice(lag);
  const shiftedDates = lag === 0 ? dates : dates.slice(lag);
  const pairs = pairwise(shiftedA, shiftedB, shiftedDates);
  const r = coefficient(method, pairs.map((p) => p.x), pairs.map((p) => p.y));
  return { lagDays: lag, correlation: r, pairs };
}
