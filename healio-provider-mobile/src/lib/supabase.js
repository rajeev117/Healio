import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY, COUNTRY_CODE, DEV_PASSWORD } from './env';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const phoneToEmail = (phone) =>
  `${COUNTRY_CODE}${String(phone).replace(/\D/g, '')}@healio.app`;

// Exported alias used by store.js when creating doctor staff accounts
export const emailFromPhone = phoneToEmail;

// What kind of account, if any, this phone already belongs to.
//
// Runs BEFORE the user has an authenticated session, so a plain SELECT against
// staff / organisations / rmps / profiles would be silently filtered to nothing
// by RLS (they only allow reads once auth.uid() already matches — chicken-and-
// egg on a fresh login). phone_account_kind() is a SECURITY DEFINER RPC
// (migration-052) that bypasses RLS for this one narrow check, same pattern as
// claim_account().
//
// Returns { kind, unknown }:
//   kind    'doctor' | 'staff' | 'provider' | 'rmp' | 'patient', null if free
//   unknown true when the RPC couldn't be reached — the caller must then fail
//           OPEN on login (never block a real user) and fail SAFE on signup
//           (let auth.signUp be the authority on duplicates).
// Bucket → the i18n key naming it in "already registered as …" copy.
export const ACCOUNT_KIND_LABEL_KEY = {
  doctor:   'account_kind_doctor',
  staff:    'account_kind_staff',
  provider: 'account_kind_provider',
  rmp:      'account_kind_rmp',
  patient:  'account_kind_patient',
};

export const accountKindLabelKey = (kind) => ACCOUNT_KIND_LABEL_KEY[kind] || 'account_kind_other';

export async function lookupPhoneAccount(phone) {
  const normalised = `+${COUNTRY_CODE}${String(phone).replace(/\D/g, '')}`;
  try {
    const { data, error } = await supabase.rpc('phone_account_kind', { p_phone: normalised });
    if (error) throw error;
    return { kind: data || null, unknown: false };
  } catch (_) {
    return { kind: null, unknown: true };
  }
}

/** Back-compat boolean wrapper. Fails open, as login always has. */
export async function phoneExistsInDB(phone) {
  const { kind, unknown } = await lookupPhoneAccount(phone);
  return unknown ? true : !!kind;
}

// Register a phone that is NOT supposed to have an account yet.
//
// Never falls back to signing in. One auth email is derived per phone and every
// account shares DEV_PASSWORD, so a sign-in fallback would hand the caller
// somebody else's account and let a signup screen graft a second role onto it.
// A 422 "User already registered" is therefore the answer, not an error to
// route around — it is auth's own authoritative duplicate check, and it holds
// even when migration-052 hasn't been applied.
export async function signUpNewPhone(phone) {
  const email = phoneToEmail(phone);
  const { data, error } = await supabase.auth.signUp({ email, password: DEV_PASSWORD });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    const alreadyRegistered =
      msg.includes('already') || msg.includes('registered') || msg.includes('exists');
    return { user: null, session: null, alreadyRegistered, error };
  }
  return {
    user: data.user || null,
    // null when Supabase Auth has "Confirm email" ON — the caller can't write
    // its profile row without a session, so it must say so rather than fail
    // deeper with an opaque RLS rejection.
    session: data.session || null,
    alreadyRegistered: false,
    error: null,
  };
}

// Sign in (or create) the test account for this phone, then link to DB record.
//
// Creating on miss is load-bearing for a first-time staff login: a doctor added
// by a hospital admin has a `staff` row but no auth user until they first log
// in. Callers MUST therefore gate this behind lookupPhoneAccount() — it is not
// safe to call for a number that isn't registered.
export async function signInWithPhone(phone) {
  const email = phoneToEmail(phone);

  // Try sign-in first; create account if it doesn't exist yet
  let { error } = await supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD });
  if (error) {
    const { error: signUpError } = await supabase.auth.signUp({ email, password: DEV_PASSWORD });
    if (signUpError) return { error: signUpError };
  }

  // Link this auth user to their staff / org record.
  // MUST go through claim_account() (SECURITY DEFINER) — a direct UPDATE is
  // blocked by RLS, because a doctor/staff member can't update their own row
  // until user_id is set (chicken-and-egg). The function matches by email.
  try { await supabase.rpc('claim_account'); } catch (_) { /* migration-008 may be pending */ }

  return { error: null };
}

export const signOut = () => supabase.auth.signOut();
export const getSession = () => supabase.auth.getSession();

// ── QR check-in ───────────────────────────────────────────────────────────────
// Resolve a scanned QR token → the patient's basic identity if valid & unexpired
// (migration 044: phone/DOB/gender/blood group ride along for admission forms).
// Returns null if the token is invalid/expired. The token only reveals identity;
// actual records are still gated by RLS (org ↔ patient relationship).
export async function resolveQrToken(rawValue) {
  const token = String(rawValue || '').replace(/^healio:patient:/, '').trim();
  if (!token) return null;
  const { data, error } = await supabase.rpc('resolve_qr_token', { p_token: token });
  if (error) { console.warn('resolveQrToken', error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    patientId: row.patient_id,
    patientName: row.patient_name,
    phone: row.phone || null,
    dateOfBirth: row.date_of_birth || null,
    gender: row.gender || null,
    bloodGroup: row.blood_group || null,
  };
}

// organisations.type → the role string that picks a module.
//
// A 'diagnostic', 'pharmacy' or 'clinic' organisation is a STANDALONE provider —
// it has no hospital behind it, so its people get the independent modules rather
// than the hospital-affiliated ones. A 'hospital' keeps the role it already had.
// Note the enum value is 'diagnostic', not 'lab' (schema.sql:26), and 'clinic'
// is what an individual/solo doctor's own one-person organisation is typed as.
const roleForOrgType = (type, fallback) =>
  type === 'diagnostic' ? 'independent_lab'
  : type === 'pharmacy' ? 'independent_pharmacy'
  : type === 'clinic'   ? 'independent_doctor'
  : fallback;

// Whether the admin panel has switched this provider off.
//
// organisations.status has existed since the first schema and the admin panel
// has always written 'suspended' to it, but resolveRole() never selected it —
// so "suspend" in admin did nothing and the provider kept trading. This is the
// read side of that switch (migration-061).
//
// 'pending' is a provider whose onboarding was never approved; they are not
// suspended, but they must not reach a dashboard either.
export function accessVerdict(orgStatus, staffStatus) {
  if (orgStatus === 'suspended') {
    return { blocked: true, blockedReason: 'suspended_org' };
  }
  if (orgStatus === 'pending') {
    return { blocked: true, blockedReason: 'pending_org' };
  }
  if (staffStatus === 'inactive') {
    return { blocked: true, blockedReason: 'suspended_staff' };
  }
  return { blocked: false, blockedReason: null };
}

// Human-readable copy for each block reason, keyed for i18n.
export const BLOCK_MESSAGE_KEY = {
  suspended_org:   'blocked_suspended_org',
  pending_org:     'blocked_pending_org',
  suspended_staff: 'blocked_suspended_staff',
  suspended_rmp:   'blocked_suspended_rmp',
  banned_patient:  'blocked_banned_patient',
};

// Resolve who the logged-in user is.
export async function resolveRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const fromStaff = (s) => ({
    userId: user.id, staffId: s.staff_id, name: s.name,
    // A lab technician hired BY an independent lab still belongs in the
    // independent module — the org's type outranks the staff role.
    role: roleForOrgType(s.organisations?.type, s.role),
    hospitalId: s.organisation_id,
    hospitalName: s.organisations?.name || 'Hospital',
    hospitalCity: s.organisations?.city || '',
    orgType: s.organisations?.type || 'hospital',
    // Suspension cascades: an individual doctor / lab / pharmacy switched off
    // in the admin panel takes their whole staff list down with them.
    ...accessVerdict(s.organisations?.status, s.status),
  });
  const fromOrg = (o) => ({
    userId: user.id, staffId: null, name: o.name,
    role: roleForOrgType(o.type, 'hospital_admin'),
    hospitalId: o.id,
    hospitalName: o.name, hospitalCity: o.city || '',
    orgType: o.type || 'hospital',
    ...accessVerdict(o.status, null),
  });

  // 1. Linked staff
  const { data: s1 } = await supabase
    .from('staff')
    .select('id, staff_id, name, role, status, organisation_id, organisations(name, city, type, status)')
    .eq('user_id', user.id).maybeSingle();
  if (s1) return fromStaff(s1);

  // 2. Linked org admin
  const { data: o1 } = await supabase
    .from('organisations').select('id, name, city, type, status')
    .eq('admin_user_id', user.id).maybeSingle();
  if (o1) return fromOrg(o1);

  // 3. Match by email (first login before linking)
  const { data: orgByEmail } = await supabase
    .from('organisations').select('id, name, city, type, status')
    .eq('admin_email', user.email).maybeSingle();
  if (orgByEmail) {
    await supabase.from('organisations').update({ admin_user_id: user.id }).eq('id', orgByEmail.id);
    return fromOrg(orgByEmail);
  }

  const { data: staffByEmail } = await supabase
    .from('staff')
    .select('id, staff_id, name, role, status, organisation_id, organisations(name, city, type, status)')
    .eq('email', user.email).maybeSingle();
  if (staffByEmail) {
    await supabase.from('staff').update({ user_id: user.id }).eq('id', staffByEmail.id);
    return fromStaff(staffByEmail);
  }

  // 4. RMP (registered medical practitioner)
  // select('*') so email/address (migration-037) surface when present without
  // breaking login on projects where that migration hasn't been applied yet.
  const { data: rmp } = await supabase
    .from('rmps')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (rmp) {
    return {
      userId: user.id,
      staffId: null,
      name: rmp.name || user.email,
      role: 'rmp',
      hospitalId: null,
      hospitalName: null,
      hospitalCity: null,
      rmpPhone: rmp.phone,
      rmpVillage: rmp.village,
      rmpAddress: rmp.address || null,
      rmpEmail: rmp.email || null,
      rmpRegNo: rmp.reg_no,
      rmpStatus: rmp.status,
      blocked: rmp.status === 'suspended',
      blockedReason: rmp.status === 'suspended' ? 'suspended_rmp' : null,
    };
  }

  // 5. Patient (consumer) — a profiles row for this auth user and no provider
  // role above. Checked last so staff/org/rmp always take precedence when a
  // phone/user happens to have both a provider and a patient identity.
  const { data: prof } = await supabase
    .from('profiles')
    .select('id, name, status')
    .eq('id', user.id)
    .maybeSingle();
  if (prof) {
    return {
      userId: user.id,
      staffId: null,
      name: prof.name || user.email,
      role: 'patient',
      hospitalId: null,
      hospitalName: null,
      hospitalCity: null,
      // The admin panel's "ban patient" writes profiles.status = 'banned'.
      blocked: prof.status === 'banned',
      blockedReason: prof.status === 'banned' ? 'banned_patient' : null,
    };
  }

  return null;
}
