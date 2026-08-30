import 'server-only';
import { createClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// Supabase SERVICE-ROLE client — SERVER ONLY.
// The `import 'server-only'` guard makes the build FAIL if this is ever
// imported into a client component, so the secret key can never leak to the
// browser. Bypasses RLS — full read/write on every table.
// Only import this from server actions / route handlers.
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
