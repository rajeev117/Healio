// ─────────────────────────────────────────────────────────────────────────────
// doctorData — Supabase data layer for the doctor portal.
//
// Bridges the ported doctor-mobile UI (which was written against mock data) to
// the provider app's real Supabase backend. All reads/writes are scoped to the
// logged-in doctor's staff row + hospital, reusing the exact patterns already
// proven in DoctorHome.js / careFlow.js.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../../../lib/supabase';
import { fetchSessions, fetchAvailability, fetchConflicts } from '../../../lib/schedule';

// Cache the resolved staff row for this session so every screen doesn't re-query.
let _staffCtx = null;

// Resolve the doctor's staff row id + organisation id. If the auth account
// isn't linked yet, claim_account() links it server-side (a direct UPDATE is
// blocked by RLS), then we re-read — same flow as DoctorHome/careFlow.
export async function resolveDoctorContext() {
  if (_staffCtx) return _staffCtx;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { staffId: null, orgId: null, name: null, specialty: null, department: null };

  let { data: staff } = await supabase
    .from('staff')
    .select('id, name, role, specialty, department, organisation_id, rating, organisations(name, city)')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!staff) {
    try { await supabase.rpc('claim_account'); } catch (_) {}
    const res = await supabase
      .from('staff')
      .select('id, name, role, specialty, department, organisation_id, rating, organisations(name, city)')
      .eq('user_id', user.id)
      .maybeSingle();
    staff = res.data;
  }

  _staffCtx = {
    staffId:    staff?.id || null,
    orgId:      staff?.organisation_id || null,
    name:       staff?.name || null,
    specialty:  staff?.specialty || null,
    department: staff?.department || null,
    rating:     staff?.rating || null,
    hospital:   staff?.organisations?.name || null,
    city:       staff?.organisations?.city || null,
  };
  return _staffCtx;
}

// Clear the cache on logout so the next doctor doesn't inherit this one's id.
export function clearDoctorContext() { _staffCtx = null; }

const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } };
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// DB appointment status → the UI status vocabulary the ported screens expect.
const DB_TO_UI = {
  scheduled:   'waiting',     // booking request awaiting confirmation
  suggested:   'waiting',
  in_progress: 'confirmed',   // confirmed / currently active
  completed:   'completed',
  cancelled:   'cancelled',
};

// UI action → DB status to persist.
export const UI_TO_DB = {
  completed: 'completed',
  cancelled: 'cancelled',
};

// ── Patient journey, as the doctor sees it ───────────────────────────────────
// A booked patient moves through:  Arrived → Checked In → Completed
//   • Arrived     — appointment booked / patient waiting to be seen
//   • Checked In  — patient is in with the doctor (walk-in / in_progress)
//   • Completed   — the consultation is done
// Whatever happens AFTER the visit (labs, pharmacy, follow-up orders) is
// deliberately NOT surfaced on the doctor's screens — their view ends here.
// Accepts either a raw DB status or the mapped UI status.
// labelKey → t() in the screens; label kept as an English fallback.
export function journeyStatus(status) {
  switch (status) {
    case 'completed':
      return { key: 'completed', labelKey: 'status_completed', label: 'Completed', bg: '#EBFAF0', color: '#2F855A' };
    case 'cancelled':
      return { key: 'cancelled', labelKey: 'status_cancelled', label: 'Cancelled', bg: '#FFF5F5', color: '#9B2C2C' };
    case 'in_progress':
    case 'confirmed':
      return { key: 'checkedin', labelKey: 'doc_checked_in', label: 'Checked In', bg: '#FDF6E2', color: '#C05621' };
    default: // scheduled, suggested, waiting
      return { key: 'arrived', labelKey: 'doc_arrived', label: 'Arrived', bg: '#EEF6FF', color: '#2B6CB0' };
  }
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday()   { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

// Map one DB appointment row → the shape the doctor-mobile screens render.
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
    status:  DB_TO_UI[a.status] || 'waiting',
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
  if (error) { console.warn('[doctorData] fetchDoctorAppointments', error.message); return []; }
  return (data || []).map(mapAppointment);
}

// The doctor's real availability. Until migration 058 this module had no
// schedule reader at all, which is why Schedule.js rendered a hardcoded weekly
// template. These delegate to lib/schedule so the hospital-affiliated doctor,
// the independent doctor and the patient booking screen all read one grid.
export async function fetchDoctorSchedules() {
  const { staffId } = await resolveDoctorContext();
  return staffId ? fetchSessions(staffId) : [];
}

export async function fetchDoctorAvailability(days = 7, fromIso = null) {
  const { staffId } = await resolveDoctorContext();
  return fetchAvailability(staffId, fromIso, days);
}

// Appointments a schedule change has stranded — kept, never auto-cancelled.
export async function fetchDoctorScheduleConflicts(days = 60) {
  const { staffId } = await resolveDoctorContext();
  return staffId ? fetchConflicts(staffId, days) : [];
}

// Persist an appointment status change (Mark Complete / Cancel).
export async function setAppointmentStatus(appointmentId, uiStatus) {
  const dbStatus = UI_TO_DB[uiStatus];
  if (!appointmentId || !dbStatus) return false;
  const { error } = await supabase
    .from('appointments')
    .update({ status: dbStatus, updated_at: new Date().toISOString() })
    .eq('id', appointmentId);
  if (error) { console.warn('[doctorData] setAppointmentStatus', error.message); return false; }
  return true;
}

// Create a home-care order for a patient (RequestServices → Home Care).
// careFlow has lab/pharmacy helpers but not homecare, so we insert here using
// the same provenance fields (org + requesting staff).
export async function createHomecareOrder({ patientId, serviceName = 'Home Care', appointmentId = null }) {
  const { staffId, orgId } = await resolveDoctorContext();
  if (!orgId) throw new Error('No hospital context. Please re-login.');
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
