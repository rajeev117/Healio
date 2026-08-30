// ─────────────────────────────────────────────────────────────────────────────
// Supabase BROWSER client for healio-admin
// Uses the publishable (anon) key — safe to expose. Used for admin auth/session.
// Privileged data operations go through server actions (see lib/api.ts) which
// use the service-role client in lib/supabase-admin.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
