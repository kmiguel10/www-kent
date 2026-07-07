#!/usr/bin/env node
/**
 * Manage the Strava push (webhook) subscription.
 *
 * Strava allows exactly ONE subscription per application. On `create`, Strava
 * immediately calls our callback URL with a GET validation challenge, so the
 * endpoint must already be deployed with STRAVA_WEBHOOK_VERIFY_TOKEN set.
 *
 * Usage (env: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_WEBHOOK_VERIFY_TOKEN):
 *   node scripts/strava-webhook.mjs view
 *   CALLBACK_URL=https://kentmiguel.com/api/strava/webhook node scripts/strava-webhook.mjs create
 *   node scripts/strava-webhook.mjs delete <id>
 */

const BASE = 'https://www.strava.com/api/v3/push_subscriptions';
const id = process.env.STRAVA_CLIENT_ID;
const secret = process.env.STRAVA_CLIENT_SECRET;
const verify = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

if (!id || !secret) {
  console.error('Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in env.');
  process.exit(1);
}

const cmd = process.argv[2] ?? 'view';

async function view() {
  const res = await fetch(`${BASE}?client_id=${id}&client_secret=${secret}`);
  const body = await res.json();
  console.log('Current subscription(s):', JSON.stringify(body, null, 2));
}

async function create() {
  const callback = process.env.CALLBACK_URL;
  if (!callback) { console.error('Set CALLBACK_URL, e.g. https://kentmiguel.com/api/strava/webhook'); process.exit(1); }
  if (!verify) { console.error('Set STRAVA_WEBHOOK_VERIFY_TOKEN (must match the value in Vercel).'); process.exit(1); }
  const form = new URLSearchParams({
    client_id: id,
    client_secret: secret,
    callback_url: callback,
    verify_token: verify,
  });
  const res = await fetch(BASE, { method: 'POST', body: form });
  const body = await res.json();
  if (res.ok) console.log('✅ Subscription created:', JSON.stringify(body, null, 2));
  else console.error(`❌ Create failed (${res.status}):`, JSON.stringify(body, null, 2));
}

async function del() {
  const subId = process.argv[3];
  if (!subId) { console.error('Usage: strava-webhook.mjs delete <id>  (run `view` to find it)'); process.exit(1); }
  const res = await fetch(`${BASE}/${subId}?client_id=${id}&client_secret=${secret}`, { method: 'DELETE' });
  if (res.status === 204) console.log(`✅ Deleted subscription ${subId}`);
  else console.error(`❌ Delete failed (${res.status}):`, await res.text());
}

const actions = { view, create, delete: del };
const fn = actions[cmd];
if (!fn) { console.error(`Unknown command "${cmd}". Use: view | create | delete <id>`); process.exit(1); }
fn().catch((e) => { console.error(e); process.exit(1); });
