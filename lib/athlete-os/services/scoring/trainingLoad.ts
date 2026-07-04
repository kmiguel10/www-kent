/**
 * Derived training load.
 *
 * There is no native training-load field in the data, so we approximate daily
 * load from what activities *do* expose. Two signals are combined:
 *   1. Strava/Garmin `suffer_score` (a.k.a. relative effort) when present.
 *   2. An HR-weighted duration fallback (a crude TRIMP): minutes × HR intensity.
 *
 * This is intentionally a *proxy*, documented as such, not a claim of parity
 * with Garmin's proprietary training load.
 */

export interface ActivityLoadInput {
  date: string; // YYYY-MM-DD (local day of start)
  sufferScore: number | null;
  durationSeconds: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
}

/** Rough HR-reserve intensity → TRIMP-like minutes. Assumes RHR ~50. */
function trimpLike(durationSeconds: number, avgHr: number, maxHr: number): number {
  const restingHr = 50;
  const denom = Math.max(1, maxHr - restingHr);
  const intensity = Math.max(0, Math.min(1, (avgHr - restingHr) / denom));
  const minutes = durationSeconds / 60;
  // Exponential weighting rewards higher intensity, à la Banister TRIMP.
  return minutes * intensity * Math.exp(1.92 * intensity);
}

/** Aggregate per-activity load into a per-day total. */
export function dailyTrainingLoad(activities: ActivityLoadInput[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const a of activities) {
    let load = 0;
    if (a.sufferScore != null && a.sufferScore > 0) {
      load = a.sufferScore;
    } else if (a.durationSeconds && a.avgHeartRate && a.maxHeartRate) {
      load = trimpLike(a.durationSeconds, a.avgHeartRate, a.maxHeartRate);
    } else if (a.durationSeconds) {
      // Last resort: duration alone at an assumed moderate intensity.
      load = (a.durationSeconds / 60) * 0.4;
    }
    byDay.set(a.date, (byDay.get(a.date) ?? 0) + load);
  }
  return byDay;
}
