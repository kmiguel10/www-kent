import type { CorrelationMethod, LagDays, LagResult } from '@/lib/athlete-os/types';
import { LAG_OPTIONS } from '@/lib/athlete-os/types';

import { coefficient, lagAt } from './correlationEngine';

/**
 * Lag analysis — scans a fixed set of candidate lags (0/1/2/3/7/14 days) and
 * returns the lag that maximises |correlation|, with enough of a sample to be
 * meaningful. Answers questions like "sleep today vs run performance tomorrow".
 */

const MIN_PAIRS_FOR_LAG = 5;

export function scanLags(
  a: (number | null)[],
  b: (number | null)[],
  dates: string[],
  method: CorrelationMethod,
): LagResult[] {
  return LAG_OPTIONS.map((lag) => {
    const { correlation, pairs } = lagAt(a, b, dates, lag, method);
    return { lagDays: lag, correlation, sampleSize: pairs.length };
  });
}

/**
 * Pick the lag with the strongest absolute correlation, ignoring lags with too
 * few overlapping days. Falls back to lag 0 when nothing qualifies.
 */
export function bestLag(
  a: (number | null)[],
  b: (number | null)[],
  dates: string[],
  method: CorrelationMethod,
): { lagDays: LagDays; correlation: number; pairs: { x: number; y: number; date: string }[] } {
  let best = lagAt(a, b, dates, 0, method);
  let bestStrength = best.pairs.length >= MIN_PAIRS_FOR_LAG ? Math.abs(best.correlation) : -1;

  for (const lag of LAG_OPTIONS) {
    if (lag === 0) continue;
    const candidate = lagAt(a, b, dates, lag, method);
    if (candidate.pairs.length < MIN_PAIRS_FOR_LAG) continue;
    const strength = Math.abs(candidate.correlation);
    if (strength > bestStrength) {
      best = candidate;
      bestStrength = strength;
    }
  }
  return best;
}

/** Re-export for callers that only need the coefficient primitive. */
export { coefficient };
