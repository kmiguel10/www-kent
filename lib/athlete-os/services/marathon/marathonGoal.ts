import type { MarathonPayload } from '@/pages/api/athlete-os/marathon';

/**
 * Marathon goal engine — turns race efforts + training volume into a live
 * tracker toward a target finish time. Pure and configurable.
 */

export const GOAL = {
  label: 'Sub-4 Marathon',
  targetSeconds: 4 * 3600, // 4:00:00
  raceDate: '2027-01-31',
  distanceM: 42195,
};

const RIEGEL = 1.06;
export const riegelMarathon = (sec: number, distM: number) => sec * Math.pow(GOAL.distanceM / distM, RIEGEL);
/** Time you'd need at `distM` to be on pace for the target marathon. */
export const requiredSplit = (distM: number) => GOAL.targetSeconds / Math.pow(GOAL.distanceM / distM, RIEGEL);

export function fmtTime(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
export function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export type Status = 'good' | 'warn' | 'bad';
export interface Lever { key: string; label: string; value: string; target: string; status: Status; hint: string; }

export interface Estimator {
  key: 'race' | 'aerobic' | 'vo2';
  label: string;
  seconds: number | null;
  note: string;
}

export interface GoalModel {
  label: string;
  weeksToRace: number;
  targetSeconds: number;
  marathonPaceSecPerKm: number;
  // current prediction (ensemble of race-effort + aerobic estimators)
  predictedSeconds: number | null;
  predictedFrom: string | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  estimators: Estimator[];
  /** VO₂max-implied potential — what your engine could support with the endurance to match. */
  ceilingSeconds: number | null;
  vo2max: number | null;
  gapSeconds: number | null; // predicted - target
  onTrack: boolean;
  requiredHalf: number;
  required10k: number;
  // trajectory (weekly rolling ensemble → robust slope → saturating projection)
  trend: { week: string; predicted: number | null; ceiling: number | null }[];
  /** Seconds/week currently being gained (positive = getting faster). */
  improvementPerWeek: number | null;
  neededImprovementPerWeek: number | null;
  projectedAtRace: number | null;
  projectedLow: number | null;
  projectedHigh: number | null;
  prs: { name: string; seconds: number; paceSecPerKm: number; date: string }[];
  levers: Lever[];
}

/** Fitness gains decay — a 10-week time constant stops a hot streak extrapolating forever. */
const TAU_WEEKS = 10;
const saturate = (slopePerWeek: number, weeks: number) => slopePerWeek * TAU_WEEKS * (1 - Math.exp(-weeks / TAU_WEEKS));

/** Theil–Sen: median of pairwise slopes (robust to outlier weeks) + IQR band. */
function theilSen(pts: { x: number; y: number }[]): { slope: number; lo: number; hi: number } | null {
  if (pts.length < 4) return null;
  const sl: number[] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (pts[j].x !== pts[i].x) sl.push((pts[j].y - pts[i].y) / (pts[j].x - pts[i].x));
  }
  if (!sl.length) return null;
  sl.sort((a, b) => a - b);
  const q = (f: number) => sl[Math.min(sl.length - 1, Math.max(0, Math.round(f * (sl.length - 1))))];
  return { slope: q(0.5), lo: q(0.25), hi: q(0.75) };
}

export function buildGoalModel(data: MarathonPayload, aerobicPct: number | null): GoalModel {
  const today = new Date();
  const race = new Date(GOAL.raceDate + 'T00:00:00Z');
  const weeksExact = Math.max(0, (race.getTime() - today.getTime()) / 6.048e8);
  const weeksToRace = Math.round(weeksExact);

  const c = data.current;
  const predictedSeconds = c.ensembleSec;
  const gapSeconds = predictedSeconds != null ? predictedSeconds - GOAL.targetSeconds : null;

  const estimators: Estimator[] = [
    { key: 'race', label: 'Race efforts', seconds: c.raceSec, note: c.raceFrom ? `Riegel from your best ${c.raceFrom}-and-shorter splits, last 8 weeks` : 'No fast splits in the last 8 weeks' },
    { key: 'aerobic', label: 'Aerobic curve', seconds: c.aerobicSec, note: data.hrMax ? `Your HR–pace line at ~${Math.round(0.82 * data.hrMax)} bpm marathon effort` : 'Not enough HR data' },
    { key: 'vo2', label: 'VO₂max ceiling', seconds: c.vo2Sec, note: c.vo2max ? `Garmin VO₂max ${c.vo2max} → Daniels VDOT. Potential, not current form` : 'No VO₂max reading' },
  ];

  // Trajectory over the last 16 weeks of the weekly rolling ensemble.
  const trend = data.weekly.map((w) => ({ week: w.week, predicted: w.ensembleSec, ceiling: w.vo2Sec }));
  const pts = trend.slice(-16).map((w, i) => ({ x: i, y: w.predicted })).filter((p): p is { x: number; y: number } => p.y != null);
  const ts = theilSen(pts);
  const improvementPerWeek = ts ? -ts.slope : null;
  let projectedAtRace: number | null = null, projectedLow: number | null = null, projectedHigh: number | null = null;
  if (ts && predictedSeconds != null) {
    projectedAtRace = Math.round(predictedSeconds + saturate(ts.slope, weeksExact));
    projectedLow = Math.round(predictedSeconds + saturate(ts.lo, weeksExact));
    projectedHigh = Math.round(predictedSeconds + saturate(ts.hi, weeksExact));
  }
  const neededImprovementPerWeek = predictedSeconds != null && weeksExact > 0
    ? (predictedSeconds - GOAL.targetSeconds) / weeksExact : null;
  const onTrack = projectedAtRace != null && projectedAtRace <= GOAL.targetSeconds;

  const marathonPaceSecPerKm = GOAL.targetSeconds / 42.195;

  // ── Levers ────────────────────────────────────────────────────────────────
  const levers: Lever[] = [];
  if (aerobicPct != null) {
    const s: Status = aerobicPct >= 65 ? 'good' : aerobicPct >= 40 ? 'warn' : 'bad';
    levers.push({
      key: 'aerobic', label: 'Aerobic base', value: `${Math.round(aerobicPct)}% easy`, target: '≥ 70% easy',
      status: s, hint: s === 'bad' ? 'Easy runs are too hard — slow them to build base.' : 'Time in easy Zone 1–2.',
    });
  }
  const volStatus: Status = data.recentWeeklyAvgKm >= 45 ? 'good' : data.recentWeeklyAvgKm >= 30 ? 'warn' : 'bad';
  levers.push({
    key: 'volume', label: 'Weekly volume', value: `${data.recentWeeklyAvgKm} km`, target: '~55 km',
    status: volStatus, hint: '4-week average. Consistency matters more than any single big week.',
  });
  const lrStatus: Status = data.longestRunKm >= 28 ? 'good' : data.longestRunKm >= 20 ? 'warn' : 'bad';
  levers.push({
    key: 'longrun', label: 'Longest run', value: `${data.longestRunKm} km`, target: '32 km',
    status: lrStatus, hint: 'Build the long run gradually toward ~32 km before the taper.',
  });

  return {
    label: GOAL.label, weeksToRace, targetSeconds: GOAL.targetSeconds, marathonPaceSecPerKm,
    predictedSeconds, predictedFrom: c.raceFrom ? `best ${c.raceFrom} + aerobic curve` : c.aerobicSec ? 'aerobic curve' : null,
    rangeLow: c.lowSec, rangeHigh: c.highSec, estimators, ceilingSeconds: c.vo2Sec, vo2max: c.vo2max,
    gapSeconds, onTrack,
    requiredHalf: requiredSplit(21097.5), required10k: requiredSplit(10000),
    trend, improvementPerWeek, neededImprovementPerWeek, projectedAtRace, projectedLow, projectedHigh,
    prs: data.prs.map((p) => ({ name: p.name, seconds: p.seconds, paceSecPerKm: p.seconds / (p.distanceM / 1000), date: p.date })),
    levers,
  };
}
