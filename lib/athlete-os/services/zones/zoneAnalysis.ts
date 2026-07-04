/**
 * Zone analysis — pure helpers for HR-zone discipline (polarized training).
 *
 * Two modes, because the data supports two granularities:
 *   • 'garmin'  — Garmin's precomputed time-in-zone (true per-session
 *                 distribution, but tied to Garmin's zone boundaries).
 *   • 'maxhr'   — reclassify each session by its AVERAGE HR as a % of a
 *                 user-supplied max HR (coarser, but reflects real physiology
 *                 regardless of Garmin's settings). We only have avg HR per
 *                 session here, not the raw stream, so this is session-level.
 *
 * Buckets collapse the 5 zones into the polarized-training view:
 *   Easy = Z1+Z2, Grey = Z3, Hard = Z4+Z5.
 */

export type ZoneMode = 'garmin' | 'maxhr';
export type Sport = 'run' | 'ride';

export interface ZoneSession {
  date: string; // YYYY-MM-DD
  sport: Sport;
  durationSeconds: number;
  avgHr: number | null;
  maxHr: number | null;
  /** Garmin time-in-zone seconds, index 0..4 = Z1..Z5. */
  zoneSecs: number[];
}

export interface Polarization {
  /** Percentages 0–100. */
  easy: number;
  grey: number;
  hard: number;
  /** Per-zone percentages Z1..Z5. */
  byZone: number[];
  totalSeconds: number;
  sessions: number;
}

/** Standard %HRmax zone boundaries (fraction of max). Z1..Z5 lower bounds. */
const MAXHR_BOUNDS = [0, 0.6, 0.7, 0.8, 0.9];

/** Which 0-based zone index an average HR falls in, given a max HR. */
export function zoneForAvgHr(avgHr: number, maxHr: number): number {
  const frac = avgHr / maxHr;
  for (let z = MAXHR_BOUNDS.length - 1; z >= 0; z--) {
    if (frac >= MAXHR_BOUNDS[z]) return z;
  }
  return 0;
}

/** Aggregate a set of sessions into a polarization summary for the given mode. */
export function polarize(sessions: ZoneSession[], mode: ZoneMode, maxHr: number): Polarization {
  const byZone = [0, 0, 0, 0, 0];
  let total = 0;

  for (const s of sessions) {
    if (mode === 'garmin') {
      const secs = s.zoneSecs;
      const t = secs.reduce((a, b) => a + b, 0);
      if (t <= 0) continue;
      for (let z = 0; z < 5; z++) byZone[z] += secs[z] || 0;
      total += t;
    } else {
      // Max-HR mode: attribute the whole session's duration to its avg-HR zone.
      if (s.avgHr == null || !s.durationSeconds) continue;
      const z = zoneForAvgHr(s.avgHr, maxHr);
      byZone[z] += s.durationSeconds;
      total += s.durationSeconds;
    }
  }

  if (total === 0) {
    return { easy: 0, grey: 0, hard: 0, byZone: [0, 0, 0, 0, 0], totalSeconds: 0, sessions: 0 };
  }
  const pct = byZone.map((v) => (v / total) * 100);
  return {
    easy: pct[0] + pct[1],
    grey: pct[2],
    hard: pct[3] + pct[4],
    byZone: pct,
    totalSeconds: total,
    sessions: sessions.length,
  };
}

/**
 * Discipline score 0–100. Anchored on the ~80% easy target: full marks near
 * 80% easy, penalised for grey-zone bloat. Deliberately simple and monotonic
 * so its trend is meaningful.
 */
export function disciplineScore(p: Polarization): number {
  if (p.totalSeconds === 0) return 0;
  const easyTerm = Math.min(1, p.easy / 80); // reaches 1.0 at 80% easy
  const greyPenalty = Math.max(0, (p.grey - 10) / 100); // grey above 10% costs
  return Math.max(0, Math.min(100, Math.round(easyTerm * 100 - greyPenalty * 60)));
}

export function disciplineBand(score: number): string {
  if (score >= 80) return 'Polarized';
  if (score >= 60) return 'Reasonable';
  if (score >= 40) return 'Grey-zone heavy';
  return 'Always-on';
}

/** Per-session easy/grey/hard split for the timeline bars. */
export function sessionSplit(s: ZoneSession, mode: ZoneMode, maxHr: number): { easy: number; grey: number; hard: number } {
  if (mode === 'maxhr') {
    if (s.avgHr == null) return { easy: 0, grey: 0, hard: 0 };
    const z = zoneForAvgHr(s.avgHr, maxHr);
    return { easy: z <= 1 ? 100 : 0, grey: z === 2 ? 100 : 0, hard: z >= 3 ? 100 : 0 };
  }
  const t = s.zoneSecs.reduce((a, b) => a + b, 0);
  if (t <= 0) return { easy: 0, grey: 0, hard: 0 };
  return {
    easy: ((s.zoneSecs[0] + s.zoneSecs[1]) / t) * 100,
    grey: (s.zoneSecs[2] / t) * 100,
    hard: ((s.zoneSecs[3] + s.zoneSecs[4]) / t) * 100,
  };
}
