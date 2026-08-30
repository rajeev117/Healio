// ─────────────────────────────────────────────────────────────────────────────
// Independent pharmacy data layer.
//
// Deliberately does NOT use src/lib/careFlow.js — see the note in the
// independent lab's api.js. Same reasoning: careFlow assumes a hospital, and its
// resolveStaffContext() falls back to admin_user_id, so its "No hospital
// context" guard passes and a rejected write surfaces as a raw RLS error.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import {
  PHARMACY_ORDERS,
  fetchOrgInfo,
  fetchProviderEarnings,
  fetchProviderOrders,
  fetchProviderPatients,
  fetchOrderById,
  fetchCheckinPrescriptions,
  fetchOrgCheckins,
  subscribeOrgCheckins,
  markCheckinHandled,
  writeOrder,
  calcAge,
  saveLocalDraft,
  listLocalDrafts,
  removeLocalDraft,
} from '../../../lib/providerData';
import { dbStatusFor, resolveStage, getStages, setStage } from './stages';

export {
  fetchOrgInfo,
  fetchCheckinPrescriptions,
  markCheckinHandled,
  resolveStage,
  getStages,
  setStage,
  calcAge,
};

export const fetchEarnings = (orgId) => fetchProviderEarnings({ table: PHARMACY_ORDERS, orgId });
export const fetchOrders = (orgId, limit) => fetchProviderOrders({ table: PHARMACY_ORDERS, orgId, limit });
export const fetchPatients = (orgId) => fetchProviderPatients({ table: PHARMACY_ORDERS, orgId });
export const fetchOrder = (id) => fetchOrderById({ table: PHARMACY_ORDERS, id });
export const fetchCheckins = (orgId) => fetchOrgCheckins(orgId, { kind: 'pharmacy' });
export const subscribeCheckins = subscribeOrgCheckins;

/** Quote couldn't reach the DB (migration-050 not applied) — keep it on device. */
export const saveDraft = (draft) => saveLocalDraft('pharmacy', draft);
export const listDrafts = () => listLocalDrafts('pharmacy');
export const dropDraft = (id) => removeLocalDraft('pharmacy', id);

/** GST on medicines — matches GST_RATE in src/lib/orderRequests.js. */
export const GST_RATE = 0.05;

export function quoteTotals(lines, deliveryFee = 0) {
  const subtotal = lines.reduce((s, l) => s + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0);
  const gst = Math.round(subtotal * GST_RATE);
  return { subtotal, gst, deliveryFee: Number(deliveryFee) || 0, total: subtotal + gst + (Number(deliveryFee) || 0) };
}

/** Counts for the Home stat strip, from the effective (DB + local) stage. */
export function stageCounts(orders, stageMap = {}) {
  const c = { toQuote: 0, packing: 0, out: 0 };
  orders.forEach((o) => {
    const s = resolveStage(o, stageMap[o.id]);
    if (s === 'to_quote' || s === 'quoted') c.toQuote += 1;
    else if (s === 'accepted' || s === 'packing') c.packing += 1;
    else if (s === 'out') c.out += 1;
  });
  return c;
}

/**
 * Create or update the order behind a quote.
 *
 * order_id is left out on purpose: trg_pharmacy_order_id (schema.sql:829)
 * generates it BEFORE INSERT.
 */
export async function saveQuote({
  orderId = null,
  orgId,
  patientId,
  items = [],
  total = 0,
  delivery = false,
  deliveryAddress = null,
  deliverySlot = null,
  deliveryFee = 0,
}) {
  const row = {
    organisation_id: orgId,
    patient_id: patientId,
    items,
    total: Number(total) || 0,
    delivery_address: delivery ? deliveryAddress : null,
    delivery_slot: delivery ? deliverySlot : 'Counter pickup',
    delivery_fee: delivery ? Number(deliveryFee) || 0 : 0,
    status: 'pending',
  };

  const result = await writeOrder(() =>
    orderId
      ? supabase.from(PHARMACY_ORDERS).update(row).eq('id', orderId).select('id').single()
      : supabase.from(PHARMACY_ORDERS).insert(row).select('id').single(),
  );

  if (result.data?.id) await setStage(result.data.id, 'quoted');
  return result;
}

/** Move an order along. Writes the coarse status, remembers the fine stage. */
export async function advanceStage({ orderId, stage, deliveryPartner = null, note = null }) {
  const patch = { status: dbStatusFor(stage), updated_at: new Date().toISOString() };
  if (deliveryPartner) patch.delivery_partner = deliveryPartner;
  if (note) patch.dispense_note = note;

  const result = await writeOrder(() =>
    supabase.from(PHARMACY_ORDERS).update(patch).eq('id', orderId).select('id').single(),
  );
  await setStage(orderId, stage);
  return result;
}
