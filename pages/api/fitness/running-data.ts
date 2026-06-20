import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';

const RUNNING_TYPES = [
  // Strava
  'Run', 'TrailRun', 'VirtualRun',
  // Garmin (typeKey format)
  'running', 'treadmill_running', 'trail_running', 'track_running', 'indoor_running', 'virtual_run',
];

type ResponseData = {
  monthly: MonthlyData[];
  daily: MileageLog[];
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
  if (req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  try {
    const { data, error } = await getFitnessSupabase()
      .from('activities')
      .select('start_time, distance_meters')
      .in('sport_type', RUNNING_TYPES)
      .not('distance_meters', 'is', null)
      .order('start_time', { ascending: true });

    if (error) throw error;

    const monthlyMap: Record<string, { value: number; year: number; month: number }> = {};
    const dailyMap: Record<string, number> = {};

    for (const activity of data ?? []) {
      const d = new Date(activity.start_time);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1;
      const day = activity.start_time.slice(0, 10);
      const km = (activity.distance_meters as number) / 1000;

      const key = `${year}-${month}`;
      if (!monthlyMap[key]) monthlyMap[key] = { value: 0, year, month };
      monthlyMap[key].value += km;

      dailyMap[day] = (dailyMap[day] ?? 0) + km;
    }

    const monthly: MonthlyData[] = Object.values(monthlyMap)
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map(({ value, year, month }) => ({ date: String(month), value, year }));

    const daily: MileageLog[] = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));

    res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ monthly, daily });
  } catch (err) {
    console.error('fitness running-data:', err);
    res.status(200).json({ monthly: [], daily: [] });
  }
}
