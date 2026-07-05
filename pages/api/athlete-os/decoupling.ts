import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';

/**
 * Aerobic decoupling per ride/run, computed from Strava per-second streams by
 * the sync-worker (ride_decoupling table). Read-only. Returns empty gracefully
 * if the table isn't populated yet.
 */

export interface DecouplingRow {
  date: string;
  sport: 'ride' | 'run';
  name: string | null;
  hasPower: boolean;
  avgOutput: number | null; // watts (ride) or m/s (run)
  avgHr: number | null;
  durationMovingSec: number | null;
  decouplingPct: number | null;
  aerobic: boolean | null;
  driftSeries: { t: number; ef: number }[] | null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<{ rows: DecouplingRow[] }>) {
  if (req.method !== 'GET') { res.status(405).end(); return; }
  try {
    const { data, error } = await getFitnessSupabase()
      .from('ride_decoupling')
      .select('date, sport, name, has_power, avg_output, avg_hr, duration_moving_sec, decoupling_pct, aerobic, drift_series, status')
      .eq('status', 'ok')
      .order('date', { ascending: true });
    if (error) throw error;

    const rows: DecouplingRow[] = (data ?? []).map((r) => ({
      date: r.date,
      sport: r.sport,
      name: r.name,
      hasPower: !!r.has_power,
      avgOutput: r.avg_output != null ? Number(r.avg_output) : null,
      avgHr: r.avg_hr != null ? Number(r.avg_hr) : null,
      durationMovingSec: r.duration_moving_sec ?? null,
      decouplingPct: r.decoupling_pct != null ? Number(r.decoupling_pct) : null,
      aerobic: r.aerobic,
      driftSeries: r.drift_series ?? null,
    }));

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ rows });
  } catch (err) {
    // Table missing / not populated yet — return empty so the UI shows "pending".
    res.status(200).json({ rows: [] });
  }
}
