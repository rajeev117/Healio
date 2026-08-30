// ─────────────────────────────────────────────────────────────────────────────
// Creates the first admin portal login user.
//
// RUN (from the healio-admin folder so it can read .env.local):
//   node ../supabase/create-admin-user.mjs
//
// Or pass custom email/password:
//   node ../supabase/create-admin-user.mjs you@email.com yourpassword
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load env from healio-admin/.env.local (cwd) or fall back to hardcoded
function readEnv() {
  try {
    const txt = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    const env = {};
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
      if (m) env[m[1]] = m[2].trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = readEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL || 'https://tzbncemosvmocuwjzezy.supabase.co';
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found. Run this from the healio-admin folder.');
  process.exit(1);
}

const email = process.argv[2] || 'admin@healio.in';
const password = process.argv[3] || 'admin123';

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { role: 'super_admin', name: 'Super Admin' },
});

if (error) {
  if (error.message?.includes('already')) {
    console.log(`ℹ️  User ${email} already exists — you can log in with it.`);
  } else {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ Admin user created!');
  console.log('   Email:   ', email);
  console.log('   Password:', password);
  console.log('   User ID: ', data.user.id);
  console.log('\nLog in at http://localhost:3000/login');
}
