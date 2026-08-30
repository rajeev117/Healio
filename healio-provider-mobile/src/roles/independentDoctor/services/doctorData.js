// ─────────────────────────────────────────────────────────────────────────────
// doctorData — Supabase data layer for the INDIVIDUAL doctor portal.
//
// The hospital-affiliated sibling is src/roles/doctor/services/doctorData.js.
// That one assumes a `staff` row someone else created inside a hospital. This
// one assumes the doctor IS the organisation: a one-person org of type 'clinic'
// with a single `staff` row for themselves (migration-057).
//
// Everything downstream — appointments.doctor_staff_id, qr_checkins,
// doctor_schedules, the patient app's doctor list — keys off that staff row, so
// resolving it is the first thing every screen does.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import { fetchSessions, fetchAvailability, fetchConflicts } from '../../../lib/schedule';

// Cache the resolved staff row for this session so every screen doesn't re-query.
let _staffCtx = null;

const EMPTY_CTX = {
  staffId: null, orgId: null, name: null, specialty: null, department: null,
  rating: null, clinic: null, city: null,
  experienceYears: null, qualifications: '', bio: '', services: [],
};

// select('*') so this works before AND after migration-054 adds the
// public-profile columns (experience_years, qualifications, bio, services).
const STAFF_SELECT = '*, organisations(name, city, type)';

async function readStaffRow(userId) {
  const { data } = await supabase
    .from('staff')
    .select(STAFF_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

// Resolve the doctor's staff row id + their own clinic org id.
//
// Three linking paths, tried in order, because an individual doctor's first
// login happens BEFORE any staff row exists:
//   1. already linked            — the steady state
//   2. claim_individual_doctor() — creates the self staff row inside their
//                                  approved clinic org (migration-057)
//   3. claim_account()           — the generic email-match link, for a doctor
//                                  whose row was made the old way (008)
export async function resolveDoctorContext() {
  if (_staffCtx) return _staffCtx;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return EMPTY_CTX;

  let staff = await readStaffRow(user.id);

  if (!staff) {
    // The individual-doctor path: mint (or adopt) the self staff row.
    try { await supabase.rpc('claim_individual_doctor'); } catch (_) {}
    staff = await readStaffRow(user.id);
  }
  if (!staff) {
    // Pre-057 fallback — also covers a row created by a hospital admin.
    try { await supabase.rpc('claim_account'); } catch (_) {}
    staff = await readStaffRow(user.id);
  }
  if (!staff) return EMPTY_CTX;

  _staffCtx = {
    staffId:    staff.id,
    orgId:      staff.organisation_id,
    name:       staff.name || null,
    specialty:  staff.specialty || null,
    department: staff.department || null,
    rating:     staff.rating || null,
    // The practice name, not a hospital — an individual doctor's org IS them.
    clinic:     staff.organisations?.name || null,
    city:       staff.organisations?.city || null,
    // Public profile (shown to patients) — editable from the doctor's Profile
    experienceYears: staff.experience_years != null ? staff.experience_years : null,
    qualifications:  staff.qualifications || '',
    bio:             staff.bio || '',
    services:        Array.isArray(staff.services) ? staff.services : [],
  };
  return _staffCtx;
}

// Clear the cache on logout so the next doctor doesn't inherit this one's id.
export function clearDoctorContext() { _staffCtx = null; }

// ── Public profile ────────────────────────────────────────────────────────────
// The fields patients see on the booking page. Requires migration-054 (columns
// + the "staff: updates own profile" RLS policy).
export async function updateDoctorPublicProfile({ experienceYears, qualifications, bio, services, specialty }) {
  const { staffId } = await resolveDoctorContext();
  if (!staffId) throw new Error('No doctor context. Please re-login.');
  const patch = {
    experience_years: experienceYears != null && String(experienceYears).trim() !== '' ? Number(experienceYears) : null,
    qualifications:   (qualifications || '').trim() || null,
    bio:              (bio || '').trim() || null,
    services:         Array.isArray(services)
      ? services
      : String(services || '').split(',').map(s => s.trim()).filter(Boolean),
  };
  // A solo doctor sets their own specialty; a hospital doctor's is set for them.
  if (specialty !== undefined) patch.specialty = (specialty || '').trim() || null;

  const { error } = await supabase.from('staff').update(patch).eq('id', staffId);
  if (error) throw error;
  _staffCtx = null; // re-read fresh values on next resolve
  return { ok: true };
}

// ── Weekly availability ───────────────────────────────────────────────────────
// Multiple rows = multiple daily sessions (e.g. morning + evening clinic).
// Shared with the hospital-doctor module and the patient booking screen via
// lib/schedule, so all three read one definition.
export async function fetchDoctorSchedules() {
  const { staffId } = await resolveDoctorContext();
  return staffId ? fetchSessions(staffId) : [];
}

// The generated slot grid — sessions minus leave/blocks, with live booked
// counts. This is the same doctor_availability() a patient books against.
export async function fetchDoctorAvailability(days = 7, fromIso = null) {
  const { staffId } = await resolveDoctorContext();
  return fetchAvailability(staffId, fromIso, days);
}

// Appointments a schedule change has stranded — kept, never auto-cancelled.
export async function fetchDoctorScheduleConflicts(days = 60) {
  const { staffId } = await resolveDoctorContext();
  return staffId ? fetchConflicts(staffId, days) : [];
}

// ── QR check-ins ──────────────────────────────────────────────────────────────
// Patients who scanned THIS doctor's QR (migration-043). The scan shares the
// patient's identity with the doctor, so the profile join works here.
export async function fetchDoctorCheckins() {
  const { staffId } = await resolveDoctorContext();
  if (!staffId) return [];
  const { data, error } = await supabase
    .from('qr_checkins')
    .select('id, created_at, patient:profiles!patient_id(id, name, phone, gender, date_of_birth)')
    .eq('doctor_staff_id', staffId)
    .eq('kind', 'doctor')
    .eq('status', 'new')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) { console.warn('[independentDoctor] fetchDoctorCheckins', error.message); return []; }
  return data || [];
}

export async function dismissDoctorCheckin(id) {
  await supabase.from('qr_checkins').update({ status: 'handled' }).eq('id', id);
}

// ── Lab catalog ───────────────────────────────────────────────────────────────
// An individual doctor has no lab of their own, so this is the platform default
// catalog (migration-055) — the menu of tests they can refer a patient for.
// Returns [] pre-migration so callers keep their local fallback.
export async function fetchLabTestCatalog() {
  try {
    const { data, error } = await supabase
      .from('lab_tests')
      .select('id, name, price, popular')
      .is('organisation_id', null)
      .order('popular', { ascending: false })
      .order('name');
    if (error) throw error;
    return data || [];
  } catch (e) {
    return [];
  }
}

// ── Referral targets ──────────────────────────────────────────────────────────
// Who an individual doctor can send a patient to. Unlike a hospital doctor —
// who refers into their own building — a solo practitioner refers OUT, so this
// is the same public catalog the RMP app books against (migration-051): both
// standalone labs/pharmacies and hospital-bound units, as one list.
export async function fetchReferralFacilities(kind) {
  try {
    const { data, error } = await supabase.rpc('rmp_service_facilities', { p_kind: kind });
    if (error) throw error;
    return (data || []).map(f => ({
      id: f.id,
      organisationId: f.organisation_id,
      // "Apollo Hospital · Pathology Lab" for a unit inside a hospital,
      // just the provider's name for a standalone one.
      name: f.unit ? `${f.org_name} · ${f.unit}` : f.org_name,
      orgName: f.org_name,
      unit: f.unit || null,
      source: f.source,
      city: f.city || '',
      address: f.address || '',
    }));
  } catch (e) {
    // migration-051 not applied — still offer the standalone providers.
    const type = kind === 'lab' ? 'diagnostic' : 'pharmacy';
    const { data } = await supabase
      .from('organisations')
      .select('id, name, city, address')
      .eq('type', type)
      .eq('status', 'active')
      .order('name');
    return (data || []).map(o => ({
      id: o.id, organisationId: o.id, name: o.name, orgName: o.name,
      unit: null, source: 'independent', city: o.city || '', address: o.address || '',
    }));
  }
}

const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } };
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// DB appointment status → the UI status vocabulary the screens render.
//
// An individual doctor has no front desk: nobody confirms bookings on their
// behalf, so unlike the hospital module this one DOES surface 'pending' — that
// is a patient waiting on the doctor themselves to accept.
const DB_TO_UI = {
  pending:     'pending',      // waiting for THIS doctor to accept
  suggested:   'pending',      // doctor proposed a time, waiting on the patient
  scheduled:   'confirmed',    // accepted, upcoming
  in_progress: 'confirmed',    // consultation ongoing
  completed:   'completed',
  cancelled:   'cancelled',
};

// UI action → DB status to persist.
export const UI_TO_DB = {
  confirmed: 'scheduled',
  completed: 'completed',
  cancelled: 'cancelled',
};

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday()   { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

// Map one DB appointment row → the shape the screens render.
function mapAppointment(a) {
  const when = a.scheduled_at ? new Date(a.scheduled_at) : null;
  const isToday = when ? (when >= startOfToday() && when <= endOfToday()) : false;
  const isPast  = when ? (when < startOfToday()) : false;
  return {
    id: a.id,
    patientId:       a.patient?.id || a.patient_id || null,
    organisationId:  a.organisation_id || null,
    patientName:     a.patient?.name || 'Patient',
    patientAge:      a.patient?.age != null ? a.patient.age : '—',
    patientGender:   a.patient?.gender || '—',
    patientPhone:    a.patient?.phone || '',
    date:    isToday ? 'Today' : fmtDate(a.scheduled_at),
    time:    fmtTime(a.scheduled_at),
    rawStatus: a.status,
    status:  DB_TO_UI[a.status] || 'pending',
    type:    a.type === 'video' ? 'Video' : 'In-person',
    reason:  a.reason || (a.type === 'video' ? 'Video consultation' : 'Consultation'),
    notes:   a.notes || '',
    // Set only when a Registered Medical Practitioner booked on the patient's
    // behalf — surfaced as a "booked through RMP" flag in the detail screen.
    bookedByRmp: !!a.rmp_id,
    scheduledAt: a.scheduled_at,
    isToday,
    isPast,
  };
}

// Fetch all of this doctor's appointments (any date), newest first, mapped.
export async function fetchDoctorAppointments() {
  const { staffId } = await resolveDoctorContext();
  if (!staffId) return [];
  const { data, error } = await supabase
    .from('appointments')
    .select('id, type, status, scheduled_at, organisation_id, patient_id, rmp_id, patient:profiles!patient_id(id, name, gender, phone)')
    .eq('doctor_staff_id', staffId)
    .order('scheduled_at', { ascending: false });
  if (error) { console.warn('[independentDoctor] fetchDoctorAppointments', error.message); return []; }
  return (data || []).map(mapAppointment);
}

// Persist an appointment status change (Accept / Mark Complete / Cancel).
export async function setAppointmentStatus(appointmentId, uiStatus) {
  const dbStatus = UI_TO_DB[uiStatus];
  if (!appointmentId || !dbStatus) return false;
  const { error } = await supabase
    .from('appointments')
    .update({ status: dbStatus, updated_at: new Date().toISOString() })
    .eq('id', appointmentId);
  if (error) { console.warn('[independentDoctor] setAppointmentStatus', error.message); return false; }
  return true;
}

// Create a home-care order for a patient (Refer → Home Care). A solo doctor has
// no home-care team, so the order is raised against their own clinic org for
// the platform to route — same provenance fields the hospital module writes.
export async function createHomecareOrder({ patientId, serviceName = 'Home Care', appointmentId = null }) {
  const { staffId, orgId } = await resolveDoctorContext();
  if (!orgId) throw new Error('No clinic context. Please re-login.');
  const { error } = await supabase.from('homecare_orders').insert({
    order_id: `HC-${Date.now().toString().slice(-6)}`,
    patient_id: patientId,
    organisation_id: orgId,
    requested_by_staff_id: staffId,
    appointment_id: appointmentId,
    service_name: serviceName,
    status: 'pending',
  });
  if (error) throw error;
  return { ok: true };
}
