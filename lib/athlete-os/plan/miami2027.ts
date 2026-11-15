import type { AthleteZones, Phase, PhaseKey, PlanWeek, PlannedRun, WorkoutType } from './types';

/**
 * Miami Marathon 2027 plan — normalized from MARATHON_TRAINING.md (Runna
 * screenshots, W12–W23). Distances are PRESCRIBED, not completed. Interval
 * structure, target paces and durations were not provided → null.
 *
 * Runna is the authoritative source for running workouts: do not edit
 * prescriptions here to reflect what happened — use `explicitStatus`/`notes`.
 */

export const RACE = { name: 'Life Time Miami Marathon', date: '2027-01-31', distanceKm: 42.195, goalSeconds: 4 * 3600 };

/** From Garmin Connect HR-zone settings, read 2026-11-15 (running zones are lactate-threshold based). */
export const ZONES: AthleteZones = {
  runMaxHr: 201,
  runLthr: 166,
  cycleMaxHr: 188,
  cycleLthr: 162,
  marathonHrFracOfLthr: 0.92,
  runZoneFloors: [98, 121, 141, 165, 177],
  // Easy = ≤151 bpm per MARATHON_TRAINING.md (Garmin's own Z2 tops out at 140).
  runEasyMaxHr: 151,
  source: 'Garmin Connect settings (LTHR measured 2026-04-23); easy ceiling from MARATHON_TRAINING.md',
};

type Row = [date: string, week: number, name: string, type: WorkoutType, km: number];

// Long runs and the race are protected; Runna quality sessions are protected
// per the athlete's rules ("Protect Tuesday quality runs and Saturday long runs").
const ROWS: Row[] = [
  ['2026-11-11', 12, 'Tempo 4 km', 'quality', 9],
  ['2026-11-14', 12, '10 km Easy Run', 'easy', 10],
  ['2026-11-15', 12, '22 km Race Practice Long Run', 'long', 22],
  ['2026-11-17', 13, 'Tempo 2 km', 'quality', 6],
  ['2026-11-19', 13, 'Easy Run', 'easy', 8],
  ['2026-11-21', 13, 'Long Run', 'long', 11],
  ['2026-11-24', 14, 'Mile Repeats', 'quality', 8],
  ['2026-11-26', 14, 'Easy Run', 'easy', 10],
  ['2026-11-28', 14, 'Race Practice Long Run', 'long', 24],
  ['2026-12-01', 15, 'Progressive Run', 'quality', 9],
  ['2026-12-03', 15, 'Easy Run', 'easy', 12],
  ['2026-12-05', 15, 'Race Practice Long Run', 'long', 26],
  ['2026-12-08', 16, 'Tempo 5 km', 'quality', 9],
  ['2026-12-10', 16, 'Easy Run', 'easy', 11],
  ['2026-12-12', 16, 'Half Marathon Long Run', 'long', 21.1],
  ['2026-12-15', 17, '1 km Repeats', 'quality', 8],
  ['2026-12-17', 17, 'Easy Run', 'easy', 9],
  ['2026-12-19', 17, 'Block Long Run', 'long', 28],
  ['2026-12-22', 18, 'Tempo 2-1-1', 'quality', 6],
  ['2026-12-24', 18, 'Easy Run', 'easy', 7],
  ['2026-12-26', 18, 'Long Run', 'long', 14],
  ['2026-12-29', 19, 'Over and Unders 1 km', 'quality', 9],
  ['2026-12-31', 19, 'Easy Run', 'easy', 11],
  ['2027-01-02', 19, 'Race Practice Long Run', 'long', 30],
  ['2027-01-05', 20, '800 m Repeats', 'quality', 9],
  ['2027-01-07', 20, 'Easy Run', 'easy', 9],
  ['2027-01-09', 20, 'Long Run', 'long', 33],
  ['2027-01-12', 21, 'Tempo 3 km', 'quality', 7.5],
  ['2027-01-14', 21, 'Easy Run', 'easy', 9],
  ['2027-01-16', 21, 'Long Run', 'long', 22],
  ['2027-01-19', 22, 'On Off Ks', 'quality', 6],
  ['2027-01-21', 22, 'Easy Run', 'easy', 9],
  ['2027-01-23', 22, 'Long Run', 'long', 14],
  ['2027-01-26', 23, 'Race Pace Fartlek', 'quality', 6.5],
  ['2027-01-31', 23, 'Life Time Miami Marathon', 'race', 42.2],
];

const EXPLICIT: Record<string, Pick<PlannedRun, 'explicitStatus' | 'notes'>> = {
  '2026-11-15': {
    explicitStatus: 'skipped',
    notes: 'Skipped by choice: WHOOP 40%, HRV 27 ms, RHR 65 after alcohol; sluggish, not ill. Not to be made up (W13 is a deload).',
  },
  '2026-11-11': { explicitStatus: null, notes: 'Prescribed ~9 km' },
};

export const PLAN_RUNS: PlannedRun[] = ROWS.map(([date, week, name, type, km]) => ({
  id: `runna-${date}`,
  date, week, workoutName: name, workoutType: type, sport: 'running',
  plannedDistanceKm: km, plannedDurationMin: null, targetPace: null, intervals: null,
  priority: type === 'easy' ? 'normal' : 'protected',
  source: 'Runna screenshot',
  explicitStatus: EXPLICIT[date]?.explicitStatus ?? null,
  notes: EXPLICIT[date]?.notes ?? null,
}));

export const PHASES: Phase[] = [
  { key: 'build', label: 'Build', start: '2026-11-09', end: '2026-11-15', strength: { upper: 'normal', lower: 'moderate', plyo: true }, cycling: '0–1 easy ride' },
  { key: 'recovery', label: 'Recovery', start: '2026-11-16', end: '2026-11-22', strength: { upper: 'reduced', lower: 'reduced', plyo: false }, cycling: '0–2 easy rides' },
  { key: 'buildup', label: 'Build-up', start: '2026-11-23', end: '2026-12-13', strength: { upper: 'moderate', lower: 'moderate', plyo: true }, cycling: 'Usually 0–1 easy ride' },
  { key: 'high', label: 'High long-run load', start: '2026-12-14', end: '2026-12-20', strength: { upper: 'moderate', lower: 'reduced', plyo: false }, cycling: 'Optional short easy ride' },
  { key: 'recovery', label: 'Recovery', start: '2026-12-21', end: '2026-12-27', strength: { upper: 'moderate', lower: 'reduced', plyo: false }, cycling: 'Optional easy rides' },
  { key: 'peak', label: 'Peak', start: '2026-12-28', end: '2027-01-10', strength: { upper: 'maintenance', lower: 'minimal', plyo: false }, cycling: 'Minimal or none' },
  { key: 'earlyTaper', label: 'Early taper', start: '2027-01-11', end: '2027-01-17', strength: { upper: 'maintenance', lower: 'minimal', plyo: false }, cycling: 'Optional easy spin' },
  { key: 'lateTaper', label: 'Late taper', start: '2027-01-18', end: '2027-01-24', strength: { upper: 'minimal', lower: 'minimal', plyo: false }, cycling: 'Minimal' },
  { key: 'race', label: 'Race week', start: '2027-01-25', end: '2027-01-31', strength: { upper: 'minimal', lower: 'none', plyo: false }, cycling: 'No demanding cycling' },
];

const WEEK_NOTES: Record<number, string> = {
  12: 'Planned 41 km. 22 km long run skipped by choice (poor recovery after alcohol).',
  13: 'Deload. Keep strength moderate or reduced; don’t add back the missed 22 km.',
  14: 'Moderate–high marathon-specific stress. Trim Wednesday legs if soreness would hurt the 24 km.',
  15: 'Prioritize recovery, carbohydrates, hydration and long-run fueling.',
  16: 'Maintain strength with controlled volume.',
  17: 'Important long-run week — reduced Wednesday legs, avoid cycling fatigue.',
  18: 'Recovery week — some strength, but no extra intensity.',
  19: 'Peak block. Reduce or omit leg strength and plyos; long-run execution first.',
  20: 'Highest volume and the 33 km one week after 30 km — review fatigue and recovery before committing to full distance.',
  21: 'Taper begins. Reduce strength; no new exercises.',
  22: 'Taper continues. Minimal strength; avoid soreness.',
  23: 'Race week. No heavy legs, plyos or demanding cycling. Thursday/Saturday sessions not shown in Runna.',
};

const WEEK_PLANNED_KM: Record<number, number> = { 12: 41, 13: 25, 14: 42, 15: 47, 16: 41.1, 17: 45, 18: 27, 19: 50, 20: 51, 21: 38.5, 22: 29, 23: 48.7 };

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export function phaseOn(date: string): Phase | null {
  return PHASES.find((p) => date >= p.start && date <= p.end) ?? null;
}

export const PLAN_WEEKS: PlanWeek[] = Object.keys(WEEK_PLANNED_KM).map(Number).map((week) => {
  const start = addDays('2026-11-09', (week - 12) * 7);
  return { week, start, end: addDays(start, 6), plannedKm: WEEK_PLANNED_KM[week], phase: (phaseOn(start)?.key ?? 'build') as PhaseKey, note: WEEK_NOTES[week] ?? null };
});

/** Fixed weekly template (§3). Strength intensity comes from the phase. */
export const WEEKLY_TEMPLATE: Record<number, { strength: 'upperA' | 'lower' | 'upperB' | null; plyo?: boolean; cyclingOptional?: boolean; rest?: boolean }> = {
  1: { strength: 'upperA', plyo: true }, // Mon
  2: { strength: null }, // Tue — Runna quality, recovery only
  3: { strength: 'lower' }, // Wed
  4: { strength: null, cyclingOptional: true }, // Thu — easy run + optional short Z2
  5: { strength: 'upperB' }, // Fri — no meaningful leg fatigue
  6: { strength: null }, // Sat — long run
  0: { strength: null, rest: true, cyclingOptional: true }, // Sun — rest; optional easy Z2 only if well recovered
};

export const STRENGTH_LABEL = { upperA: 'Upper A', lower: 'Lower body', upperB: 'Upper B' } as const;
