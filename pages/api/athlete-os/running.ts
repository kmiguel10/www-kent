import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import type { RunSummary } from '@/lib/athlete-os/services/aerobic/runningAnalysis';

/**
 * Per-run summaries for the running Zone 2 analysis: pace, HR, HR time-in-zone,
 * and a treadmill flag. Read-only; isolated from /fitness.
 */

const localDay = (iso: string): string => iso.slice(0, 10);
const isRun = (t: string | null) => /run|treadmill/i.test(t ?? '');

export default async function handler(req: NextApiRequest, res: NextApiResponse<{ runs: RunSummary[] }>) {
  if (req.method !== 'GET') { res.status(405).end(); return; }

  try {
    const { data, error } = await getFitnessSupabase()
      .from('activities')
      .select('sport_type, name, start_time, duration_seconds, distance_meters, avg_heart_rate, max_heart_rate, avg_pace_seconds_per_km, raw_data')
      .order('start_time', { ascending: true })
      .limit(3000);
    if (error) throw error;

    // De-dupe Strava+Garmin copies of the same run (same day + duration),
    // preferring the copy that carries HR time-in-zone data.
    const byKey = new Map<string, RunSummary>();

    for (const a of data ?? []) {
      if (!a.start_time || !isRun(a.sport_type)) continue;
      const rd = a.raw_data ?? {};
      const hrZoneSecs = [1, 2, 3, 4, 5].map((i) => Number(rd[`hrTimeInZone_${i}`]) || 0);
      const treadmill = /treadmill/i.test(a.sport_type ?? '') || /treadmill|indoor/i.test(a.name ?? '');

      const run: RunSummary = {
        date: localDay(a.start_time),
        name: a.name ?? 'Run',
        treadmill,
        durationSeconds: a.duration_seconds ?? 0,
        distanceMeters: a.distance_meters ?? null,
        avgHr: a.avg_heart_rate ?? null,
        maxHr: a.max_heart_rate ?? null,
        paceSecPerKm: a.avg_pace_seconds_per_km ?? null,
        hrZoneSecs,
      };

      const key = `${run.date}|${Math.round(run.durationSeconds / 60)}`;
      const existing = byKey.get(key);
      const hasZones = hrZoneSecs.reduce((s, v) => s + v, 0) > 0;
      const existingZones = existing ? existing.hrZoneSecs.reduce((s, v) => s + v, 0) > 0 : false;
      if (!existing || (hasZones && !existingZones)) byKey.set(key, run);
    }

    const runs = Array.from(byKey.values()).sort((a, b) => a.date.localeCompare(b.date));
    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ runs });
  } catch (err) {
    console.error('athlete-os running:', err);
    res.status(200).json({ runs: [] });
  }
}
