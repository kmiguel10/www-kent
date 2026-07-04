import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import type {
  FitnessWhoopRecovery,
  FitnessWhoopSleep,
  FitnessWhoopCycle,
} from '@/pages/fitness';

interface WhoopResponse {
  recovery: FitnessWhoopRecovery[];
  sleep: FitnessWhoopSleep[];
  cycles: FitnessWhoopCycle[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WhoopResponse>,
) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const supabase = getFitnessSupabase();

    const [recoveryResult, sleepResult, cyclesResult] = await Promise.all([
      supabase
        .from('whoop_recovery')
        .select('cycle_id, date, recovery_score, resting_heart_rate, hrv_rmssd_milli, spo2_percentage, skin_temp_celsius')
        .order('date', { ascending: false }),
      supabase
        .from('whoop_sleep')
        .select('sleep_id, date, nap, sleep_performance_percentage, sleep_efficiency_percentage, sleep_consistency_percentage, respiratory_rate, in_bed_minutes, awake_minutes, rem_minutes, slow_wave_minutes, light_minutes')
        .order('date', { ascending: false }),
      supabase
        .from('whoop_cycles')
        .select('cycle_id, date, strain, kilojoules, avg_heart_rate, max_heart_rate')
        .order('date', { ascending: false }),
    ]);

    if (recoveryResult.error) throw recoveryResult.error;
    if (sleepResult.error) throw sleepResult.error;
    if (cyclesResult.error) throw cyclesResult.error;

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({
      recovery: (recoveryResult.data as FitnessWhoopRecovery[]) ?? [],
      sleep: (sleepResult.data as FitnessWhoopSleep[]) ?? [],
      cycles: (cyclesResult.data as FitnessWhoopCycle[]) ?? [],
    });
  } catch (err) {
    console.error('fitness whoop:', err);
    res.status(200).json({ recovery: [], sleep: [], cycles: [] });
  }
}
