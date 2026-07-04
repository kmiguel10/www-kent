import type { Confidence } from '@/lib/athlete-os/types';

/**
 * Confidence scoring — turns raw sample size + coefficient into a trustworthy
 * label. A strong-looking r on 6 data points is not the same as a moderate r
 * on 90, and the UI must communicate that difference.
 */

export function strengthBucket(r: number): Confidence['strength'] {
  const a = Math.abs(r);
  if (a >= 0.6) return 'strong';
  if (a >= 0.4) return 'moderate';
  if (a >= 0.2) return 'weak';
  return 'negligible';
}

/**
 * Two-tailed significance heuristic. Rather than pull in a full t-distribution,
 * we approximate the r needed for significance at a given n (roughly p<0.05):
 * r_crit ≈ 2 / sqrt(n). Combined with sample size this gives a robust,
 * explainable confidence tier.
 */
function isSignificant(r: number, n: number): boolean {
  if (n < 4) return false;
  const rCrit = 2 / Math.sqrt(n);
  return Math.abs(r) >= rCrit;
}

export function scoreConfidence(sampleSize: number, correlation: number, windowDays: number): Confidence {
  const completeness = windowDays > 0 ? Math.min(1, sampleSize / windowDays) : sampleSize > 0 ? 1 : 0;
  const strength = strengthBucket(correlation);

  let level: Confidence['level'];
  if (sampleSize < 8) {
    level = 'insufficient';
  } else if (sampleSize >= 30 && isSignificant(correlation, sampleSize) && strength !== 'negligible') {
    level = 'high';
  } else if (sampleSize >= 14 && isSignificant(correlation, sampleSize)) {
    level = 'moderate';
  } else {
    level = 'low';
  }

  return { level, sampleSize, completeness, strength };
}
