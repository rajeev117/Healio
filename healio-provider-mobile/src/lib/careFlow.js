// ─────────────────────────────────────────────────────────────────────────────
// Connected care flow helpers — doctor → lab → pharmacy.
//
// One shared place for: uploading a file to Supabase Storage, creating a
// clinical record / lab order / pharmacy order, and reporting results back.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';
import { bookSlot } from './schedule';
import { uploadLocalFile } from './storage';

// migration-030 (patient app's family-profile feature) adds family_member_id
// to health_records/prescriptions/lab_orders/pharmacy_orders. If it hasn't
// been run on this Supabase project yet, an insert that includes that key
// 42703s outright — regardless of the value. Retry without the key instead
// of failing the whole referral/upload.
function isMissingFamilyColumn(error) {
  if (!error) return false;
  return error.code === '42703' || /family_member_id/i.test(error.message || '');
}
async function insertWithFamilyFallback(table, row) {
  let { error } = await supabase.from(table).insert(row);
  if (error && isMissingFamilyColumn(error)) {
    const { family_member_id, ...withoutFamily } = row;
    ({ error } = await supabase.from(table).insert(withoutFamily));
  }
  return { error };
}

// Upload a picked file (image or document) to a public bucket.
// `asset` is the object returned by expo-image-picker / expo-document-picker:
//   { uri, name?, mimeType? }
// Returns the public URL string, or throws.
export async function uploadFile(bucket, asset, prefix = '') {
  const uri = asset.uri;
  const ext = (asset.name?.split('.').pop() || asset.mimeType?.split('/').pop() || 'jpg').toLowerCase();
  const path = `${prefix ? prefix + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // Read the local file as base64 and upload the raw bytes. fetch(uri).blob()
  // throws on RN/Hermes ("Creating blobs from 'ArrayBuffer'…"). See lib/storage.js.
  await uploadLocalFile(bucket, path, uri, asset.mimeType || `image/${ext}`, { upsert: true });

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Resolve the logged-in staff member's row id + org id (for provenance).
async function resolveStaffContext() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { staffId: null, orgId: null };

  const { data: staffRow } = await supabase
    .from('staff').select('id, organisation_id').eq('user_id', user.id).maybeSingle();
  if (staffRow) return { staffId: staffRow.id, orgId: staffRow.organisation_id };

  const { data: orgRow } = await supabase
    .from('organisations').select('id').eq('admin_user_id', user.id).maybeSingle();
  return { staffId: null, orgId: orgRow?.id || null };
}

// If the patient was acting as a family member when they booked, the new
// lab/pharmacy order or clinical document must stay attached to that same
// family member — otherwise it would silently show up under the account
// owner's profile instead. Looks it up off the originating appointment.
async function resolveFamilyMemberId(appointmentId) {
  if (!appointmentId) return null;
  const { data } = await supabase
    .from('appointments').select('family_member_id').eq('id', appointmentId).maybeSingle();
  return data?.family_member_id || null;
}

// Doctor uploads a prescription/clinical document for a patient.
export async function uploadClinicalDocument({ patientId, fileUrl, title = 'Prescription', type = 'prescription', appointmentId = null }) {
  const { staffId, orgId } = await resolveStaffContext();
  if (!orgId) throw new Error('No hospital context. Please re-login.');
  const familyMemberId = await resolveFamilyMemberId(appointmentId);

  const { error } = await insertWithFamilyFallback('health_records', {
    patient_id: patientId,
    family_member_id: familyMemberId,
    organisation_id: orgId,
    appointment_id: appointmentId,
    created_by_staff_id: staffId,
    type,
    title,
    file_url: fileUrl,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { ok: true };
}

// Doctor uploads a photo/PDF prescription. Saves to the SAME prescriptions
// table the hospital uses + mirrors into health_records for the patient app.
export async function savePrescriptionDocument({ patientId, fileUrl, title = 'Prescription', appointmentId = null }) {
  const { staffId, orgId } = await resolveStaffContext();
  if (!orgId) throw new Error('No hospital context. Please re-login.');
  // No appointmentId passed in (e.g. uploaded outside a visit) → fall back to
  // the patient's latest appointment so the right family member gets tagged.
  const appt = appointmentId ? { id: appointmentId } : await getLatestAppointment(patientId);
  const familyMemberId = await resolveFamilyMemberId(appt?.id);

  // prescriptions.doctor_staff_id is NOT NULL → only insert there when the
  // uploader is a doctor (has a staff id).
  if (staffId) {
    const { error } = await insertWithFamilyFallback('prescriptions', {
      patient_id:      patientId,
      family_member_id: familyMemberId,
      doctor_staff_id: staffId,
      organisation_id: orgId,
      medicines:       [],
      instructions:    title,
      file_url:        fileUrl,
    });
    if (error) throw error;
  }

  // Mirror into the patient's records so it appears in their app immediately.
  await insertWithFamilyFallback('health_records', {
    patient_id:      patientId,
    family_member_id: familyMemberId,
    organisation_id: orgId,
    appointment_id:  appt?.id || null,
    created_by_staff_id: staffId,
    type:            'prescription',
    title,
    file_url:        fileUrl,
    recorded_at:     new Date().toISOString(),
  });

  return { ok: true };
}

// List the labs available at the doctor's hospital, grouped by department.
// Returns [{ id, name, department }] — one entry per active lab technician.
export async function getHospitalLabs() {
  const { orgId } = await resolveStaffContext();
  if (!orgId) return [];
  const { data } = await supabase
    .from('staff')
    .select('id, name, department')
    .eq('organisation_id', orgId)
    .eq('role', 'lab_technician')
    .eq('status', 'active');
  return (data || []).map(s => ({ id: s.id, name: s.name, department: s.department || 'General Lab' }));
}

// ── Scan-time: staff picks a date range, then a specific visit ─────────────
// Doctor's job ends at prescription upload. When the patient walks to lab or
// pharmacy and scans their QR, staff sees a date-range picker → a list of
// that patient's appointments at THIS hospital → taps the relevant visit.
// Nothing is created until they tap — no flags, no pre-existing queue entry.

export async function fetchPatientVisitsForRange(patientId, fromDate) {
  const { orgId } = await resolveStaffContext();
  if (!orgId) throw new Error('No hospital context. Please re-login.');

  const { data, error } = await supabase
    .from('appointments')
    .select('id, scheduled_at, status, type')
    .eq('patient_id', patientId)
    .eq('organisation_id', orgId)
    .gte('scheduled_at', fromDate.toISOString())
    .neq('status', 'cancelled')
    .neq('status', 'suggested')
    .order('scheduled_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createLabOrderFromVisit({ patientId, appointmentId }) {
  const { orgId } = await resolveStaffContext();
  if (!orgId) throw new Error('No hospital context. Please re-login.');
  const labs = await getHospitalLabs();
  const defaultLab = labs[0] || null;
  await sendToLab({
    patientId,
    appointmentId,
    department: defaultLab?.department || null,
    labStaffId: defaultLab?.id || null,
  });
  return fetchLabOrderForDetail(patientId, orgId);
}

export async function createPharmacyOrderFromVisit({ patientId, appointmentId }) {
  const { orgId } = await resolveStaffContext();
  if (!orgId) throw new Error('No hospital context. Please re-login.');
  await sendToPharmacy({ patientId, appointmentId });
  return fetchPharmacyOrderForDetail(patientId, orgId);
}

// Re-fetch the just-created order shaped exactly like LabHome.js's/
// PharmacyHome.js's own mapping, so ScanPatient.js can navigate straight to
// the detail screen with everything it needs already filled in.
async function fetchLabOrderForDetail(patientId, orgId) {
  const { data: o } = await supabase
    .from('lab_orders')
    .select('id, order_id, status, tests, department, collection_type, collection_address, scheduled_date, scheduled_time, created_at, patient_id, profiles!patient_id(name, phone), staff!requested_by_staff_id(name)')
    .eq('patient_id', patientId).eq('organisation_id', orgId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!o) return null;
  return {
    id: o.id, dbId: o.id, patientId: o.patient_id, orderId: o.order_id || '#LAB',
    patient: o.profiles?.name || '—', phone: o.profiles?.phone || '', doctor: o.staff?.name || '',
    department: o.department || '', tests: Array.isArray(o.tests) ? o.tests : [],
    isHomeCollection: o.collection_type === 'home', collectionAddress: o.collection_address || '',
    scheduledDate: o.scheduled_date || '', scheduledTime: o.scheduled_time || '',
    status: 'Pending', rawStatus: o.status,
    time: new Date(o.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

async function fetchPharmacyOrderForDetail(patientId, orgId) {
  const { data: o } = await supabase
    .from('pharmacy_orders')
    .select('id, order_id, status, items, delivery_address, delivery_slot, created_at, patient_id, profiles!patient_id(name, phone), staff!requested_by_staff_id(name)')
    .eq('patient_id', patientId).eq('organisation_id', orgId)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!o) return null;
  return {
    id: o.id, dbId: o.id, patientId: o.patient_id, orderId: o.order_id || '#PH',
    patient: o.profiles?.name || '—', phone: o.profiles?.phone || '', doctor: o.staff?.name || '',
    deliveryAddress: o.delivery_address || '', deliverySlot: o.delivery_slot || '',
    items: Array.isArray(o.items) ? o.items.map(it => `${it.name}${it.quantity ? ' x ' + it.quantity : ''}`) : [],
    medicines: Array.isArray(o.items) ? o.items.map(it => `${it.name}${it.quantity ? ' x ' + it.quantity : ''}`) : [],
    rawStatus: o.status, status: 'Pending',
    time: new Date(o.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  };
}

// Creates the lab_orders row. Called by createLabOrderFromVisit at scan time.
// `tests` defaults to [] — the simplified flow has the lab read tests off the
// uploaded prescription image; the param is kept so structured lists still work.
//
// `organisationId` overrides which organisation fulfils the order. A hospital
// doctor omits it and the order lands in their own hospital's lab; an
// individual doctor has no lab, so they pass the external lab they picked.
export async function sendToLab({ patientId, tests = [], department = null, labStaffId = null, appointmentId = null, organisationId = null }) {
  const { staffId, orgId } = await resolveStaffContext();
  const targetOrgId = organisationId || orgId;
  if (!targetOrgId) throw new Error('No hospital context. Please re-login.');
  // No appointmentId passed in → fall back to the patient's latest appointment
  // so the order stays attached to the right family member.
  const appt = appointmentId ? { id: appointmentId } : await getLatestAppointment(patientId);
  const familyMemberId = await resolveFamilyMemberId(appt?.id);

  const testArray = tests.map(t => ({ name: t }));
  const { error } = await insertWithFamilyFallback('lab_orders', {
    order_id: `LAB-${Date.now().toString().slice(-6)}`,
    patient_id: patientId,
    family_member_id: familyMemberId,
    organisation_id: targetOrgId,
    requested_by_staff_id: staffId,
    appointment_id: appt?.id || null,
    department,                       // which lab the patient must visit
    tests: testArray,
    collection_type: 'walkin',
    scheduled_date: new Date().toISOString().slice(0, 10),
    scheduled_time: 'Walk-in',
    status: 'pending',
  });
  if (error) throw error;
  return { ok: true };
}

// Doctor sends the patient to the pharmacy for medicines.
// `organisationId` overrides the fulfilling pharmacy — see sendToLab above.
export async function sendToPharmacy({ patientId, medicines = [], appointmentId = null, organisationId = null }) {
  const { staffId, orgId } = await resolveStaffContext();
  const targetOrgId = organisationId || orgId;
  if (!targetOrgId) throw new Error('No hospital context. Please re-login.');
  const appt = appointmentId ? { id: appointmentId } : await getLatestAppointment(patientId);
  const familyMemberId = await resolveFamilyMemberId(appt?.id);

  const items = medicines.map(m => ({ name: m }));
  const { error } = await insertWithFamilyFallback('pharmacy_orders', {
    order_id: `RX-${Date.now().toString().slice(-6)}`,
    patient_id: patientId,
    family_member_id: familyMemberId,
    organisation_id: targetOrgId,
    requested_by_staff_id: staffId,
    appointment_id: appt?.id || null,
    items,
    status: 'pending',
  });
  if (error) throw error;
  return { ok: true };
}

// Lab uploads the report (or just a note) and marks the order ready.
// Also mirrors the report into health_records so the patient sees it in their
// Records screen, not just in Order Tracking.
export async function reportLabResult({ orderId, reportUrl = null, note = null }) {
  const patch = { status: 'completed', updated_at: new Date().toISOString() };
  if (reportUrl) patch.report_url = reportUrl;
  if (note) patch.result_note = note;

  const { data: order, error: ue } = await supabase
    .from('lab_orders')
    .update(patch)
    .eq('id', orderId)
    .select('patient_id, organisation_id, appointment_id, family_member_id, department')
    .maybeSingle();
  if (ue) throw ue;

  if (reportUrl && order) {
    await insertWithFamilyFallback('health_records', {
      patient_id:       order.patient_id,
      family_member_id: order.family_member_id || null,
      organisation_id:  order.organisation_id,
      appointment_id:   order.appointment_id || null,
      type:             'lab_result',
      title:            `Lab Report${order.department ? ' — ' + order.department : ''}`,
      file_url:         reportUrl,
      notes:            note || null,
      recorded_at:      new Date().toISOString(),
    });
  }

  return { ok: true };
}

// Fetch the patient's most recent appointment (for follow-up context).
export async function getLatestAppointment(patientId) {
  const { data } = await supabase
    .from('appointments')
    .select('id, doctor_staff_id, organisation_id, type, fee, status, scheduled_at')
    .eq('patient_id', patientId)
    .order('scheduled_at', { ascending: false })
    .limit(1).maybeSingle();
  return data || null;
}

// The patient's current open appointment at a given hospital. Used to tag a
// walk-in lab / pharmacy checkout so its bill / report links to THIS visit —
// which is how the RMP who booked the appointment sees those documents. Returns
// null when there's no active booking (a pure walk-in nobody booked).
export async function getActiveAppointmentId(patientId, orgId) {
  if (!patientId || !orgId) return null;
  const { data } = await supabase
    .from('appointments')
    .select('id')
    .eq('patient_id', patientId)
    .eq('organisation_id', orgId)
    .in('status', ['scheduled', 'in_progress', 'suggested'])
    .order('scheduled_at', { ascending: false })
    .limit(1).maybeSingle();
  return data?.id || null;
}

// Doctor marks the patient's current visit complete.
export async function markVisitComplete({ patientId }) {
  const { data } = await supabase
    .from('appointments')
    .select('id')
    .eq('patient_id', patientId)
    .in('status', ['scheduled', 'in_progress', 'suggested'])
    .order('scheduled_at', { ascending: false })
    .limit(1).maybeSingle();
  if (!data) throw new Error('No active appointment to complete for this patient.');
  const { error } = await supabase
    .from('appointments').update({ status: 'completed' }).eq('id', data.id);
  if (error) throw error;
  return { ok: true };
}

// Hospital assigns a doctor to a checked-in (or existing) patient. Goes through
// the hospital_assign_doctor RPC (migration-045): org-side RLS has no INSERT on
// appointments, and the RPC enforces the consent gate (QR check-in in the last
// 24h, or a prior appointment here). Creates a confirmed walk-in appointment
// that shows up in the patient and doctor apps immediately.
export async function assignDoctor({ patientId, doctorStaffId, scheduledAt = null, type = 'clinic' }) {
  const { data, error } = await supabase.rpc('hospital_assign_doctor', {
    p_patient: patientId,
    p_doctor_staff: doctorStaffId,
    p_scheduled_at: scheduledAt || new Date().toISOString(),
    p_type: type,
  });
  if (error) throw error;
  return data; // new appointment id
}

// Doctor suggests a follow-up visit date. Creates a new appointment with the
// same doctor/hospital in status 'suggested' so the patient is notified to
// accept or change it (re-uses the existing suggested-time flow).
// A suggested follow-up occupies the slot while the patient decides, so it is
// created through book_appointment_slot like any other booking — the old
// direct insert had no capacity check and could offer a time that was already
// taken. The row lands as 'scheduled'; suggestFollowUp then marks it
// 'suggested' so the patient sees it as an offer rather than a confirmed visit.
export async function suggestFollowUp({ patientId, isoDateTime }) {
  const latest = await getLatestAppointment(patientId);
  const { staffId, orgId } = await resolveStaffContext();
  const doctorStaffId  = latest?.doctor_staff_id || staffId;
  const organisationId = latest?.organisation_id || orgId;
  if (!doctorStaffId || !organisationId) {
    throw new Error('Cannot create follow-up — missing doctor/hospital context.');
  }

  const appointmentId = await bookSlot({
    doctorStaffId,
    at:           isoDateTime,
    type:         latest?.type || 'clinic',
    patientId,
    fee:          latest?.fee || 0,
    platformFee:  0,
  });

  const { error } = await supabase
    .from('appointments')
    .update({ status: 'suggested' })
    .eq('id', appointmentId);
  if (error) throw error;

  return { ok: true, id: appointmentId };
}

// Pharmacy marks the order dispensed.
export async function completePharmacyOrder({ orderId, note = null }) {
  const patch = { status: 'completed', updated_at: new Date().toISOString() };
  if (note) patch.dispense_note = note;
  const { error } = await supabase.from('pharmacy_orders').update(patch).eq('id', orderId);
  if (error) throw error;
  return { ok: true };
}
