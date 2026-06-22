import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';

export type StressDayRecord = {
  date: string;
  stress_avg: number;
  body_battery_high: number | null;
  body_battery_low: number | null;
  hrv: number | null;
  resting_hr: number | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<StressDayRecord[]>) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const year = new Date().getFullYear();

    const { data, error } = await getFitnessSupabase()
      .from('recovery_records')
      .select('date, stress_avg, body_battery_high, body_battery_low, hrv, resting_hr')
      .not('stress_avg', 'is', null)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('date', { ascending: true });

    if (error) throw error;

    const result: StressDayRecord[] = (data ?? []).map((r) => ({
      date: r.date,
      stress_avg: r.stress_avg as number,
      body_battery_high: r.body_battery_high as number | null,
      body_battery_low: r.body_battery_low as number | null,
      hrv: r.hrv as number | null,
      resting_hr: r.resting_hr as number | null,
    }));

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json(result);
  } catch (err) {
    console.error('fitness stress-data:', err);
    res.status(200).json([]);
  }
}
