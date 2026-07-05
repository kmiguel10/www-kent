import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';

/**
 * Manual bodyweight log. GET lists entries; POST upserts one { date, weightLb }.
 * There is no native weight source synced, so this lets weight be entered by
 * hand to feed power-to-weight (W/kg) and body-composition tracking.
 *
 * Note: no auth on this personal site, so the POST is world-writable — fine for
 * a personal dashboard, but not for multi-user use.
 */

export interface WeightEntry { date: string; weightLb: number; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = getFitnessSupabase();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('weight_log')
        .select('date, weight_lb')
        .order('date', { ascending: true });
      if (error) throw error;
      res.setHeader('cache-control', 'no-store');
      res.status(200).json({ entries: (data ?? []).map((r) => ({ date: r.date, weightLb: Number(r.weight_lb) })) });
    } catch (err) {
      console.error('weight GET:', err);
      res.status(200).json({ entries: [] });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { date, weightLb } = req.body ?? {};
      const w = Number(weightLb);
      if (!date || !Number.isFinite(w) || w < 50 || w > 500) {
        res.status(400).json({ error: 'Provide a valid date and weightLb (50–500).' });
        return;
      }
      const { error } = await supabase
        .from('weight_log')
        .upsert({ date, weight_lb: w }, { onConflict: 'date' });
      if (error) throw error;
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('weight POST:', err);
      res.status(500).json({ error: 'Failed to save.' });
    }
    return;
  }

  res.status(405).end();
}
