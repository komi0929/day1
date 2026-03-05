import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const hasSupabase = !!(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export { hasSupabase };

/**
 * Create authenticated Supabase client with user's token
 */
export function createAuthClient(token: string) {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
