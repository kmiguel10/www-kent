import type {
  AthleteScore,
  Correlation,
  DailyMatrix,
  Insight,
  MetricKey,
} from '@/lib/athlete-os/types';
import { METRICS } from '@/lib/athlete-os/metrics/registry';

import { seriesOf, mean } from './normalization';

/**
 * Insight generation — consumes correlation + score outputs and produces
 * natural-language findings. Nothing is hard-coded: every sentence is composed
 * from the actual numbers and metric metadata.
 */

function fmtLag(lag: number): string {
  if (lag === 0) return 'same-day';
  if (lag === 1) return 'next-day';
  return `${lag}-day-lagged`;
}

function sign(r: number): string {
  return r >= 0 ? 'positive' : 'negative';
}

/** Verb phrase describing how A relates to B given directions and sign. */
function relationPhrase(c: Correlation): string {
  const a = METRICS[c.metricA];
  const b = METRICS[c.metricB];
  const higherA = c.correlation >= 0 ? 'higher' : 'lower';
  return `${higherA} ${a.label.toLowerCase()} tracks with higher ${b.label.toLowerCase()}`;
}

/** Trend over the last `window` days vs the prior window. */
function trendDelta(matrix: DailyMatrix, key: MetricKey, window: number): number | null {
  const s = seriesOf(matrix, key);
  if (s.length < window * 2) return null;
  const recent = mean(s.slice(-window));
  const prior = mean(s.slice(-window * 2, -window));
  if (prior === 0) return null;
  return ((recent - prior) / Math.abs(prior)) * 100;
}

export function generateInsights(
  matrix: DailyMatrix,
  correlations: Correlation[],
  today: AthleteScore | null,
): Insight[] {
  const insights: Insight[] = [];

  // 1. Status — today's headline.
  if (today) {
    insights.push({
      id: 'status-today',
      kind: 'status',
      priority: 100,
      title: `You're ${today.band.toLowerCase()} today`,
      detail: `Athlete Score ${Math.round(today.score)}/100${
        today.marathonReadiness != null ? ` · marathon readiness ${Math.round(today.marathonReadiness)}` : ''
      }.`,
      metrics: ['athleteScore'],
    });
  }

  // 2. Strongest drivers — top confident relationships.
  const strong = correlations
    .filter((c) => c.confidence.level === 'high' || c.confidence.level === 'moderate')
    .slice(0, 4);
  strong.forEach((c, i) => {
    insights.push({
      id: `driver-${c.metricA}-${c.metricB}`,
      kind: c.lagDays > 0 ? 'timing' : 'driver',
      priority: 80 - i,
      title:
        c.lagDays > 0
          ? `${METRICS[c.metricA].label} predicts ${METRICS[c.metricB].label.toLowerCase()} ${fmtLag(c.lagDays)}`
          : `${METRICS[c.metricA].label} ↔ ${METRICS[c.metricB].label}`,
      detail: `Over the last ${c.window || 'all'} days, ${relationPhrase(c)} (${sign(c.correlation)} ${
        c.method
      } r = ${c.correlation.toFixed(2)}, ${c.confidence.level} confidence, n = ${c.sampleSize}).`,
      metrics: [c.metricA, c.metricB],
    });
  });

  // 3. Warning — load rising faster than recovery.
  const loadTrend = trendDelta(matrix, 'trainingLoad', 14) ?? trendDelta(matrix, 'strain', 14);
  const recoveryTrend = trendDelta(matrix, 'recovery', 14) ?? trendDelta(matrix, 'hrv', 14);
  if (loadTrend != null && recoveryTrend != null && loadTrend > 10 && recoveryTrend < loadTrend - 5) {
    insights.push({
      id: 'warning-load-recovery',
      kind: 'warning',
      priority: 90,
      title: 'Training load is outpacing recovery',
      detail: `Load is up ~${Math.round(loadTrend)}% over two weeks while recovery is ${
        recoveryTrend >= 0 ? `only up ${Math.round(recoveryTrend)}%` : `down ${Math.round(-recoveryTrend)}%`
      }. Consider a lighter day.`,
      metrics: ['trainingLoad', 'recovery'],
    });
  }

  // 4. Trend — a notable multi-day move in a key metric.
  for (const key of ['hrv', 'sleepScore', 'recovery'] as MetricKey[]) {
    const t = trendDelta(matrix, key, 7);
    if (t != null && Math.abs(t) >= 8) {
      insights.push({
        id: `trend-${key}`,
        kind: 'trend',
        priority: 60,
        title: `${METRICS[key].label} is trending ${t >= 0 ? 'up' : 'down'}`,
        detail: `${Math.abs(Math.round(t))}% ${t >= 0 ? 'higher' : 'lower'} over the last week vs the prior week.`,
        metrics: [key],
      });
    }
  }

  return insights.sort((a, b) => b.priority - a.priority);
}
