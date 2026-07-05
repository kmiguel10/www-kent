import { GOAL } from './marathonGoal';

/**
 * Training roadmap — a reverse-periodized plan from now to race day, with the
 * target stats you should hit at each monthly checkpoint. It's a glide path,
 * not a promise: it starts from your current fitness and ramps to the numbers a
 * sub-4 build needs, then tapers. Pure and configurable off GOAL.
 */

// Peak targets a sub-4 build works toward.
const V_PEAK = 60;      // km/week at peak
const LR_PEAK = 32;     // km longest run at peak
const AER_TARGET = 75;  // % easy (Zone 1–2)
const AER_RAMP_WEEKS = 8;

export type Phase = 'base' | 'build' | 'peak' | 'taper';

export interface Checkpoint {
  monthsOut: number;
  date: string;        // YYYY-MM-DD
  label: string;
  phase: Phase;
  predictedSec: number;
  volumeKm: number;
  longestKm: number;
  aerobicPct: number;
}

export interface RoadmapCurrent {
  predictedSec: number | null;
  volumeKm: number;
  longestKm: number;
  aerobicPct: number | null;
}

export interface Roadmap {
  weeksToRace: number;
  targetSec: number;
  raceDate: string;
  checkpoints: Checkpoint[];
  trajectory: { date: string; predictedMin: number }[];
  current: RoadmapCurrent;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function phaseFor(wtr: number): Phase {
  if (wtr <= 3) return 'taper';
  if (wtr <= 6) return 'peak';
  if (wtr <= 16) return 'build';
  return 'base';
}

export function buildRoadmap(current: RoadmapCurrent): Roadmap {
  const race = new Date(GOAL.raceDate + 'T00:00:00Z');
  const now = new Date();
  const W = Math.max(1, (race.getTime() - now.getTime()) / 6.048e8); // weeks to race
  const target = GOAL.targetSeconds;

  const startPred = current.predictedSec ?? 5.2 * 3600; // fall back to ~5:12
  const cVol = current.volumeKm || 25;
  const cLR = current.longestKm || 16;
  const cAer = current.aerobicPct ?? 40;

  // Target stat as a function of weeks-to-race (wtr ∈ [0, W]).
  const predAt = (wtr: number) =>
    startPred <= target ? startPred : target + (wtr / W) * (startPred - target);

  const volAt = (wtr: number) => {
    if (wtr <= 3) return Math.round(V_PEAK * 0.55);           // taper
    if (wtr <= 6) return V_PEAK;                               // peak block
    return Math.round(cVol + (V_PEAK - cVol) * clamp((W - wtr) / Math.max(1, W - 6), 0, 1));
  };

  const lrAt = (wtr: number) => {
    if (wtr <= 2) return Math.min(cLR + 4, 18);               // taper (long run done ~3wks out)
    if (wtr <= 5) return LR_PEAK;                             // peak long runs
    return Math.round(cLR + (LR_PEAK - cLR) * clamp((W - wtr) / Math.max(1, W - 5), 0, 1));
  };

  const aerAt = (wtr: number) =>
    Math.round(Math.min(AER_TARGET, cAer + (AER_TARGET - cAer) * clamp((W - wtr) / AER_RAMP_WEEKS, 0, 1)));

  // Monthly checkpoints from the furthest whole month out down to race week.
  const maxM = Math.floor(W / 4.345);
  const checkpoints: Checkpoint[] = [];
  for (let m = maxM; m >= 0; m--) {
    const wtr = m * 4.345;
    // Use day 1 of the target month so Jan-31 − N months doesn't roll over
    // (e.g. "2 months before Jan 31" is November, not December).
    const d = new Date(Date.UTC(race.getUTCFullYear(), race.getUTCMonth() - m, 1));
    checkpoints.push({
      monthsOut: m,
      date: d.toISOString().slice(0, 10),
      label: m === 0 ? 'Race week' : `${m} mo out`,
      phase: phaseFor(wtr),
      predictedSec: Math.round(predAt(wtr)),
      volumeKm: volAt(wtr),
      longestKm: lrAt(wtr),
      aerobicPct: aerAt(wtr),
    });
  }

  // Smooth trajectory (every ~2 weeks) for the glide-path line.
  const trajectory: { date: string; predictedMin: number }[] = [];
  for (let wtr = W; wtr >= 0; wtr -= 2) {
    const d = new Date(race);
    d.setUTCDate(d.getUTCDate() - Math.round(wtr * 7));
    trajectory.push({ date: d.toISOString().slice(0, 10), predictedMin: Math.round(predAt(wtr) / 60) });
  }

  return {
    weeksToRace: Math.round(W),
    targetSec: target,
    raceDate: GOAL.raceDate,
    checkpoints,
    trajectory,
    current: { predictedSec: current.predictedSec, volumeKm: cVol, longestKm: cLR, aerobicPct: current.aerobicPct },
  };
}
