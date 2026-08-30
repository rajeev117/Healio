// ─────────────────────────────────────────────────────────────────────────────
// providerData — queries shared by the independent lab and pharmacy modules.
//
// The hospital-affiliated lab/ and pharmacy/ modules each keep their own copy of
// these (they are shipped and must not regress). This file exists so the two
// independent modules don't become a third and fourth copy — the queries below
// were byte-identical across both existing modules.
//
// Everything here is org-scoped by `organisation_id` and works for an operator
// who is the organisation's admin (organisations.admin_user_id) with NO staff
// row — which is what an independent provider is. That rules out anything
// depending on my_org_id(), which resolves via the staff table only.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export const LAB_ORDERS = 'lab_orders';
export const PHARMACY_ORDERS = 'pharmacy_orders';

export const calcAge = (dob) =>
  dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

// Local calendar day as YYYY-MM-DD. The shipped modules use `created_at.slice(0,10)`,
// which is the UTC day — in IST that files every order placed between 00:00 and
// 05:30 under the previous date. Always compare through this.
const localDay = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// ── Organisation ─────────────────────────────────────────────────────────────

export async function fetchOrgInfo(orgId) {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, name, type, city, address, admin_phone')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return data;
}

// ── Orders ───────────────────────────────────────────────────────────────────

/** Every order for this provider, grouped by patient, newest first. */
export async function fetchProviderPatients({ table, orgId }) {
  if (!orgId) return [];
  const { data, error } = await supabase
    .from(table)
    .select('id, order_id, total, status, created_at, patient_id, patient:profiles!patient_id(id, name, phone, gender, date_of_birth)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const map = {};
  (data || []).forEach((order) => {
    const pid = order.patient_id;
    if (!map[pid]) {
      // The profiles embed comes back null for a patient this org has no
      // check-in for (RLS) — keep the row rather than dropping the order.
      const p = order.patient || {};
      map[pid] = {
        id: pid,
        name: p.name || '—',
        phone: p.phone || null,
        gender: p.gender || null,
        age: calcAge(p.date_of_birth),
        orders: [],
      };
    }
    map[pid].orders.push({
      id: order.id,
      orderId: order.order_id,
      total: order.total,
      status: order.status,
      created_at: order.created_at,
    });
  });
  return Object.values(map);
}

/** Flat order list, newest first — what the Home queue and stage counts read. */
export async function fetchProviderOrders({ table, orgId, limit = 50 }) {
  if (!orgId) return [];
  const { data, error } = await supabase
    .from(table)
    .select('*, patient:profiles!patient_id(id, name, phone, gender, date_of_birth)')
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((o) => ({
    ...o,
    patientName: o.patient?.name || '—',
    patientAge: calcAge(o.patient?.date_of_birth),
  }));
}

export async function fetchOrderById({ table, id }) {
  const { data, error } = await supabase
    .from(table)
    .select('*, patient:profiles!patient_id(id, name, phone, gender, date_of_birth)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return { ...data, patientName: data.patient?.name || '—', patientAge: calcAge(data.patient?.date_of_birth) };
}

// ── Earnings ─────────────────────────────────────────────────────────────────

/**
 * { today, week, month, pendingPayout, weekTrend, weekLabels }
 *
 * Same contract as the shipped fetchLabEarnings / fetchPharmacyEarnings, with
 * two fixes: the window starts at whichever of month-start / week-start is
 * earlier (the originals fetched from month-start then filtered on now-6d, so
 * on the 1st–6th "this week" silently lost the days in the previous month), and
 * day bucketing uses the local calendar day, not the UTC one.
 */
export async function fetchProviderEarnings({ table, orgId }) {
  const empty = {
    today: 0, week: 0, month: 0, pendingPayout: 0,
    weekTrend: Array(7).fill(0),
    weekLabels: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 864e5);
      return d.toLocaleDateString('en-IN', { weekday: 'short' });
    }),
  };
  if (!orgId) return empty;

  const now = new Date();
  const todayStr = localDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const from = monthStart < weekStart ? monthStart : weekStart;

  const { data, error } = await supabase
    .from(table)
    .select('total, status, created_at')
    .eq('organisation_id', orgId)
    .neq('status', 'cancelled')
    .gte('created_at', from.toISOString());
  if (error) throw error;

  const orders = data || [];
  const sum = (rows) => rows.reduce((s, o) => s + Number(o.total || 0), 0);

  const monthISO = monthStart.toISOString();
  const weekISO = weekStart.toISOString();

  const weekTrend = Array.from({ length: 7 }, (_, i) => {
    const day = localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i)));
    return sum(orders.filter((o) => localDay(o.created_at) === day));
  });
  const weekLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return d.toLocaleDateString('en-IN', { weekday: 'short' });
  });

  return {
    today: sum(orders.filter((o) => localDay(o.created_at) === todayStr)),
    week: sum(orders.filter((o) => o.created_at >= weekISO)),
    month: sum(orders.filter((o) => o.created_at >= monthISO)),
    pendingPayout: sum(orders.filter((o) => o.status === 'pending')),
    weekTrend,
    weekLabels,
  };
}

// ── Prescriptions ────────────────────────────────────────────────────────────

/**
 * The patient's prescriptions, via the consent-gated RPC from migration-043.
 *
 * Do NOT select from `prescriptions` directly here: "rx: org staff reads"
 * (migration-042) keys on my_org_id(), which is null for an independent
 * operator. It would also be the wrong query — an independent lab's referral
 * was written at someone else's hospital, so it never matches this org.
 *
 * Returns [] until the patient has scanned this provider's QR (24h window).
 */
export async function fetchCheckinPrescriptions(patientId) {
  if (!patientId) return [];
  const { data, error } = await supabase.rpc('checkin_prescriptions', { p_patient: patientId });
  if (error) {
    console.warn('checkin_prescriptions:', error.message);
    return [];
  }
  return data || [];
}

// ── Walk-in check-ins ────────────────────────────────────────────────────────

/** Patients who scanned this provider's QR recently. `kind` is 'lab' | 'pharmacy'. */
export async function fetchOrgCheckins(orgId, { kind, sinceHours = 24 } = {}) {
  if (!orgId) return [];
  const since = new Date(Date.now() - sinceHours * 3600e3).toISOString();
  let q = supabase
    .from('qr_checkins')
    .select('id, patient_id, kind, status, created_at, patient:profiles!patient_id(id, name, phone, gender, date_of_birth)')
    .eq('organisation_id', orgId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id,
    patientId: c.patient_id,
    name: c.patient?.name || '—',
    phone: c.patient?.phone || null,
    gender: c.patient?.gender || null,
    age: calcAge(c.patient?.date_of_birth),
    status: c.status,
    createdAt: c.created_at,
  }));
}

/** Live "a patient just scanned your QR" feed. Returns an unsubscribe function. */
export function subscribeOrgCheckins(orgId, onChange) {
  if (!orgId) return () => {};
  const channel = supabase
    .channel(`indie-checkins-${orgId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'qr_checkins', filter: `organisation_id=eq.${orgId}` },
      () => { try { onChange(); } catch (_) {} },
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function markCheckinHandled(id) {
  const { error } = await supabase.from('qr_checkins').update({ status: 'handled' }).eq('id', id);
  if (error) throw error;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Wrapper for every order write.
 *
 * Independent operators are org admins with no staff row. Until
 * migration-050-org-admin-order-writes.sql is applied they only hold the
 * SELECT grant from migration-004, so writes come back as Postgres 42501.
 * Rather than crash the screen, surface that as a flag the caller can show as
 * "saved on this device — sync pending" and fall back to the local
 * orderRequests store.
 */
export function isRlsDenied(error) {
  if (!error) return false;
  return error.code === '42501' || /row-level security/i.test(error.message || '');
}

export async function writeOrder(fn) {
  try {
    const { data, error } = await fn();
    if (error) {
      if (isRlsDenied(error)) return { data: null, denied: true, error };
      throw error;
    }
    return { data, denied: false, error: null };
  } catch (e) {
    if (isRlsDenied(e)) return { data: null, denied: true, error: e };
    throw e;
  }
}

// ── Local drafts (the fallback when writeOrder comes back denied) ────────────

const DRAFT_KEY = (kind) => `@healio_indie_${kind}_drafts`;

export async function listLocalDrafts(kind) {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY(kind));
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function saveLocalDraft(kind, draft) {
  const all = await listLocalDrafts(kind);
  const row = { id: draft.id || `draft_${Date.now()}`, savedAt: Date.now(), ...draft };
  const next = [row, ...all.filter((d) => d.id !== row.id)];
  try { await AsyncStorage.setItem(DRAFT_KEY(kind), JSON.stringify(next)); } catch (_) {}
  return row;
}

export async function removeLocalDraft(kind, id) {
  const all = await listLocalDrafts(kind);
  try { await AsyncStorage.setItem(DRAFT_KEY(kind), JSON.stringify(all.filter((d) => d.id !== id))); } catch (_) {}
}
