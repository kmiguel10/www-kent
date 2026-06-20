import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';

import type { FitnessActivity } from '@/pages/fitness';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FitnessActivity[]>,
) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const { data, error } = await getFitnessSupabase()
      .from('activities')
      .select(
        'id, source, name, sport_type, start_time, duration_seconds, distance_meters, elevation_gain_meters, calories, avg_heart_rate, max_heart_rate, avg_pace_seconds_per_km, raw_data',
      )
      .order('start_time', { ascending: false })
      .limit(1000);

    if (error) throw error;

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json((data as FitnessActivity[]) ?? []);
  } catch (err) {
    console.error('fitness activities:', err);
    res.status(200).json([]);
  }
}
