/**
 * Garmin activity → daily performance metrics.
 *
 * Design: raw pace/power is confounded by intensity (an easy run is "slow" by
 * design). So performance is measured as EFFICIENCY — output per heartbeat:
 *   • runs:  grade-adjusted metres per beat  = GAP speed (m/s) × 60 / avg HR
 *   • rides: Efficiency Factor               = normalized power / avg HR
 * …and the day-to-day signal ("perf") is that efficiency relative to your OWN
 * trailing 28-day median. That strips out the long-term fitness trend, so what
 * remains is "did today go better or worse than usual?" — the thing sleep and
 * recovery should plausibly move.
 */

export interface GarminActivityRow {
  sport_type: string | null;
  start_time: string;
  duration_seconds: number | null;
  distance_meters: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_speed_meters_per_second: number | null;
  weighted_avg_watts: number | null;
  // JSON keys pulled from raw_data via the -> operator
  startTimeLocal?: string | null;
  gap?: number | string | null; // avgGradeAdjustedSpeed
  vo2?: number | string | null; // vO2MaxValue
  load?: number | string | null; // activityTrainingLoad
  z1?: number | string | null;
  z2?: number | string | null;
  z3?: number | string | null;
  z4?: number | string | null;
  z5?: number | string | null;
}

const RUN_TYPES = /^(running|treadmill_running|trail_running|track_running|indoor_running|virtual_run|street_running)$/;
const RIDE_TYPES = /^(road_biking|virtual_ride|cycling|indoor_cycling|mountain_biking|gravel_cycling)$/;

export const isGarminRun = (t: string | null) => RUN_TYPES.test(t ?? '');
export const isGarminRide = (t: string | null) => RIDE_TYPES.test(t ?? '');

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Local calendar day of the activity (aligns with WHOOP's wake-day dating). */
export const activityDay = (a: GarminActivityRow): string =>
  (a.startTimeLocal ?? a.start_time).slice(0, 10);

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** eff = output per beat (display); out/hr feed the intensity-controlled perf model. */
interface EffPoint { day: string; eff: number; w: number; out: number; hr: number }

/** Per-session run efficiency (m/beat), filtered for plausibility. */
export function runEfficiencies(acts: GarminActivityRow[]): EffPoint[] {
  const out: EffPoint[] = [];
  for (const a of acts) {
    if (!isGarminRun(a.sport_type)) continue;
    const dur = a.duration_seconds ?? 0;
    const hr = a.avg_heart_rate ?? 0;
    const spd = num(a.gap) ?? a.avg_speed_meters_per_second ?? 0;
    if (dur < 900 || hr < 90 || hr > 210 || spd < 1.5 || spd > 7) continue;
    out.push({ day: activityDay(a), eff: (spd * 60) / hr, w: dur, out: spd, hr });
  }
  return out;
}

/** Per-session ride Efficiency Factor (NP/HR), filtered for plausibility. */
export function rideEfficiencies(acts: GarminActivityRow[]): EffPoint[] {
  const out: EffPoint[] = [];
  for (const a of acts) {
    if (!isGarminRide(a.sport_type)) continue;
    const dur = a.duration_seconds ?? 0;
    const hr = a.avg_heart_rate ?? 0;
    const np = a.weighted_avg_watts ?? 0;
    if (dur < 1200 || hr < 80 || hr > 200 || np < 40 || np > 500) continue;
    out.push({ day: activityDay(a), eff: np / hr, w: dur, out: np, hr });
  }
  return out;
}

/** Duration-weighted daily mean efficiency. */
export function dailyEfficiency(points: EffPoint[]): Map<string, number> {
  const agg = new Map<string, { s: number; w: number }>();
  for (const p of points) {
    const g = agg.get(p.day) ?? { s: 0, w: 0 };
    g.s += p.eff * p.w; g.w += p.w;
    agg.set(p.day, g);
  }
  const out = new Map<string, number>();
  agg.forEach((g, d) => out.set(d, g.s / g.w));
  return out;
}

/**
 * Daily performance (%) — INTENSITY-CONTROLLED.
 *
 * Output-per-beat rises with intensity (HR doesn't scale linearly with speed),
 * so a raw efficiency ratio scores every workout as a "great day" regardless
 * of readiness — a confound that makes short-sleep/hard-session days look good.
 * Instead, for each session fit your own output-vs-HR line over the PRIOR
 * `windowDays` (excluding that day) and score the session by how far its
 * output sat above/below what that line predicts at its average HR:
 *     perf% = (actual / predicted − 1) × 100
 * i.e. "faster (or more watts) than usual for this effort level?". Long-term
 * fitness gain shows up only slowly because the baseline window keeps moving.
 */
export function dailyPerformance(points: EffPoint[], windowDays = 42, minBaseline = 5): Map<string, number> {
  const sessions = points.map((p) => ({ ...p, t: Date.parse(p.day + 'T00:00:00Z') }));
  const agg = new Map<string, { s: number; w: number }>();
  for (const sp of sessions) {
    const base = sessions.filter((b) => b.t < sp.t && b.t >= sp.t - windowDays * 864e5);
    if (base.length < minBaseline) continue;
    const hrs = base.map((b) => b.hr);
    if (Math.max(...hrs) - Math.min(...hrs) < 8) continue; // need HR spread to fit a slope
    const n = base.length;
    const mx = hrs.reduce((a, b) => a + b, 0) / n;
    const my = base.reduce((a, b) => a + b.out, 0) / n;
    let sxy = 0, sxx = 0;
    for (const b of base) { sxy += (b.hr - mx) * (b.out - my); sxx += (b.hr - mx) ** 2; }
    const slope = sxx ? sxy / sxx : 0;
    if (slope <= 0) continue; // degenerate baseline — can't model effort → output
    const hrC = Math.min(Math.max(sp.hr, Math.min(...hrs)), Math.max(...hrs)); // no extrapolation
    const pred = my + slope * (hrC - mx);
    if (pred <= 0) continue;
    const g = agg.get(sp.day) ?? { s: 0, w: 0 };
    g.s += (sp.out / pred - 1) * 100 * sp.w; g.w += sp.w;
    agg.set(sp.day, g);
  }
  const out = new Map<string, number>();
  agg.forEach((g, d) => out.set(d, g.s / g.w));
  return out;
}
