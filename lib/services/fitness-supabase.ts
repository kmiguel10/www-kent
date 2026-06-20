import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — defers createClient until first call so missing env vars
// at build time don't crash module evaluation.
let _client: SupabaseClient | null = null;

function getFitnessSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.FITNESS_SUPABASE_URL;
    const key = process.env.FITNESS_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('FITNESS_SUPABASE_URL and FITNESS_SUPABASE_SERVICE_ROLE_KEY must be set');
    _client = createClient(url, key);
  }
  return _client;
}

export default getFitnessSupabase;
