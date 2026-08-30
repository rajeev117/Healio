// ─────────────────────────────────────────────────────────────────────────────
// Supabase client for helio-patient-mobile
// ─────────────────────────────────────────────────────────────────────────────
import 'react-native-url-polyfill/auto';
import { DEV_PASSWORD, COUNTRY_CODE } from './env';
// Unified app: reuse the ONE shared Supabase client from the app shell so the
// patient module and the provider roles share a single auth session. Creating a
// second createClient() here would spawn a second GoTrue instance fighting over
// the same AsyncStorage session key.
import { supabase } from '../../../lib/supabase';

export { supabase };

// Derive the deterministic test-account email from a 10-digit phone
export const emailFromPhone = (phone) =>
  `${COUNTRY_CODE}${String(phone).replace(/\D/g, '')}@healio.app`;

// ── Dev login ────────────────────────────────────────────────────────────────
// The OTP screen calls this with the entered phone and ANY code. We ignore the
// code and sign into the test account using the shared dev password.
export const devSignIn = (phone) =>
  withTimeout(supabase.auth.signInWithPassword({ email: emailFromPhone(phone), password: DEV_PASSWORD }));

// Wraps a promise with a timeout.
// 30 s is generous enough for Supabase rate-limit throttling on a slow connection.
const withTimeout = (promise, ms = 30000) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(
        new Error('Supabase is not responding. This usually means:\n• Too many login attempts — wait 1–2 minutes and try again.\n• Or go to Supabase → Auth → Settings → turn OFF "Enable email confirmations".')
      ), ms)
    ),
  ]);

// Sign up first, fall back to sign-in for existing accounts.
//
// WHY sign-up first (not sign-in first):
//   • signInWithPassword with wrong/missing account returns 400 immediately —
//     but Supabase RATE-LIMITS the auth endpoint after many 400s, causing it
//     to hang for 30+ seconds (the "Request timed out" the user sees).
//   • signUp for a new account succeeds immediately with no rate-limit.
//   • signUp for an existing account fails fast with "User already registered",
//     THEN we call signIn which now succeeds on first try.
//   Result: new users → 1 call. Existing users → 2 calls. No rate-limit spiral.
//
// Requires Supabase Auth → Settings → "Enable email confirmations" = OFF.
export async function signUpOrIn(phone) {
  const email = emailFromPhone(phone);

  // ── Step 1: attempt signUp ────────────────────────────────────────────────
  const signUp = await withTimeout(
    supabase.auth.signUp({ email, password: DEV_PASSWORD })
  );

  // signUp succeeded → brand new account
  if (!signUp.error) {
    const session = signUp.data.session;

    if (!session) {
      // session is null when "Confirm email" is ON in Supabase settings
      return {
        session: null, isNew: true,
        error: new Error(
          'Account was created but a session could not be started.\n\n' +
          'Fix → Supabase Dashboard → Authentication → Settings → ' +
          'turn OFF "Enable email confirmations" → Save.'
        ),
      };
    }

    // Create profile row so admin panel and getUser() see this user
    if (session.user) {
      await supabase.from('profiles').upsert(
        { id: session.user.id, phone: `+91${String(phone).replace(/\D/g, '')}`, email, status: 'active' },
        { onConflict: 'id' },
      );
    }
    return { session, isNew: true, error: null };
  }

  // ── Step 2: signUp failed — try signIn (handles existing accounts) ────────
  // Common signUp failure reasons:
  //   422 "User already registered"  → account exists, signIn will work
  //   422 "Signups not allowed"      → signup disabled in Supabase settings
  //   422 password too weak          → change DEV_PASSWORD
  const signIn = await withTimeout(
    supabase.auth.signInWithPassword({ email, password: DEV_PASSWORD })
  );
  if (!signIn.error) return { session: signIn.data.session, isNew: false, error: null };

  // Both failed. Decide which error is more useful to show.
  // "User already registered" means signIn failed for another reason → show signIn error.
  // Any other signUp failure (signup disabled, bad password) → show signUp error.
  const upMsg  = (signUp.error?.message ?? '').toLowerCase();
  const isAlreadyRegistered = upMsg.includes('already') || upMsg.includes('registered') || upMsg.includes('exist');

  let finalError;
  if (isAlreadyRegistered) {
    finalError = new Error(signIn.error?.message ?? 'Could not sign in. Please try again.');
  } else {
    // e.g. "Signups not allowed for this instance" — tell user exactly what to fix
    finalError = new Error(
      (signUp.error?.message ?? 'Signup failed.') +
      '\n\nFix → Supabase Dashboard → Authentication → Settings → enable signups.'
    );
  }
  return { session: null, isNew: false, error: finalError };
}

// Upsert the logged-in user's profile (used by ProfileSetup after signup).
export async function saveMyProfile(fields) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: new Error('No session') };
  return supabase.from('profiles').upsert(
    { id: user.id, status: 'active', ...fields },
    { onConflict: 'id' },
  );
}

export const signOut = () => supabase.auth.signOut();
export const getSession = () => supabase.auth.getSession();
export const onAuthStateChange = (cb) => supabase.auth.onAuthStateChange(cb);

// ── QR check-in ───────────────────────────────────────────────────────────────
// Ask the server for a fresh short-lived QR token (rotates every call, 90s TTL).
// Returns the token string the QR should encode, or null on failure.
export async function issueQrToken() {
  const { data, error } = await supabase.rpc('issue_qr_token');
  if (error) { console.warn('issueQrToken', error.message); return null; }
  return data; // UUID string
}

// ── Scan a PROVIDER QR ─────────────────────────────────────────────────────────
// Providers show a static `healio:<kind>:<id>` code. Parse it and resolve the
// kind + id to a small public identity record via resolve_provider_qr
// (migration-041, v2 in 043 adds kind 'doctor' + org_id).
// Returns { id, kind, name, subtitle, orgId } or null.
export async function resolveProviderQr(rawValue) {
  const m = String(rawValue || '').trim().match(/^healio:(hospital|doctor|lab|pharmacy|rmp):(.+)$/);
  if (!m) return null;
  const [, kind, id] = m;
  const { data, error } = await supabase.rpc('resolve_provider_qr', { p_kind: kind, p_id: id.trim() });
  if (error) { console.warn('resolveProviderQr', error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { id: row.id, kind: row.kind, name: row.name, subtitle: row.subtitle, orgId: row.org_id || null };
}

// Record a check-in after scanning a provider QR (migration-043): the scan is
// the patient's consent to share their identity with that organisation, and it
// puts them in the hospital's Patients queue. Returns true on success.
export async function createProviderCheckin({ orgId, kind, doctorStaffId = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !orgId) return false;
  const { error } = await supabase.from('qr_checkins').insert({
    patient_id: user.id,
    organisation_id: orgId,
    doctor_staff_id: doctorStaffId,
    kind,
  });
  if (error) { console.warn('createProviderCheckin', error.message); return false; }
  return true;
}
