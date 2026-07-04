import type {
  AthleteScore,
  DailyMatrix,
  MetricKey,
  ScoreContributor,
} from '@/lib/athlete-os/types';
import { METRICS } from '@/lib/athlete-os/metrics/registry';

import { seriesOf, toScore0to100 } from '../correlation/normalization';
import { computeMarathonReadiness } from './marathonReadiness';

/**
 * Athlete Score — a documented composite of the real recovery/sleep/load
 * signals, expressed 0–100. Each input is first mapped to its own 0–100
 * sub-score (respecting metric direction), then combined with fixed weights.
 * The `contributors` array captures each factor's signed contribution so the
 * Athlete Orb can explain *why* today's score is what it is.
 */

// Weights sum to 1 across whichever inputs are present on a given day.
const WEIGHTS: Partial<Record<MetricKey, number>> = {
  recovery: 0.28,
  hrv: 0.16,
  sleepScore: 0.16,
  sleepPerformance: 0.12,
  trainingReadiness: 0.14,
  bodyBattery: 0.08,
  restingHr: 0.06,
};

// Load acts as a penalty when elevated (accumulated fatigue).
const FATIGUE_METRICS: MetricKey[] = ['strain', 'trainingLoad'];

export function bandFor(score: number): string {
  if (score >= 80) return 'Primed';
  if (score >= 65) return 'Balanced';
  if (score >= 50) return 'Moderate';
  if (score >= 35) return 'Compromised';
  return 'Depleted';
}

/**
 * Build a 0–100 sub-score column for each metric across the whole matrix, so
 * per-day scoring is just an index lookup.
 */
function scoredColumns(matrix: DailyMatrix): Record<MetricKey, (number | null)[]> {
  const cols = {} as Record<MetricKey, (number | null)[]>;
  for (const key of Object.keys(matrix.series) as MetricKey[]) {
    cols[key] = toScore0to100(seriesOf(matrix, key), key);
  }
  return cols;
}

export function computeAthleteScores(matrix: DailyMatrix): AthleteScore[] {
  const cols = scoredColumns(matrix);
  const marathon = computeMarathonReadiness(matrix);

  return matrix.dates.map((date, i) => {
    const contributors: ScoreContributor[] = [];

    // Weighted average over present inputs (re-normalize weights to what exists).
    let weighted = 0;
    let weightSum = 0;
    for (const [key, w] of Object.entries(WEIGHTS) as [MetricKey, number][]) {
      const sub = cols[key]?.[i];
      if (sub != null) {
        weighted += sub * w;
        weightSum += w;
      }
    }
    let base = weightSum > 0 ? weighted / weightSum : NaN;

    // Fatigue penalty: elevated load pulls the score down a few points.
    let fatiguePenalty = 0;
    for (const key of FATIGUE_METRICS) {
      const raw = seriesOf(matrix, key)[i];
      const col = cols[key]?.[i]; // toScore0to100 already flips load? No — load is neutral dir.
      if (raw != null && col != null) {
        // High load (col near 100) → up to −8 points.
        const pen = ((col - 50) / 50) * 4;
        if (pen > 0) fatiguePenalty += pen;
      }
    }

    if (Number.isNaN(base)) {
      return {
        score: 0, date, recovery: null, sleepQuality: null, trainingReadiness: null,
        marathonReadiness: marathon[i] ?? null, contributors: [], band: 'No data',
      };
    }

    const score = Math.max(0, Math.min(100, base - fatiguePenalty));

    // Contributors: each factor's deviation from a neutral 50, scaled by weight.
    for (const [key, w] of Object.entries(WEIGHTS) as [MetricKey, number][]) {
      const sub = cols[key]?.[i];
      if (sub != null && weightSum > 0) {
        const delta = ((sub - 50) * (w / weightSum));
        if (Math.abs(delta) >= 0.5) {
          contributors.push({ metric: key, label: METRICS[key].label, delta: Math.round(delta) });
        }
      }
    }
    if (fatiguePenalty >= 0.5) {
      contributors.push({ metric: 'trainingLoad', label: 'Fatigue', delta: -Math.round(fatiguePenalty) });
    }
    contributors.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const recovery = cols.recovery?.[i] ?? cols.trainingReadiness?.[i] ?? null;
    const sleepQuality = cols.sleepScore?.[i] ?? cols.sleepPerformance?.[i] ?? null;
    const trainingReadiness = cols.trainingReadiness?.[i] ?? null;

    return {
      score,
      date,
      recovery: recovery != null ? Math.round(recovery) : null,
      sleepQuality: sleepQuality != null ? Math.round(sleepQuality) : null,
      trainingReadiness: trainingReadiness != null ? Math.round(trainingReadiness) : null,
      marathonReadiness: marathon[i] ?? null,
      contributors: contributors.slice(0, 6),
      band: bandFor(score),
    };
  });
}

/** The most recent day that actually has a score. */
export function latestScore(scores: AthleteScore[]): AthleteScore | null {
  for (let i = scores.length - 1; i >= 0; i--) {
    if (scores[i].band !== 'No data') return scores[i];
  }
  return null;
}
