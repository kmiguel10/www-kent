import type { MetricDefinition, MetricKey } from '@/lib/athlete-os/types';

/**
 * The metric registry — metadata for every metric Athlete OS understands.
 * Adding a data source is a matter of adding an entry here plus wiring it in
 * the API adapter; the correlation engine, explorer, and graph pick it up
 * automatically.
 */
export const METRICS: Record<MetricKey, MetricDefinition> = {
  // ── Recovery / physiology ─────────────────────────────────────────────────
  recovery: {
    key: 'recovery', label: 'Recovery', short: 'Recovery', source: 'whoop', category: 'recovery',
    direction: 'higherBetter', unit: '%', color: '#16a34a',
    hint: 'WHOOP recovery score (0–100)',
  },
  hrv: {
    key: 'hrv', label: 'HRV', short: 'HRV', source: 'whoop', category: 'recovery',
    direction: 'higherBetter', unit: 'ms', color: '#22c55e',
    hint: 'Heart-rate variability (rMSSD)',
  },
  restingHr: {
    key: 'restingHr', label: 'Resting HR', short: 'RHR', source: 'whoop', category: 'recovery',
    direction: 'lowerBetter', unit: 'bpm', color: '#f43f5e',
    hint: 'Resting heart rate — lower is better',
  },
  bodyBattery: {
    key: 'bodyBattery', label: 'Body Battery', short: 'Battery', source: 'garmin', category: 'recovery',
    direction: 'higherBetter', unit: '', color: '#eab308',
    hint: 'Garmin Body Battery morning peak',
  },
  trainingReadiness: {
    key: 'trainingReadiness', label: 'Training Readiness', short: 'Readiness', source: 'garmin', category: 'recovery',
    direction: 'higherBetter', unit: '', color: '#14b8a6',
    hint: 'Garmin training readiness (0–100)',
  },
  stress: {
    key: 'stress', label: 'Stress', short: 'Stress', source: 'garmin', category: 'recovery',
    direction: 'lowerBetter', unit: '', color: '#f97316',
    hint: 'Garmin average daily stress — lower is better',
  },

  // ── Sleep ─────────────────────────────────────────────────────────────────
  sleepScore: {
    key: 'sleepScore', label: 'Sleep Score', short: 'Sleep', source: 'garmin', category: 'sleep',
    direction: 'higherBetter', unit: '', color: '#0090FF',
    hint: 'Garmin sleep score (0–100)',
  },
  sleepDuration: {
    key: 'sleepDuration', label: 'Sleep Duration', short: 'Sleep hrs', source: 'garmin', category: 'sleep',
    direction: 'higherBetter', unit: 'min', color: '#38bdf8',
    hint: 'Total time asleep',
  },
  sleepPerformance: {
    key: 'sleepPerformance', label: 'Sleep Performance', short: 'Sleep perf', source: 'whoop', category: 'sleep',
    direction: 'higherBetter', unit: '%', color: '#60a5fa',
    hint: 'WHOOP sleep performance (% of need met)',
  },
  remMinutes: {
    key: 'remMinutes', label: 'REM Sleep', short: 'REM', source: 'whoop', category: 'sleep',
    direction: 'higherBetter', unit: 'min', color: '#818cf8',
    hint: 'REM sleep minutes',
  },
  deepMinutes: {
    key: 'deepMinutes', label: 'Deep Sleep', short: 'Deep', source: 'whoop', category: 'sleep',
    direction: 'higherBetter', unit: 'min', color: '#4f46e5',
    hint: 'Slow-wave (deep) sleep minutes',
  },

  // ── Load / training ───────────────────────────────────────────────────────
  strain: {
    key: 'strain', label: 'Day Strain', short: 'Strain', source: 'whoop', category: 'load',
    direction: 'load', unit: '', color: '#a855f7',
    hint: 'WHOOP cardiovascular strain (0–21)',
  },
  trainingLoad: {
    key: 'trainingLoad', label: 'Training Load', short: 'Load', source: 'derived', category: 'load',
    direction: 'load', unit: '', color: '#c026d3',
    hint: 'Derived daily load (suffer score + HR-weighted duration)',
  },
  mileage: {
    key: 'mileage', label: 'Running Mileage', short: 'Mileage', source: 'strava', category: 'load',
    direction: 'load', unit: 'km', color: '#fb923c',
    hint: 'Daily running distance',
  },

  // ── Performance ───────────────────────────────────────────────────────────
  runPace: {
    key: 'runPace', label: 'Run Pace', short: 'Pace', source: 'strava', category: 'performance',
    direction: 'lowerBetter', unit: 's/km', color: '#f59e0b',
    hint: 'Average running pace on run days — lower is faster',
  },

  // ── Derived composites ────────────────────────────────────────────────────
  athleteScore: {
    key: 'athleteScore', label: 'Athlete Score', short: 'Athlete', source: 'derived', category: 'composite',
    direction: 'higherBetter', unit: '', color: '#10b981',
    hint: 'Composite daily readiness (0–100)',
  },
  marathonReadiness: {
    key: 'marathonReadiness', label: 'Marathon Readiness', short: 'Marathon', source: 'derived', category: 'composite',
    direction: 'higherBetter', unit: '', color: '#2dd4bf',
    hint: 'Derived marathon-readiness index (0–100)',
  },
};

export const ALL_METRIC_KEYS = Object.keys(METRICS) as MetricKey[];

/** Metrics eligible for correlation/graph (excludes the composites they feed). */
export const ANALYSIS_METRIC_KEYS: MetricKey[] = ALL_METRIC_KEYS.filter(
  (k) => k !== 'athleteScore' && k !== 'marathonReadiness',
);

export function metric(key: MetricKey): MetricDefinition {
  return METRICS[key];
}
