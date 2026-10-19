import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const realUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const realAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isMissingEnv = !realUrl || !realAnonKey;

// Never throw at module-evaluation time: static builds (and SSR prerendering)
// run without a populated .env.local, and a throw here would crash `next build`.
// Fall back to inert placeholders so the client module can still be imported;
// real auth/data calls will simply fail until proper env vars are supplied.
const supabaseUrl = realUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = realAnonKey || 'dummy-anon-key';

if (isMissingEnv && typeof window !== 'undefined') {
  console.warn(
    '[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Using placeholder values — auth and data calls will not work. ' +
      'Add them to fooday_frontend/.env.local (Supabase Dashboard → Project Settings → API).',
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
