// ─────────────────────────────────────────────────────────────────────────────
// schedule — the one place slots are defined, read and booked.
//
// Before this module every surface invented its own grid: BookAppointment had
// ALL_TIME_SLOTS, DoctorDetail had six different times, HospitalDetail a third
// set, the RMP module a fourth, and Appointments.js two more (SUGGEST_SLOTS,
// WI_SLOTS). None of them read doctor_schedules, so a doctor's availability
// changed nothing. All of that now comes from doctor_availability() instead.
//
// THE ONE RULE: book with the `at` value that came back from the server.
// Slots are wall-clock ("09:15") but appointments.scheduled_at is an instant.
// The RPC resolves that against the platform timezone (platform_settings.
// timezone, migration 058); a client rebuilding it from `new Date()` would
// silently drift by the device's UTC offset. Pass slot.at straight through.
//
// Capacity is NOT enforced here — a BEFORE INSERT/UPDATE trigger on
// appointments holds a per-slot advisory lock and re-counts (migration 058 §6).
// These helpers exist to keep the UI honest and to name the failure.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SLOT_OPTIONS = [10, 15, 20, 30, 45, 60];

// Matches doctor_availability()'s `state` column.
export const SLOT_STATE = {
  FREE: 'free',
  FULL: 'full',
  BLOCKED: 'blocked',
  LEAVE: 'leave',
  PAST: 'past',
};

// A day with no session on that weekday isn't a state the RPC returns — it
// returns no rows at all — so the day-level summary adds one.
export const DAY_STATE = {
  OPEN: 'open',
  OFF: 'off',       // not a working weekday
  LEAVE: 'leave',   // working weekday, but the doctor marked it off
};

// ── Time helpers ─────────────────────────────────────────────────────────────

// 'HH:MM' → minutes since midnight, or null when it isn't a time. The old
// editor let times be free-typed, so bad values are still out there.
export function hhmmToMins(value) {
  const m = /^\s*([01]?\d|2[0-3]):([0-5]\d)\s*$/.exec(String(value ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function minsToHhmm(mins) {
  const n = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
}

// '09:15' → '09:15 AM'. The display format used everywhere in the apps.
export function fmt12(hhmm) {
  const mins = hhmmToMins(hhmm);
  if (mins === null) return String(hhmm ?? '');
  const h24 = Math.floor(mins / 60);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')} ${period}`;
}

// '09:15 AM' → '09:15'. Accepts the 24h form unchanged so callers can be lazy.
export function to24h(label) {
  const raw = String(label ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  const m = /^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/.exec(raw);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return minsToHhmm(h * 60 + Number(m[2]));
}

// Normalises '09:15 AM' vs '09:15 AM' (narrow no-break space, casing) so two
// differently-formatted times compare equal.
export const normTime = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

// Local calendar day as YYYY-MM-DD. `toISOString().slice(0,10)` is the UTC day,
// which in IST files everything before 05:30 under the previous date.
export function localDay(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// The next N real dates starting today — not generic weekday names, so a strip
// can say "Thu 28" and mean it.
export function getNextNDays(n = 7, from = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return {
      date: d,
      iso: localDay(d),
      day: WEEKDAY[d.getDay()],
      num: d.getDate(),
      isToday: i === 0,
      full: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
  });
}

// '09:00' + slot_mins → ['09:00', '09:15', …] up to but excluding end.
// Used by the editor to preview a session; the real grid comes from the server.
export function buildSlots(startTime, endTime, slotMins) {
  const start = hhmmToMins(startTime);
  const end = hhmmToMins(endTime);
  if (start === null || end === null || end <= start) return [];
  const step = Math.max(5, Number(slotMins) || 15);
  const out = [];
  for (let t = start; t + step <= end && out.length < 240; t += step) out.push(minsToHhmm(t));
  return out;
}

// ── Errors ───────────────────────────────────────────────────────────────────

const ERROR_CODES = [
  'SLOT_FULL', 'OUTSIDE_SCHEDULE', 'SLOT_BLOCKED', 'ON_LEAVE',
  'SLOT_PAST', 'NOT_AUTHORISED', 'DOCTOR_NOT_FOUND',
];

const FALLBACK_MESSAGE = {
  SLOT_FULL: 'This time slot is already taken. Please pick another time.',
  OUTSIDE_SCHEDULE: 'The doctor is not consulting at that time.',
  SLOT_BLOCKED: 'The doctor has blocked that slot.',
  ON_LEAVE: 'The doctor is on leave that day.',
  SLOT_PAST: 'That time has already passed.',
  NOT_AUTHORISED: 'You are not allowed to make this change.',
  DOCTOR_NOT_FOUND: 'That doctor is not accepting appointments.',
  BOOKING_FAILED: 'Could not complete the booking. Please try again.',
};

// Postgres RAISE EXCEPTION 'SLOT_FULL' arrives as { message: 'SLOT_FULL',
// hint: '<the sentence to show>' }. Turn it into an Error the screens can
// switch on, keeping the existing `e.code === 'SLOT_FULL'` call sites working.
export function scheduleError(error) {
  const raw = String(error?.message || '');
  const code = ERROR_CODES.find((c) => raw.includes(c)) || 'BOOKING_FAILED';
  const err = new Error(error?.hint || FALLBACK_MESSAGE[code] || raw);
  err.code = code;
  err.cause = error;
  return err;
}

// ── Availability ─────────────────────────────────────────────────────────────

// Shapes doctor_availability() rows into per-date buckets:
//   { order: ['2026-08-27', …],
//     days: { '2026-08-27': { iso, state, sessions: [{ id, name, slots }],
//                             slots: [...], counts: { total, free, full, blocked } } } }
// Every slot carries `at` — the value to book with.
export async function fetchAvailability(doctorStaffId, fromIso, days = 7) {
  const order = getNextNDays(days, fromIso ? new Date(`${fromIso}T00:00:00`) : new Date())
    .map((d) => d.iso);
  const empty = { order, days: Object.fromEntries(order.map((iso) => [iso, blankDay(iso)])) };
  if (!doctorStaffId) return empty;

  const { data, error } = await supabase.rpc('doctor_availability', {
    p_doctor_staff_id: doctorStaffId,
    p_from: order[0],
    p_days: days,
  });
  if (error) {
    console.warn('[schedule] doctor_availability', error.message);
    return empty;
  }

  const out = { order, days: Object.fromEntries(order.map((iso) => [iso, blankDay(iso)])) };
  (data || []).forEach((row) => {
    const iso = String(row.slot_date).slice(0, 10);
    const day = out.days[iso] || (out.days[iso] = blankDay(iso));
    const slot = {
      time: row.slot_time,
      label: fmt12(row.slot_time),
      at: row.slot_at,
      state: row.state,
      booked: Number(row.booked) || 0,
      capacity: Number(row.capacity) || 1,
      spotsLeft: Math.max(0, (Number(row.capacity) || 1) - (Number(row.booked) || 0)),
      sessionId: row.session_id,
      sessionName: row.session_name,
    };
    let session = day.sessions.find((s) => s.id === row.session_id);
    if (!session) {
      session = { id: row.session_id, name: row.session_name || 'OPD', slots: [] };
      day.sessions.push(session);
    }
    session.slots.push(slot);
    day.slots.push(slot);
  });

  Object.values(out.days).forEach(summariseDay);
  if (!out.order.length) out.order = Object.keys(out.days).sort();
  return out;
}

const blankDay = (iso) => ({
  iso,
  state: DAY_STATE.OFF,
  sessions: [],
  slots: [],
  counts: { total: 0, free: 0, full: 0, blocked: 0 },
});

function summariseDay(day) {
  const counts = { total: day.slots.length, free: 0, full: 0, blocked: 0 };
  day.slots.forEach((s) => {
    if (s.state === SLOT_STATE.FREE) counts.free += 1;
    else if (s.state === SLOT_STATE.FULL) counts.full += 1;
    else if (s.state === SLOT_STATE.BLOCKED) counts.blocked += 1;
  });
  day.counts = counts;
  if (!day.slots.length) day.state = DAY_STATE.OFF;
  else if (day.slots.every((s) => s.state === SLOT_STATE.LEAVE)) day.state = DAY_STATE.LEAVE;
  else day.state = DAY_STATE.OPEN;
  return day;
}

// Convenience for screens that only care about one date.
export async function fetchDayAvailability(doctorStaffId, iso) {
  const res = await fetchAvailability(doctorStaffId, iso, 1);
  return res.days[iso] || blankDay(iso);
}

// ── Booking ──────────────────────────────────────────────────────────────────

// Creates the appointment through book_appointment_slot: validates the instant
// against the doctor's sessions/leave/blocks, then inserts under the slot lock.
export async function bookSlot({
  doctorStaffId,
  at,
  type = 'clinic',
  patientId = null,
  familyMemberId = null,
  fee = null,
  platformFee = 20,
  patientNotes = null,
  rmpId = null,
}) {
  const { data, error } = await supabase.rpc('book_appointment_slot', {
    p_doctor_staff_id: doctorStaffId,
    p_scheduled_at: at instanceof Date ? at.toISOString() : at,
    p_type: type,
    p_patient_id: patientId,
    p_family_member_id: familyMemberId,
    p_fee: fee,
    p_platform_fee: platformFee,
    p_patient_notes: patientNotes,
    p_rmp_id: rmpId,
  });
  if (error) throw scheduleError(error);
  return data; // appointment id
}

// Moves an existing appointment — reschedule, or a provider suggesting a new
// time. Same validation, so neither can land on an occupied slot.
export async function moveSlot({ appointmentId, at, status = null, countReschedule = false }) {
  const { data, error } = await supabase.rpc('move_appointment_slot', {
    p_appointment_id: appointmentId,
    p_scheduled_at: at instanceof Date ? at.toISOString() : at,
    p_status: status,
    p_count_reschedule: countReschedule,
  });
  if (error) throw scheduleError(error);
  return data;
}

// ── Sessions (the weekly definition) ──────────────────────────────────────────

export async function fetchSessions(doctorStaffId) {
  if (!doctorStaffId) return [];
  const { data, error } = await supabase
    .from('doctor_schedules')
    .select('id, name, days, start_time, end_time, slot_mins, capacity, is_active, department, updated_at, updated_by')
    .eq('doctor_staff_id', doctorStaffId)
    .order('start_time', { ascending: true });
  if (error) {
    console.warn('[schedule] fetchSessions', error.message);
    return [];
  }
  return (data || []).map((row) => ({
    ...row,
    days: Array.isArray(row.days) ? row.days : [],
    slot_mins: Number(row.slot_mins) || 15,
    capacity: Math.max(1, Number(row.capacity) || 1),
    is_active: row.is_active !== false,
  }));
}

export async function saveSession(session, { doctorStaffId, organisationId, userId }) {
  const payload = {
    doctor_staff_id: doctorStaffId,
    organisation_id: organisationId,
    name: (session.name || 'OPD').trim() || 'OPD',
    days: session.days || [],
    start_time: session.start_time,
    end_time: session.end_time,
    slot_mins: Number(session.slot_mins) || 15,
    capacity: Math.max(1, Number(session.capacity) || 1),
    is_active: session.is_active !== false,
    department: session.department || null,
    updated_at: new Date().toISOString(),
    updated_by: userId || null,
  };
  const query = String(session.id || '').startsWith('new-') || !session.id
    ? supabase.from('doctor_schedules').insert(payload).select('id').single()
    : supabase.from('doctor_schedules').update(payload).eq('id', session.id).select('id').single();
  const { data, error } = await query;
  if (error) throw scheduleError(error);
  return data?.id;
}

export async function deleteSession(sessionId) {
  if (!sessionId || String(sessionId).startsWith('new-')) return;
  const { error } = await supabase.from('doctor_schedules').delete().eq('id', sessionId);
  if (error) throw scheduleError(error);
}

// ── Exceptions (leave + blocked slots) ───────────────────────────────────────

export async function fetchExceptions(doctorStaffId, fromIso = localDay(new Date())) {
  if (!doctorStaffId) return [];
  const { data, error } = await supabase
    .from('doctor_schedule_exceptions')
    .select('id, exception_date, start_time, end_time, reason, created_at')
    .eq('doctor_staff_id', doctorStaffId)
    .gte('exception_date', fromIso)
    .order('exception_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: true });
  if (error) {
    console.warn('[schedule] fetchExceptions', error.message);
    return [];
  }
  return data || [];
}

// startTime/endTime null → the whole day is off.
export async function addException(
  { date, startTime = null, endTime = null, reason = null },
  { doctorStaffId, organisationId, userId },
) {
  const { error } = await supabase.from('doctor_schedule_exceptions').insert({
    doctor_staff_id: doctorStaffId,
    organisation_id: organisationId,
    exception_date: date,
    start_time: startTime,
    end_time: endTime,
    reason: reason || null,
    created_by: userId || null,
  });
  // The partial unique indexes make a repeat tap a no-op rather than an error.
  if (error && error.code !== '23505') throw scheduleError(error);
}

export async function removeException(id) {
  const { error } = await supabase.from('doctor_schedule_exceptions').delete().eq('id', id);
  if (error) throw scheduleError(error);
}

// ── Conflicts ────────────────────────────────────────────────────────────────

// Appointments a schedule change has stranded — booked, still active, but no
// longer inside any session (or now on a day marked as leave). They are kept,
// never auto-cancelled; the doctor decides what to do with them.
export async function fetchConflicts(doctorStaffId, days = 60) {
  if (!doctorStaffId) return [];
  const { data, error } = await supabase.rpc('doctor_schedule_conflicts', {
    p_doctor_staff_id: doctorStaffId,
    p_days: days,
  });
  if (error) {
    console.warn('[schedule] fetchConflicts', error.message);
    return [];
  }
  return (data || []).map((row) => ({
    id: row.appointment_id,
    scheduledAt: row.scheduled_at,
    patientName: row.patient_name,
    reason: row.reason,
  }));
}
