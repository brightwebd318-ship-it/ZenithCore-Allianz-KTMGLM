import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables from Next.js env (exposed to client side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  throw new Error(
    'CRITICAL ERROR: Supabase URL and/or Anon Key are missing. PraxDoc Medical SaaS requires a database connection to operate securely.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
