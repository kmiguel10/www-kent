import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import type { ZoneSession } from '@/lib/athlete-os/services/zones/zoneAnalysis';

/**
 * Per-session HR-zone data for the Zone Discipline panel. Returns each run/ride
 * that has usable heart-rate data, with Garmin's time-in-zone bins plus avg/max
 * HR so the client can render either mode (Garmin zones or custom max-HR).
 * Read-only; independent of the /fitness dashboard.
 */

interface ZonesPayload {
  sessions: ZoneSession[];
  /** Observed max HR across all activities — a sensible default for max-HR mode. */
  observedMaxHr: number | null;
}

const localDay = (iso: string): string => iso.slice(0, 10);
const isRun = (t: string | null) => /run|treadmill/i.test(t ?? '');
const isRide = (t: string | null) => /ride|cycl|bik|spin|road_biking|virtual_ride/i.test(t ?? '');

export default async function handler(req: NextApiRequest, res: NextApiResponse<ZonesPayload>) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const { data, error } = await getFitnessSupabase()
      .from('activities')
      .select('sport_type, start_time, duration_seconds, avg_heart_rate, max_heart_rate, raw_data')
      .order('start_time', { ascending: false })
      .limit(2000);
    if (error) throw error;

    const sessions: ZoneSession[] = [];
    let observedMaxHr = 0;

    for (const a of data ?? []) {
      if (!a.start_time) continue;
      const run = isRun(a.sport_type);
      const ride = isRide(a.sport_type);
      if (!run && !ride) continue;

      const rd = a.raw_data ?? {};
      const zoneSecs = [1, 2, 3, 4, 5].map((i) => Number(rd[`hrTimeInZone_${i}`]) || 0);
      const hasZones = zoneSecs.reduce((s, v) => s + v, 0) > 0;
      const avgHr = a.avg_heart_rate ?? null;
      // Skip sessions with neither zone data nor an average HR — nothing to show.
      if (!hasZones && avgHr == null) continue;

      if (a.max_heart_rate && a.max_heart_rate > observedMaxHr) observedMaxHr = a.max_heart_rate;

      sessions.push({
        date: localDay(a.start_time),
        sport: run ? 'run' : 'ride',
        durationSeconds: a.duration_seconds ?? 0,
        avgHr,
        maxHr: a.max_heart_rate ?? null,
        zoneSecs,
      });
    }

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ sessions, observedMaxHr: observedMaxHr || null });
  } catch (err) {
    console.error('athlete-os zones:', err);
    res.status(200).json({ sessions: [], observedMaxHr: null });
  }
}
