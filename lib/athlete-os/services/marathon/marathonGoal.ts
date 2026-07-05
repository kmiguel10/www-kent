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

export interface GoalModel {
  label: string;
  weeksToRace: number;
  targetSeconds: number;
  marathonPaceSecPerKm: number;
  // current prediction
  predictedSeconds: number | null;
  predictedFrom: string | null;
  gapSeconds: number | null; // predicted - target
  onTrack: boolean;
  // required splits to be on pace
  requiredHalf: number;
  required10k: number;
  // projection
  trend: { month: string; predicted: number }[];
  projectedAtRace: number | null;
  neededImprovementPerMonth: number | null;
  currentImprovementPerMonth: number | null;
  // PRs for context
  prs: { name: string; seconds: number; paceSecPerKm: number; date: string }[];
  levers: Lever[];
}

function linreg(pts: { x: number; y: number }[]): { a: number; b: number } | null {
  const n = pts.length;
  if (n < 2) return null;
  const sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0);
  const sxx = pts.reduce((s, p) => s + p.x * p.x, 0), sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const d = n * sxx - sx * sx;
  if (d === 0) return null;
  const b = (n * sxy - sx * sy) / d;
  return { a: (sy - b * sx) / n, b };
}

export function buildGoalModel(data: MarathonPayload, aerobicPct: number | null): GoalModel {
  const today = new Date();
  const race = new Date(GOAL.raceDate + 'T00:00:00Z');
  const weeksToRace = Math.max(0, Math.round((race.getTime() - today.getTime()) / 6.048e8));
  const monthsToRace = weeksToRace / 4.345;

  // Current prediction: most recent monthly best (already Riegel-projected), and
  // the exact effort it came from (kept consistent by the API).
  const trend = data.predictionTrend.map((p) => ({ month: p.month, predicted: p.predictedSec }));
  const predictedSeconds = trend.length ? trend[trend.length - 1].predicted : null;
  const predictedFrom = data.latestPredictionFrom;

  const gapSeconds = predictedSeconds != null ? predictedSeconds - GOAL.targetSeconds : null;

  // Projection: linear trend of predicted time vs month index → extrapolate.
  const idxPts = trend.map((p, i) => ({ x: i, y: p.predicted }));
  const fit = linreg(idxPts);
  const monthsPerIndex = 1; // trend points are monthly
  const currentImprovementPerMonth = fit ? -fit.b / monthsPerIndex : null; // positive = getting faster
  let projectedAtRace: number | null = null;
  if (fit && trend.length >= 2) {
    const lastIdx = trend.length - 1;
    projectedAtRace = fit.a + fit.b * (lastIdx + monthsToRace);
  }
  const neededImprovementPerMonth = predictedSeconds != null && monthsToRace > 0
    ? (predictedSeconds - GOAL.targetSeconds) / monthsToRace
    : null;
  const onTrack = projectedAtRace != null ? projectedAtRace <= GOAL.targetSeconds : false;

  const marathonPaceSecPerKm = GOAL.targetSeconds / 42.195;

  // ── Levers ────────────────────────────────────────────────────────────────
  const levers: Lever[] = [];

  // 1. Aerobic base (running easy-zone %).
  if (aerobicPct != null) {
    const s: Status = aerobicPct >= 65 ? 'good' : aerobicPct >= 40 ? 'warn' : 'bad';
    levers.push({
      key: 'aerobic', label: 'Aerobic base', value: `${Math.round(aerobicPct)}% easy`, target: '≥ 70% easy',
      status: s, hint: s === 'bad' ? 'Easy runs are too hard — slow them to build base.' : 'Time in easy Zone 1–2.',
    });
  }
  // 2. Weekly volume (4-week avg) vs a ~55 km sub-4 build target.
  const volTarget = 55;
  const volStatus: Status = data.recentWeeklyAvgKm >= 45 ? 'good' : data.recentWeeklyAvgKm >= 30 ? 'warn' : 'bad';
  levers.push({
    key: 'volume', label: 'Weekly volume', value: `${data.recentWeeklyAvgKm} km`, target: `~${volTarget} km`,
    status: volStatus, hint: '4-week average. Consistency matters more than any single big week.',
  });
  // 3. Longest run vs the ~32 km a marathon build needs.
  const lrTarget = 32;
  const lrStatus: Status = data.longestRunKm >= 28 ? 'good' : data.longestRunKm >= 20 ? 'warn' : 'bad';
  levers.push({
    key: 'longrun', label: 'Longest run', value: `${data.longestRunKm} km`, target: `${lrTarget} km`,
    status: lrStatus, hint: 'Build the long run gradually toward ~32 km before the taper.',
  });

  return {
    label: GOAL.label,
    weeksToRace,
    targetSeconds: GOAL.targetSeconds,
    marathonPaceSecPerKm,
    predictedSeconds,
    predictedFrom,
    gapSeconds,
    onTrack,
    requiredHalf: requiredSplit(21097.5),
    required10k: requiredSplit(10000),
    trend,
    projectedAtRace,
    neededImprovementPerMonth,
    currentImprovementPerMonth,
    prs: data.prs.map((p) => ({ name: p.name, seconds: p.seconds, paceSecPerKm: p.seconds / (p.distanceM / 1000), date: p.date })),
    levers,
  };
}
