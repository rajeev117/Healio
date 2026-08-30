// ─────────────────────────────────────────────────────────────────────────────
// Active profile — which family member (or the account owner) the app is
// currently acting as. Same pattern as the _localCancelled cache in
// ApiService.js: an in-memory value backed by AsyncStorage, readable
// synchronously by plain modules (ApiService) and reactively by React
// (ActiveProfileContext) without prop-drilling it through every screen.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@healio_active_profile';

export const SELF_PROFILE = { type: 'self', id: null, name: null, relation: null };

/**
 * Who an order/booking is being raised for — the selected family member when
 * one is active, otherwise the account holder. Used on provider-facing queues.
 */
export function displayPatientName(profile, user) {
  if (profile && profile.type !== 'self' && profile.name) return profile.name;
  const meta = user?.user_metadata || {};
  return meta.full_name || meta.name || user?.phone || 'Healio patient';
}

let _current = SELF_PROFILE;
const _listeners = new Set();

export async function loadActiveProfile() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) _current = JSON.parse(raw);
  } catch (_) {}
  return _current;
}

// Synchronous read for non-React callers (ApiService, careFlow, etc).
// Safe to call before loadActiveProfile() resolves — just returns "self"
// until the persisted value is loaded.
export function getActiveProfile() {
  return _current;
}

export function getActiveFamilyMemberId() {
  return _current?.type === 'family' ? _current.id : null;
}

export async function setActiveProfile(profile) {
  _current = profile || SELF_PROFILE;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(_current)); } catch (_) {}
  _listeners.forEach((fn) => fn(_current));
  return _current;
}

export function subscribeActiveProfile(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── family_member_id scoping helpers ────────────────────────────────────────
// migration-030 adds family_member_id to appointments/health_records/
// lab_orders/pharmacy_orders/prescriptions. If it hasn't been run yet, any
// filter or insert referencing that column 42703s. These two helpers let
// every call site scope-then-gracefully-degrade instead of silently
// returning empty data (which is exactly what happened before — appointments
// disappeared app-wide because the query's `error` was never checked).
export function scopeByFamily(query, familyId) {
  return familyId ? query.eq('family_member_id', familyId) : query.is('family_member_id', null);
}

export function isMissingFamilyColumn(error) {
  if (!error) return false;
  return error.code === '42703' || /family_member_id/i.test(error.message || '');
}

// buildBaseQuery: () => a fresh, unscoped Supabase query builder (must be a
// factory, not a builder instance — once awaited a builder is consumed).
export async function fetchWithFamilyFallback(buildBaseQuery, familyId) {
  const { data, error } = await scopeByFamily(buildBaseQuery(), familyId);
  if (error && isMissingFamilyColumn(error)) {
    const retry = await buildBaseQuery();
    return retry.data || [];
  }
  if (error) console.warn('[fetchWithFamilyFallback]', error.message);
  return data || [];
}
