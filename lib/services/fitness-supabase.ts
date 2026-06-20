import { createClient } from '@supabase/supabase-js';

// Server-side only client pointing to the strava-garmin-mcp Supabase database.
// Add FITNESS_SUPABASE_URL and FITNESS_SUPABASE_SERVICE_ROLE_KEY to Vercel env vars.
const fitnessSupabase = createClient(
  process.env.FITNESS_SUPABASE_URL!,
  process.env.FITNESS_SUPABASE_SERVICE_ROLE_KEY!,
);

export default fitnessSupabase;
