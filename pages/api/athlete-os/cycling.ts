import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import { selectWithRetry } from '@/lib/athlete-os/services/fitnessQuery';
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
    const data = await selectWithRetry(() =>
      getFitnessSupabase()
        .from('activities')
        .select(
          'source, sport_type, name, start_time, duration_seconds, avg_heart_rate, max_heart_rate, startTimeLocal:raw_data->>startTimeLocal, maxAvgPower_1:raw_data->maxAvgPower_1, maxAvgPower_2:raw_data->maxAvgPower_2, maxAvgPower_5:raw_data->maxAvgPower_5, maxAvgPower_10:raw_data->maxAvgPower_10, maxAvgPower_20:raw_data->maxAvgPower_20, maxAvgPower_30:raw_data->maxAvgPower_30, maxAvgPower_60:raw_data->maxAvgPower_60, maxAvgPower_120:raw_data->maxAvgPower_120, maxAvgPower_300:raw_data->maxAvgPower_300, maxAvgPower_600:raw_data->maxAvgPower_600, maxAvgPower_1200:raw_data->maxAvgPower_1200, maxAvgPower_1800:raw_data->maxAvgPower_1800, maxAvgPower_3600:raw_data->maxAvgPower_3600, hrTimeInZone_1:raw_data->hrTimeInZone_1, hrTimeInZone_2:raw_data->hrTimeInZone_2, hrTimeInZone_3:raw_data->hrTimeInZone_3, hrTimeInZone_4:raw_data->hrTimeInZone_4, hrTimeInZone_5:raw_data->hrTimeInZone_5, startLatitude:raw_data->startLatitude, manufacturer:raw_data->manufacturer, duration:raw_data->duration, avgPower:raw_data->avgPower, normPower:raw_data->normPower, averageBikingCadenceInRevPerMinute:raw_data->averageBikingCadenceInRevPerMinute',
        )
        .eq('source', 'garmin')
        .order('start_time', { ascending: true })
        .limit(3000),
    );

    // De-dupe the Strava+Garmin copies of the same ride (same day + duration),
    // preferring the copy that has power data.
    const byKey = new Map<string, RideSummary>();

    for (const a of data ?? []) {
      if (!a.start_time || !isRide(a.sport_type)) continue;
      const rd = a as Record<string, any>; // aliased raw_data keys (Garmin)
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
        date: localDay(rd.startTimeLocal ?? a.start_time),
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
    // Surface as 503 (not 200-empty) so the client retries instead of showing a
    // misleading "not enough data" empty state.
    console.error('athlete-os cycling:', err);
    res.status(503).json({ rides: [] });
  }
}
