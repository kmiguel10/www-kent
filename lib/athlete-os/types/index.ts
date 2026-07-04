/**
 * Athlete OS — core type contracts.
 *
 * These types are deliberately self-contained (no imports from the existing
 * /fitness code) so the Athlete OS feature stays fully isolated and the
 * production dashboard is never coupled to it.
 */

// ── Metrics ─────────────────────────────────────────────────────────────────

/** Every metric Athlete OS can reason about. Extend here to add a data source. */
export type MetricKey =
  // Recovery / physiology
  | 'recovery'
  | 'hrv'
  | 'restingHr'
  | 'bodyBattery'
  | 'trainingReadiness'
  | 'stress'
  // Sleep
  | 'sleepScore'
  | 'sleepDuration'
  | 'sleepPerformance'
  | 'remMinutes'
  | 'deepMinutes'
  // Load / training
  | 'strain'
  | 'trainingLoad'
  | 'mileage'
  // Performance
  | 'runPace'
  // Derived composites
  | 'athleteScore'
  | 'marathonReadiness';

/**
 * Which direction is "good" for a metric — drives normalization sign and how
 * insights are phrased. `load` metrics are neither good nor bad in isolation
 * (they matter relative to recovery); `neutral` metrics are contextual.
 */
export type MetricDirection = 'higherBetter' | 'lowerBetter' | 'load' | 'neutral';

export type MetricSource = 'garmin' | 'whoop' | 'strava' | 'derived';

export type MetricCategory = 'recovery' | 'sleep' | 'load' | 'performance' | 'composite';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  short: string;
  source: MetricSource;
  category: MetricCategory;
  direction: MetricDirection;
  unit: string;
  /** Human hint used in tooltips/legends. */
  hint: string;
  /** Accent colour (hex) used across orb, charts, and graph. */
  color: string;
}

// ── Series & matrix ─────────────────────────────────────────────────────────

/** A single day's value for one metric. `value` is null when no reading. */
export interface DailyPoint {
  date: string; // YYYY-MM-DD
  value: number | null;
}

export interface MetricSeries {
  key: MetricKey;
  points: DailyPoint[];
}

/**
 * The normalized daily matrix the API returns: one entry per metric, all
 * aligned to the same sorted date axis. This is the single input to the
 * correlation engine and scoring services.
 */
export interface DailyMatrix {
  /** Sorted ascending YYYY-MM-DD covering the full range. */
  dates: string[];
  series: Record<MetricKey, (number | null)[]>;
  /** ISO timestamp the matrix was built. */
  generatedAt: string;
}

// ── Correlation ─────────────────────────────────────────────────────────────

export type CorrelationMethod = 'pearson' | 'spearman';

export type RollingWindow = 7 | 30 | 60 | 90 | 180 | 0; // 0 = all time

export type LagDays = 0 | 1 | 2 | 3 | 7 | 14;

export const LAG_OPTIONS: LagDays[] = [0, 1, 2, 3, 7, 14];
export const WINDOW_OPTIONS: RollingWindow[] = [7, 30, 60, 90, 180, 0];

export type ConfidenceLevel = 'high' | 'moderate' | 'low' | 'insufficient';

export interface Confidence {
  level: ConfidenceLevel;
  sampleSize: number;
  /** 0–1, share of days in the window where both metrics had a reading. */
  completeness: number;
  /** |r| strength bucket for quick reasoning. */
  strength: 'strong' | 'moderate' | 'weak' | 'negligible';
}

export interface Correlation {
  metricA: MetricKey;
  metricB: MetricKey;
  method: CorrelationMethod;
  /** Pearson/Spearman coefficient in [-1, 1]. */
  correlation: number;
  /** Lag (days) applied to metricA that produced this coefficient. */
  lagDays: LagDays;
  window: RollingWindow;
  sampleSize: number;
  confidence: Confidence;
  /** Paired (x, y) points actually used — handy for the scatter plot. */
  pairs: { x: number; y: number; date: string }[];
}

/** One lag's coefficient, produced while scanning for the best lag. */
export interface LagResult {
  lagDays: LagDays;
  correlation: number;
  sampleSize: number;
}

// ── Insights ────────────────────────────────────────────────────────────────

export type InsightKind = 'driver' | 'timing' | 'warning' | 'trend' | 'status';

export interface Insight {
  id: string;
  kind: InsightKind;
  /** Higher = surface first. */
  priority: number;
  title: string;
  detail: string;
  /** Metrics this insight references, for cross-highlighting. */
  metrics: MetricKey[];
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface ScoreContributor {
  metric: MetricKey;
  label: string;
  /** Signed points this factor added to / removed from the score. */
  delta: number;
}

export interface AthleteScore {
  /** 0–100 overall readiness for `date`. */
  score: number;
  date: string;
  /** Sub-scores 0–100. */
  recovery: number | null;
  sleepQuality: number | null;
  trainingReadiness: number | null;
  marathonReadiness: number | null;
  contributors: ScoreContributor[];
  /** Short verbal band, e.g. "Primed", "Balanced", "Compromised". */
  band: string;
}

// ── Relationship graph ──────────────────────────────────────────────────────

export interface GraphNode {
  id: MetricKey;
  label: string;
  category: MetricCategory;
  color: string;
  /** 0–1 importance (degree × avg |r|) → node size. */
  importance: number;
}

export interface GraphEdge {
  source: MetricKey;
  target: MetricKey;
  /** Signed correlation in [-1, 1]. */
  weight: number;
  lagDays: LagDays;
  confidence: ConfidenceLevel;
}

export interface RelationshipGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── API payload ─────────────────────────────────────────────────────────────

export interface AthleteOsPayload {
  matrix: DailyMatrix;
  /** Per-day athlete score series (most recent last). */
  scores: AthleteScore[];
  today: AthleteScore | null;
  /** Coverage summary for the UI's "data health" affordance. */
  coverage: { metric: MetricKey; days: number; firstDate: string | null; lastDate: string | null }[];
}
