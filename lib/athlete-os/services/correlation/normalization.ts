import type { DailyMatrix, MetricKey } from '@/lib/athlete-os/types';
import { METRICS } from '@/lib/athlete-os/metrics/registry';

/**
 * Normalization helpers. Kept pure so they can be unit-tested and reused by
 * both the correlation engine and the scoring services.
 */

/** Extract one metric's aligned value array from the matrix. */
export function seriesOf(matrix: DailyMatrix, key: MetricKey): (number | null)[] {
  return matrix.series[key] ?? matrix.dates.map(() => null);
}

/** Mean of the non-null values. */
export function mean(values: (number | null)[]): number {
  const v = values.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/** Population standard deviation of non-null values. */
export function stdDev(values: (number | null)[]): number {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
}

/**
 * Z-score normalization (mean 0, sd 1), preserving nulls. Sign is flipped for
 * `lowerBetter` metrics so that "more normalized" always means "better",
 * which keeps correlation/insight interpretation consistent.
 */
export function zScore(values: (number | null)[], key?: MetricKey): (number | null)[] {
  const m = mean(values);
  const sd = stdDev(values);
  const flip = key && METRICS[key].direction === 'lowerBetter' ? -1 : 1;
  if (sd === 0) return values.map((x) => (x == null ? null : 0));
  return values.map((x) => (x == null ? null : (flip * (x - m)) / sd));
}

/** Scale non-null values into 0–100, respecting metric direction. */
export function toScore0to100(values: (number | null)[], key: MetricKey): (number | null)[] {
  const v = values.filter((x): x is number => x != null);
  if (v.length === 0) return values.map(() => null);
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min;
  const lower = METRICS[key].direction === 'lowerBetter';
  return values.map((x) => {
    if (x == null) return null;
    if (span === 0) return 50;
    const pct = ((x - min) / span) * 100;
    return lower ? 100 - pct : pct;
  });
}

/** Pair up two aligned arrays, dropping indices where either is null. */
export function pairwise(
  a: (number | null)[],
  b: (number | null)[],
  dates: string[],
): { x: number; y: number; date: string }[] {
  const out: { x: number; y: number; date: string }[] = [];
  const n = Math.min(a.length, b.length, dates.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (x != null && y != null) out.push({ x, y, date: dates[i] });
  }
  return out;
}

/** Clamp a matrix to the most recent `window` days (0 = all). */
export function sliceWindow(matrix: DailyMatrix, window: number): DailyMatrix {
  if (!window || window <= 0 || window >= matrix.dates.length) return matrix;
  const start = matrix.dates.length - window;
  const series: DailyMatrix['series'] = {} as DailyMatrix['series'];
  for (const key of Object.keys(matrix.series) as MetricKey[]) {
    series[key] = matrix.series[key].slice(start);
  }
  return { dates: matrix.dates.slice(start), series, generatedAt: matrix.generatedAt };
}
