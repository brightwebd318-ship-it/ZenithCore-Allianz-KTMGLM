import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables from Next.js env (exposed to client side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase URL and/or Anon Key are missing. ZenithCore Medical SaaS will run in High-Fidelity Local Mock Mode.'
  );
}
