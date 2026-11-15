/**
 * Training-plan record types (fields follow MARATHON_TRAINING.md §17).
 * Unknown values are null — never invented. The original Runna prescription
 * is kept verbatim; any status or change is stored separately so it stays
 * distinguishable from the source calendar.
 */

export type WorkoutType = 'quality' | 'easy' | 'long' | 'race';
export type Priority = 'protected' | 'normal' | 'optional';
/** Explicit statuses only — a workout is never "completed" just because its date passed. */
export type ExplicitStatus = 'skipped' | 'modified' | 'rescheduled';
export type PhaseKey = 'build' | 'recovery' | 'buildup' | 'high' | 'peak' | 'earlyTaper' | 'lateTaper' | 'race';
export type StrengthMode = 'normal' | 'moderate' | 'reduced' | 'maintenance' | 'minimal' | 'none';

export interface PlannedRun {
  id: string;
  date: string; // YYYY-MM-DD
  week: number;
  workoutName: string; // Runna title, verbatim
  workoutType: WorkoutType;
  sport: 'running';
  plannedDistanceKm: number;
  plannedDurationMin: number | null;
  targetPace: string | null;
  intervals: string | null;
  priority: Priority;
  source: 'Runna screenshot';
  /** Set only by the athlete/doc — e.g. a deliberate skip. */
  explicitStatus: ExplicitStatus | null;
  notes: string | null;
}

export interface PlanWeek {
  week: number;
  start: string; // Monday
  end: string; // Sunday
  plannedKm: number;
  phase: PhaseKey;
  note: string | null;
}

export interface Phase {
  key: PhaseKey;
  label: string;
  start: string;
  end: string;
  strength: { upper: StrengthMode; lower: StrengthMode; plyo: boolean };
  cycling: string;
}

export interface AthleteZones {
  runMaxHr: number;
  runLthr: number;
  cycleMaxHr: number;
  cycleLthr: number;
  /** Fraction of running LTHR used as sustainable marathon effort. */
  marathonHrFracOfLthr: number;
  /** Garmin running HR-zone floors Z1..Z5 (lactate-threshold based). */
  runZoneFloors: [number, number, number, number, number];
  /** Upper bound of "easy" running HR (athlete's own definition). */
  runEasyMaxHr: number;
  source: string;
}
