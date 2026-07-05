import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import type { RideSummary } from '@/lib/athlete-os/services/aerobic/aerobicAnalysis';

/**
 * Per-ride cycling summaries for the Aerobic / Zone 2 analysis. Extracts the
 * mean-max power curve, HR/power aggregates, HR time-in-zone, cadence, and an
 * indoor flag from each ride's raw_data. Read-only; isolated from /fitness.
 */

const localDay = (iso: string): string => iso.slice(0, 10);
const isRide = (t: string | null) => /ride|cycl|bik|spin|road_biking|virtual_ride/i.test(t ?? '');
const CURVE_SECONDS = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600];

export default async function handler(req: NextApiRequest, res: NextApiResponse<{ rides: RideSummary[] }>) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const { data, error } = await getFitnessSupabase()
      .from('activities')
      .select('source, sport_type, name, start_time, duration_seconds, avg_heart_rate, max_heart_rate, raw_data')
      .order('start_time', { ascending: true })
      .limit(3000);
    if (error) throw error;

    // De-dupe the Strava+Garmin copies of the same ride (same day + duration),
    // preferring the copy that has power data.
    const byKey = new Map<string, RideSummary>();

    for (const a of data ?? []) {
      if (!a.start_time || !isRide(a.sport_type)) continue;
      const rd = a.raw_data ?? {};
      const powerCurve: Record<number, number> = {};
      for (const sec of CURVE_SECONDS) {
        const v = Number(rd[`maxAvgPower_${sec}`]);
        if (v > 0) powerCurve[sec] = v;
      }
      const hrZoneSecs = [1, 2, 3, 4, 5].map((i) => Number(rd[`hrTimeInZone_${i}`]) || 0);
      const indoor =
        /virtual_ride/i.test(a.sport_type ?? '') ||
        /zwift/i.test(a.name ?? '') ||
        (rd.startLatitude == null && rd.manufacturer != null);

      const ride: RideSummary = {
        date: localDay(a.start_time),
        name: a.name ?? 'Ride',
        indoor,
        durationSeconds: a.duration_seconds ?? Number(rd.duration) ?? 0,
        avgHr: a.avg_heart_rate ?? null,
        maxHr: a.max_heart_rate ?? null,
        avgPower: rd.avgPower != null ? Math.round(Number(rd.avgPower)) : null,
        normPower: rd.normPower != null ? Math.round(Number(rd.normPower)) : null,
        powerCurve,
        hrZoneSecs,
        cadence: rd.averageBikingCadenceInRevPerMinute != null ? Math.round(Number(rd.averageBikingCadenceInRevPerMinute)) : null,
      };

      const key = `${ride.date}|${Math.round(ride.durationSeconds / 60)}`;
      const existing = byKey.get(key);
      if (!existing || (ride.normPower && !existing.normPower)) byKey.set(key, ride);
    }

    const rides = Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date));
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ rides });
  } catch (err) {
    console.error('athlete-os cycling:', err);
    res.status(200).json({ rides: [] });
  }
}
