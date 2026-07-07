import type { NextApiRequest, NextApiResponse } from 'next';

import getFitnessSupabase from '@/lib/services/fitness-supabase';

/**
 * Strava webhook receiver. Strava pushes an event the moment an activity is
 * created/updated, so the dashboard reflects a new run within seconds instead
 * of waiting for the 6-hourly cron sync.
 *
 * GET  — subscription validation handshake (echoes hub.challenge).
 * POST — activity event: fetch the full activity detail and upsert it into the
 *        same `activities` table the sync-worker writes to (idempotent on
 *        source + source_activity_id).
 *
 * Env: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN,
 *      STRAVA_WEBHOOK_VERIFY_TOKEN, and the existing FITNESS_SUPABASE_* keys.
 */

const STRAVA_API = 'https://www.strava.com/api/v3';

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: process.env.STRAVA_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

// Mirror of the sync-worker's normalizeStrava → DB row mapping so the webhook
// and the cron write identical shapes. raw_data holds the full detail object
// (best_efforts, splits, laps…) that the Athlete OS APIs read.
function toRow(a: any) {
  return {
    source: 'strava',
    source_activity_id: String(a.id),
    name: a.name ?? null,
    sport_type: a.sport_type ?? a.type ?? null,
    start_time: a.start_date,
    duration_seconds: a.moving_time ?? null,
    elapsed_seconds: a.elapsed_time ?? null,
    distance_meters: a.distance ?? null,
    elevation_gain_meters: a.total_elevation_gain ?? null,
    elev_high_meters: a.elev_high ?? null,
    elev_low_meters: a.elev_low ?? null,
    avg_heart_rate: a.average_heartrate ?? null,
    max_heart_rate: a.max_heartrate ?? null,
    avg_pace_seconds_per_km: a.distance && a.moving_time ? a.moving_time / (a.distance / 1000) : null,
    avg_speed_meters_per_second: a.average_speed ?? null,
    max_speed_meters_per_second: a.max_speed ?? null,
    avg_cadence: a.average_cadence ?? null,
    avg_watts: a.average_watts ?? null,
    max_watts: a.max_watts ?? null,
    weighted_avg_watts: a.weighted_average_watts ?? null,
    kilojoules: a.kilojoules ?? null,
    calories: a.calories ?? null,
    suffer_score: a.suffer_score ?? null,
    device_name: a.device_name ?? null,
    description: a.description ?? null,
    pr_count: a.pr_count ?? null,
    achievement_count: a.achievement_count ?? null,
    start_latlng: Array.isArray(a.start_latlng) && a.start_latlng.length === 2 ? a.start_latlng : null,
    end_latlng: Array.isArray(a.end_latlng) && a.end_latlng.length === 2 ? a.end_latlng : null,
    segment_efforts: Array.isArray(a.segment_efforts) ? a.segment_efforts : null,
    splits_metric: Array.isArray(a.splits_metric) ? a.splits_metric : null,
    laps: Array.isArray(a.laps) ? a.laps : null,
    raw_data: a,
  };
}

async function ingestActivity(objectId: number | string) {
  const token = await getAccessToken();
  const res = await fetch(`${STRAVA_API}/activities/${objectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // 404 = not ours / not visible; nothing to do.
  if (!res.ok) {
    console.error(`strava webhook: detail fetch ${objectId} failed ${res.status}`);
    return;
  }
  const detail = await res.json();
  const { error } = await getFitnessSupabase()
    .from('activities')
    .upsert(toRow(detail), { onConflict: 'source,source_activity_id' });
  if (error) console.error('strava webhook: upsert error', error);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // --- Subscription validation handshake ---
  if (req.method === 'GET') {
    const mode = first(req.query['hub.mode']);
    const token = first(req.query['hub.verify_token']);
    const challenge = first(req.query['hub.challenge']);
    if (mode === 'subscribe' && token && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).json({ 'hub.challenge': challenge });
    }
    return res.status(403).json({ error: 'verification failed' });
  }

  // --- Event notifications ---
  if (req.method === 'POST') {
    const event = req.body ?? {};
    try {
      if (event.object_type === 'activity') {
        if (event.aspect_type === 'create' || event.aspect_type === 'update') {
          await ingestActivity(event.object_id);
        } else if (event.aspect_type === 'delete') {
          await getFitnessSupabase()
            .from('activities')
            .delete()
            .match({ source: 'strava', source_activity_id: String(event.object_id) });
        }
      }
    } catch (err) {
      // Swallow — we still 200 so Strava doesn't retry/disable the subscription.
      console.error('strava webhook error:', err);
    }
    return res.status(200).json({ received: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).end();
}
