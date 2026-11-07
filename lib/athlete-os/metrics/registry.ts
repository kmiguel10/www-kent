import type { MetricDefinition, MetricKey } from '@/lib/athlete-os/types';

/**
 * The metric registry — metadata for every metric Athlete OS understands.
 *
 * Sourcing rules (2026-11 revamp):
 *   • Sleep & recovery come ONLY from WHOOP.
 *   • Activities (load + performance) come ONLY from Garmin.
 *   • "Behaviors" are derived from WHOOP sleep/cycle data (WHOOP's API does not
 *     expose Journal entries).
 *
 * Adding a metric = an entry here + wiring in the metrics API adapter; the
 * correlation engine, drivers analysis, explorer and graph pick it up.
 */
export const METRICS: Record<MetricKey, MetricDefinition> = {
  // ── Recovery / physiology (WHOOP) ─────────────────────────────────────────
  recovery: {
    key: 'recovery', label: 'Recovery', short: 'Recovery', source: 'whoop', category: 'recovery',
    direction: 'higherBetter', unit: '%', color: '#16a34a',
    hint: 'WHOOP recovery score (0–100) — your training readiness',
  },
  hrv: {
    key: 'hrv', label: 'HRV', short: 'HRV', source: 'whoop', category: 'recovery',
    direction: 'higherBetter', unit: 'ms', color: '#22c55e',
    hint: 'Heart-rate variability (rMSSD) during sleep',
  },
  restingHr: {
    key: 'restingHr', label: 'Resting HR', short: 'RHR', source: 'whoop', category: 'recovery',
    direction: 'lowerBetter', unit: 'bpm', color: '#f43f5e',
    hint: 'Resting heart rate — lower is better',
  },
  spo2: {
    key: 'spo2', label: 'Blood Oxygen', short: 'SpO₂', source: 'whoop', category: 'recovery',
    direction: 'higherBetter', unit: '%', color: '#06b6d4',
    hint: 'Overnight blood-oxygen saturation',
  },
  skinTemp: {
    key: 'skinTemp', label: 'Skin Temp', short: 'Skin temp', source: 'whoop', category: 'recovery',
    direction: 'neutral', unit: '°C', color: '#fb7185',
    hint: 'Overnight skin temperature — spikes can flag illness or heavy load',
  },
  respiratoryRate: {
    key: 'respiratoryRate', label: 'Respiratory Rate', short: 'Resp rate', source: 'whoop', category: 'recovery',
    direction: 'lowerBetter', unit: 'rpm', color: '#94a3b8',
    hint: 'Breaths per minute during sleep',
  },

  // ── Sleep (WHOOP) ─────────────────────────────────────────────────────────
  sleepDuration: {
    key: 'sleepDuration', label: 'Sleep Duration', short: 'Sleep', source: 'whoop', category: 'sleep',
    direction: 'higherBetter', unit: 'min', color: '#38bdf8',
    hint: 'Time actually asleep (in bed − awake)',
  },
  sleepPerformance: {
    key: 'sleepPerformance', label: 'Sleep Performance', short: 'Sleep perf', source: 'whoop', category: 'sleep',
    direction: 'higherBetter', unit: '%', color: '#60a5fa',
    hint: 'WHOOP sleep performance (% of sleep need met)',
  },
  sleepEfficiency: {
    key: 'sleepEfficiency', label: 'Sleep Efficiency', short: 'Efficiency', source: 'whoop', category: 'sleep',
    direction: 'higherBetter', unit: '%', color: '#3b82f6',
    hint: '% of time in bed actually asleep',
  },
  sleepConsistency: {
    key: 'sleepConsistency', label: 'Sleep Consistency', short: 'Consistency', source: 'whoop', category: 'sleep',
    direction: 'higherBetter', unit: '%', color: '#2563eb',
    hint: 'WHOOP sleep consistency — how regular your sleep/wake timing is',
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
  disturbances: {
    key: 'disturbances', label: 'Sleep Disturbances', short: 'Disturbances', source: 'whoop', category: 'sleep',
    direction: 'lowerBetter', unit: '', color: '#a78bfa',
    hint: 'Number of sleep disturbances',
  },
  sleepDebt: {
    key: 'sleepDebt', label: 'Sleep Debt', short: 'Debt', source: 'whoop', category: 'sleep',
    direction: 'lowerBetter', unit: 'min', color: '#7c3aed',
    hint: 'Sleep need − sleep obtained (negative = surplus)',
  },

  // ── Behaviors (derived from WHOOP) ────────────────────────────────────────
  bedtime: {
    key: 'bedtime', label: 'Bedtime', short: 'Bedtime', source: 'derived', category: 'behavior',
    direction: 'lowerBetter', unit: 'h', color: '#f59e0b',
    hint: 'Local time you fell asleep (hours; 24.5 = 12:30 am)',
  },
  bedtimeShift: {
    key: 'bedtimeShift', label: 'Bedtime Irregularity', short: 'Bedtime shift', source: 'derived', category: 'behavior',
    direction: 'lowerBetter', unit: 'h', color: '#fbbf24',
    hint: 'How far bedtime strayed from your 14-night median',
  },
  timeInBed: {
    key: 'timeInBed', label: 'Time in Bed', short: 'In bed', source: 'derived', category: 'behavior',
    direction: 'higherBetter', unit: 'min', color: '#fcd34d',
    hint: 'Total time in bed — the opportunity you gave yourself to sleep',
  },
  sleepDebt3d: {
    key: 'sleepDebt3d', label: '3-Night Sleep Debt', short: 'Debt 3d', source: 'derived', category: 'behavior',
    direction: 'lowerBetter', unit: 'min', color: '#d97706',
    hint: 'Accumulated sleep debt over the last 3 nights',
  },
  steps: {
    key: 'steps', label: 'Daily Steps', short: 'Steps', source: 'whoop', category: 'behavior',
    direction: 'neutral', unit: '', color: '#eab308',
    hint: 'WHOOP step count for the day',
  },

  // ── Load (WHOOP strain + Garmin activities) ───────────────────────────────
  strain: {
    key: 'strain', label: 'Day Strain', short: 'Strain', source: 'whoop', category: 'load',
    direction: 'load', unit: '', color: '#a855f7',
    hint: 'WHOOP cardiovascular strain (0–21)',
  },
  trainingLoad: {
    key: 'trainingLoad', label: 'Training Load', short: 'Load', source: 'garmin', category: 'load',
    direction: 'load', unit: '', color: '#c026d3',
    hint: 'Garmin activity training load, summed per day',
  },
  mileage: {
    key: 'mileage', label: 'Running Distance', short: 'Distance', source: 'garmin', category: 'load',
    direction: 'load', unit: 'km', color: '#fb923c',
    hint: 'Daily running distance',
  },
  aerobicPct: {
    key: 'aerobicPct', label: 'Aerobic %', short: 'Aerobic', source: 'garmin', category: 'load',
    direction: 'higherBetter', unit: '%', color: '#34d399',
    hint: '% of session time in easy zones 1–2 (aerobic base)',
  },
  greyZonePct: {
    key: 'greyZonePct', label: 'Grey-Zone %', short: 'Grey zone', source: 'garmin', category: 'load',
    direction: 'lowerBetter', unit: '%', color: '#fbbf24',
    hint: '% of session time in zone 3 — the "junk-mile" grey zone',
  },

  // ── Performance (Garmin) ──────────────────────────────────────────────────
  runEfficiency: {
    key: 'runEfficiency', label: 'Run Efficiency', short: 'Run eff.', source: 'garmin', category: 'performance',
    direction: 'higherBetter', unit: 'm/beat', color: '#f59e0b',
    hint: 'Grade-adjusted metres covered per heartbeat — speed you get for the effort',
  },
  runPerf: {
    key: 'runPerf', label: 'Run Performance', short: 'Run perf', source: 'garmin', category: 'performance',
    direction: 'higherBetter', unit: '%', color: '#ea580c',
    hint: 'Grade-adjusted speed vs what your recent HR–speed curve predicts at that HR — >0 = faster than usual for the effort',
  },
  rideEfficiency: {
    key: 'rideEfficiency', label: 'Ride Efficiency', short: 'Ride EF', source: 'garmin', category: 'performance',
    direction: 'higherBetter', unit: 'W/bpm', color: '#0ea5e9',
    hint: 'Efficiency Factor — normalized power per heartbeat',
  },
  ridePerf: {
    key: 'ridePerf', label: 'Ride Performance', short: 'Ride perf', source: 'garmin', category: 'performance',
    direction: 'higherBetter', unit: '%', color: '#0284c7',
    hint: 'Normalized power vs what your recent power–HR curve predicts at that HR — >0 = stronger than usual for the effort',
  },
  vo2max: {
    key: 'vo2max', label: 'VO₂max', short: 'VO₂max', source: 'garmin', category: 'performance',
    direction: 'higherBetter', unit: '', color: '#10b981',
    hint: 'Garmin running VO₂max estimate',
  },

  // ── Derived composites ────────────────────────────────────────────────────
  athleteScore: {
    key: 'athleteScore', label: 'Athlete Score', short: 'Athlete', source: 'derived', category: 'composite',
    direction: 'higherBetter', unit: '', color: '#10b981',
    hint: 'Composite daily readiness (0–100) from WHOOP recovery & sleep',
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

/** Performance outcomes the drivers analysis explains. */
export const PERFORMANCE_TARGETS: MetricKey[] = ['runPerf', 'ridePerf'];

/** Candidate drivers: WHOOP sleep, recovery and behaviors (+ prior-day load). */
export const DRIVER_METRICS: MetricKey[] = ALL_METRIC_KEYS.filter((k) => {
  const c = METRICS[k].category;
  return c === 'recovery' || c === 'sleep' || c === 'behavior';
}).concat(['strain', 'trainingLoad']);

export function metric(key: MetricKey): MetricDefinition {
  return METRICS[key];
}
