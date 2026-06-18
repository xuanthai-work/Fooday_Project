import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY in fooday_frontend/.env.local ' +
      '(copy them from Supabase Dashboard → Project Settings → API).',
  );
}

// Reuse a single client across HMR reloads in dev to avoid multiple
// GoTrue instances warning and duplicate realtime connections.
const globalForSupabase = globalThis as typeof globalThis & {
  __supabase?: SupabaseClient;
};

export const supabase =
  globalForSupabase.__supabase ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

if (typeof window !== 'undefined') {
  globalForSupabase.__supabase = supabase;
}
