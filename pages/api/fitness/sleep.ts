import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';
import type { FitnessSleepRecord, FitnessRecoveryRecord } from '@/pages/fitness';

interface SleepResponse {
  sleep: FitnessSleepRecord[];
  recovery: FitnessRecoveryRecord[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SleepResponse>,
) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const supabase = getFitnessSupabase();

    const [sleepResult, recoveryResult] = await Promise.all([
      supabase
        .from('sleep_records')
        .select('id, date, sleep_start, sleep_end, duration_minutes, deep_minutes, light_minutes, rem_minutes, awake_minutes, sleep_score, sleep_stress, respiration_avg, pulse_ox_avg')
        .order('date', { ascending: false })
        .limit(365),
      supabase
        .from('recovery_records')
        .select('id, date, resting_hr, hrv, hrv_status, body_battery_high, body_battery_low, stress_avg, training_readiness, recovery_time_hours')
        .order('date', { ascending: false })
        .limit(365),
    ]);

    if (sleepResult.error) throw sleepResult.error;
    if (recoveryResult.error) throw recoveryResult.error;

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({
      sleep: (sleepResult.data as FitnessSleepRecord[]) ?? [],
      recovery: (recoveryResult.data as FitnessRecoveryRecord[]) ?? [],
    });
  } catch (err) {
    console.error('fitness sleep:', err);
    res.status(200).json({ sleep: [], recovery: [] });
  }
}
