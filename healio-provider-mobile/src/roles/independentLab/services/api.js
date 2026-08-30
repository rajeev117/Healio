// ─────────────────────────────────────────────────────────────────────────────
// Independent lab data layer.
//
// Deliberately does NOT use src/lib/careFlow.js. careFlow assumes a hospital:
// getHospitalLabs() looks for lab_technician staff rows (an independent lab has
// none), and fetchPatientVisitsForRange() requires appointments at this org (an
// independent lab never has any). Its resolveStaffContext() also falls back to
// admin_user_id, so its "No hospital context" guard passes and the failure would
// surface as a raw RLS rejection instead of something we can handle.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import {
  LAB_ORDERS,
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

/** Quote couldn't reach the DB (migration-050 not applied) — keep it on device. */
export const saveDraft = (draft) => saveLocalDraft('lab', draft);
export const listDrafts = () => listLocalDrafts('lab');
export const dropDraft = (id) => removeLocalDraft('lab', id);

export const fetchEarnings = (orgId) => fetchProviderEarnings({ table: LAB_ORDERS, orgId });
export const fetchOrders = (orgId, limit) => fetchProviderOrders({ table: LAB_ORDERS, orgId, limit });
export const fetchPatients = (orgId) => fetchProviderPatients({ table: LAB_ORDERS, orgId });
export const fetchOrder = (id) => fetchOrderById({ table: LAB_ORDERS, id });
export const fetchCheckins = (orgId) => fetchOrgCheckins(orgId, { kind: 'lab' });
export const subscribeCheckins = subscribeOrgCheckins;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Counts for the Home stat strip, from the effective (DB + local) stage. */
export function stageCounts(orders, stageMap = {}) {
  const c = { toPrice: 0, processing: 0, ready: 0 };
  orders.forEach((o) => {
    const s = resolveStage(o, stageMap[o.id]);
    if (s === 'to_price' || s === 'quoted') c.toPrice += 1;
    else if (s === 'accepted' || s === 'collected' || s === 'processing') c.processing += 1;
    else if (s === 'ready') c.ready += 1;
  });
  return c;
}

/**
 * Create or update the order behind a quote.
 *
 * `tests` is [{ name, price, turnaround }] — the shape lab_orders.tests already
 * documents (schema.sql:385). order_id is left out on purpose: trg_lab_order_id
 * (schema.sql:830) generates it BEFORE INSERT.
 */
export async function saveQuote({
  orderId = null,
  orgId,
  patientId,
  tests = [],
  total = 0,
  homeCollection = false,
  collectionAddress = null,
  slotLabel = 'Walk-in',
  homeVisitFee = 0,
}) {
  const row = {
    organisation_id: orgId,
    patient_id: patientId,
    tests,
    total: Number(total) || 0,
    collection_type: homeCollection ? 'home' : 'walkin',
    collection_address: homeCollection ? collectionAddress : null,
    home_visit_fee: homeCollection ? Number(homeVisitFee) || 0 : 0,
    scheduled_date: today(),
    scheduled_time: slotLabel || 'Walk-in',
    status: 'pending',
  };

  const result = await writeOrder(() =>
    orderId
      ? supabase.from(LAB_ORDERS).update(row).eq('id', orderId).select('id').single()
      : supabase.from(LAB_ORDERS).insert(row).select('id').single(),
  );

  if (result.data?.id) await setStage(result.data.id, 'quoted');
  return result; // { data, denied, error }
}

/** Move an order along. Writes the coarse status, remembers the fine stage. */
export async function advanceStage({ orderId, stage }) {
  const status = dbStatusFor(stage);
  const result = await writeOrder(() =>
    supabase
      .from(LAB_ORDERS)
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId)
      .select('id')
      .single(),
  );
  await setStage(orderId, stage);
  return result;
}

/**
 * Attach the signed report and (optionally) push it into the patient's records
 * so it shows up in their Records screen, not just in Order Tracking.
 *
 * This is the independent equivalent of careFlow.reportLabResult — same two
 * writes, without the staff-context requirement. The health_records insert is
 * allowed for an org admin by migration-016 ("records: clinician writes").
 */
export async function publishReport({ orderId, reportUrl, note = null, shareWithPatient = true }) {
  const patch = { status: 'completed', updated_at: new Date().toISOString() };
  if (reportUrl) patch.report_url = reportUrl;
  if (note) patch.result_note = note;

  const result = await writeOrder(() =>
    supabase
      .from(LAB_ORDERS)
      .update(patch)
      .eq('id', orderId)
      .select('id, patient_id, organisation_id, appointment_id, department')
      .single(),
  );
  if (result.denied || !result.data) return result;

  await setStage(orderId, 'shared');

  if (reportUrl && shareWithPatient) {
    const order = result.data;
    const { error } = await supabase.from('health_records').insert({
      patient_id: order.patient_id,
      organisation_id: order.organisation_id,
      appointment_id: order.appointment_id || null,
      type: 'lab_result',
      title: `Lab Report${order.department ? ' — ' + order.department : ''}`,
      file_url: reportUrl,
      notes: note || null,
      recorded_at: new Date().toISOString(),
    });
    // Non-fatal: the report is on the order either way.
    if (error) console.warn('health_records mirror:', error.message);
  }

  return result;
}
