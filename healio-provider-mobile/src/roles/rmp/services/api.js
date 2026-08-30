import { supabase } from '../../../lib/supabase';
import { fetchDayAvailability, bookSlot } from '../../../lib/schedule';

// `profiles` stores `date_of_birth` (DATE), not `age` — see schema.sql. Patients
// are created on the patient app; here we only read them, deriving `age` (the
// shape the RMP screens consume) from their stored date of birth.
function ageFromDob(dob) {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

// ─── RMP Profile ──────────────────────────────────────────────────────────────

export async function fetchRmpProfile(rmpId) {
  const { data, error } = await supabase
    .from('rmps')
    .select('id, name, phone, village, reg_no, status, created_at')
    .eq('id', rmpId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateRmpProfile(rmpId, fields) {
  const { error } = await supabase
    .from('rmps')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', rmpId);
  if (error) throw error;
}

// ─── Patients ─────────────────────────────────────────────────────────────────

export async function fetchRmpPatients(rmpId) {
  const { data, error } = await supabase
    .from('rmp_patients')
    .select('language, linked_at, profiles:patient_id(id, name, phone, date_of_birth, gender)')
    .eq('rmp_id', rmpId)
    .order('linked_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(row => ({
    id: row.profiles.id,
    name: row.profiles.name,
    phone: row.profiles.phone,
    age: ageFromDob(row.profiles.date_of_birth),
    gender: row.profiles.gender,
    language: row.language,
    linkedAt: row.linked_at,
    status: 'Active',
  }));
}

// Look up an existing (patient-app-registered) patient by phone. Goes through
// the rmp_find_patient_by_phone RPC (migration-038): an RMP can't SELECT other
// users' profiles directly under RLS, so the SECURITY DEFINER function does the
// single identity lookup. Returns null when no such patient is registered.
export async function findPatientByPhone(phone) {
  const normalised = phone.replace(/\s+/g, '');
  const { data, error } = await supabase.rpc('rmp_find_patient_by_phone', { p_phone: normalised });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { ...row, age: ageFromDob(row.date_of_birth) } : null;
}

// Find a registered patient by phone and link them to this RMP. RMPs cannot
// create new patient records (profiles requires an auth account); the patient
// must first sign up on the Healio patient app. Throws code 'NOT_REGISTERED'
// when no matching patient exists so the UI can show a helpful message.
export async function findAndLinkPatient(rmpId, phone, language = 'English') {
  const patient = await findPatientByPhone(phone);
  if (!patient) {
    const err = new Error('No registered patient found with this number. Ask them to sign up on the Healio patient app first, then link them here.');
    err.code = 'NOT_REGISTERED';
    throw err;
  }
  await linkExistingPatient(rmpId, patient.id, language);
  return { ...patient, language };
}

// The linked patient's household. Dependents are `family_profiles` rows, not
// accounts, and their RLS is owner-only — so this goes through the
// rmp_patient_family RPC (migration-053), which is gated on this RMP having
// linked the patient. Returns [] on any failure so a project without that
// migration simply books for the account holder, as it always did.
export async function fetchPatientFamily(patientId) {
  if (!patientId) return [];
  const { data, error } = await supabase.rpc('rmp_patient_family', { p_patient: patientId });
  if (error) {
    console.warn('rmp_patient_family:', error.message);
    return [];
  }
  return (data || []).map(m => ({
    id: m.id,
    name: m.name,
    relation: m.relation,
    age: ageFromDob(m.date_of_birth),
    gender: m.gender,
  }));
}

export async function linkExistingPatient(rmpId, patientId, language = 'English') {
  const { error } = await supabase
    .from('rmp_patients')
    .upsert({ rmp_id: rmpId, patient_id: patientId, language }, { onConflict: 'rmp_id,patient_id', ignoreDuplicates: true });
  if (error) throw error;
}

// ─── Providers (Doctors) ─────────────────────────────────────────────────────

export async function fetchProviders(specialty = null, hospitalId = null) {
  // staff has `specialty` (free text) — there is no service_charge /
  // specialty_category column, so we filter on `specialty` and use a default
  // service charge. Active doctors are publicly readable (migration-003), so
  // an RMP can list them. 'All'/'General' mean "no specialty filter".
  // `hospitalId` narrows the list to one hospital's doctors — that is what a
  // hospital booking is: the same appointment, picked inside one organisation.
  let query = supabase
    .from('staff')
    .select('id, name, specialty, organisations:organisation_id(id, name, city)')
    .eq('role', 'doctor')
    .eq('status', 'active');
  if (specialty && specialty !== 'All' && specialty !== 'General') {
    query = query.eq('specialty', specialty);
  }
  if (hospitalId) {
    query = query.eq('organisation_id', hospitalId);
  }

  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data || []).map(d => ({
    id: d.id,
    // Avoid "Dr Dr X" when the stored name already includes the title.
    name: /^dr\.?\s/i.test(d.name || '') ? d.name : `Dr ${d.name}`,
    specialty: d.specialty || 'General Physician',
    category: d.specialty || 'General',
    rating: 4.8,
    hospitalId: d.organisations?.id,
    hospitalName: d.organisations?.name || 'Healio Hospital',
    hospitalCity: d.organisations?.city || '',
    serviceCharge: 49,
  }));
}

export async function fetchSpecialties(hospitalId = null) {
  let query = supabase
    .from('staff')
    .select('specialty')
    .eq('role', 'doctor')
    .eq('status', 'active')
    .not('specialty', 'is', null);
  if (hospitalId) query = query.eq('organisation_id', hospitalId);

  const { data, error } = await query;
  if (error) throw error;
  const unique = [...new Set((data || []).map(d => d.specialty).filter(Boolean))];
  // 'All' first so the default view lists every doctor.
  return ['All', ...unique];
}

// ─── Facilities (labs, pharmacies, hospitals) ────────────────────────────────

// Hospitals are `organisations` rows. Labs and pharmacies come in two shapes:
// standalone ones are organisations too (type 'diagnostic' / 'pharmacy'), but a
// hospital's lab or pharmacy is a `staff` row inside it (role 'lab_technician' /
// 'pharmacy_assistant', `department` naming the unit). The rmp_service_facilities
// RPC (migration-051) returns both as one catalog — a plain staff query can't,
// because RLS exposes only doctors outside their own organisation.
export const FACILITY_ORG_TYPE = { lab: 'diagnostic', pharmacy: 'pharmacy', hospital: 'hospital' };

export async function fetchFacilities(kind) {
  if (kind === 'hospital') return fetchFacilityOrgs('hospital');

  const { data, error } = await supabase.rpc('rmp_service_facilities', { p_kind: kind });
  if (error) {
    // migration-051 not applied yet — still offer the standalone providers
    // rather than an empty list.
    console.warn('rmp_service_facilities:', error.message);
    return fetchFacilityOrgs(kind);
  }
  return (data || []).map(f => ({
    id: f.id,
    organisationId: f.organisation_id,
    // The bookable identity: "Apollo Hospital · Pathology Lab" for a unit
    // inside a hospital, just the provider's name for a standalone one.
    name: f.unit ? `${f.org_name} · ${f.unit}` : f.org_name,
    orgName: f.org_name,
    unit: f.unit || null,
    source: f.source,
    kind,
    city: f.city || '',
    address: f.address || '',
  }));
}

// Organisation-only lookup: hospitals, and the fallback for labs/pharmacies.
async function fetchFacilityOrgs(kind) {
  const type = FACILITY_ORG_TYPE[kind];
  if (!type) return [];
  let query = supabase
    .from('organisations')
    .select('id, name, city, address')
    .eq('type', type);
  // Same visibility rule the patient app uses per category, so the RMP is
  // offered exactly the facilities the patient could pick themselves —
  // hospitals include seeded test orgs, labs and pharmacies do not.
  if (kind === 'hospital') query = query.or('status.eq.active,is_test.eq.true');
  else query = query.eq('status', 'active');

  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data || []).map(o => ({
    id: o.id,
    organisationId: o.id,
    name: o.name,
    orgName: o.name,
    unit: null,
    source: 'independent',
    kind,
    city: o.city || '',
    address: o.address || '',
  }));
}

// ─── Emergency admissions ─────────────────────────────────────────────────────

// Active hospitals the RMP can raise an emergency admission to — the same list
// a hospital booking picks from (see fetchFacilities).
export async function fetchHospitals() {
  return fetchFacilities('hospital');
}

// Active doctors of one hospital (staff catalog is publicly readable).
export async function fetchHospitalDoctors(hospitalId) {
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, specialty')
    .eq('organisation_id', hospitalId)
    .eq('role', 'doctor')
    .eq('status', 'active')
    .order('name');
  if (error) throw error;
  return (data || []).map(d => ({
    id: d.id,
    name: /^dr\.?\s/i.test(d.name || '') ? d.name : `Dr ${d.name}`,
    specialty: d.specialty || 'General Physician',
  }));
}

// Raise an emergency admission (migration-046). The hospital app alarms and
// must accept within 5 minutes (expires_at defaults server-side). Patient/RMP
// names ride denormalised on the row so the hospital alert needs no joins.
export async function createEmergencyAdmission({
  rmpId, rmpName, patient, hospitalId, doctorStaffId = null,
  triage = 'critical', complaint = '', notes = '',
}) {
  const { data, error } = await supabase
    .from('emergency_admissions')
    .insert({
      rmp_id:          rmpId,
      patient_id:      patient.id,
      organisation_id: hospitalId,
      doctor_staff_id: doctorStaffId,
      patient_name:    patient.name || 'Patient',
      patient_phone:   patient.phone || null,
      rmp_name:        rmpName || null,
      triage,
      complaint:       complaint || null,
      notes:           notes || null,
    })
    .select('id, expires_at, status')
    .single();
  if (error) throw error;
  return data;
}

// ─── Slots ────────────────────────────────────────────────────────────────────

// The doctor's real grid, grouped by their own named sessions.
//
// This used to be a DEFAULT_SLOTS constant that every doctor shared, filtered
// by a day window built in UTC — so in IST it also read the wrong day. Slots
// now come from doctor_availability(), which resolves the day in the platform
// timezone and already knows about leave and blocked windows.
//
// Returns { [sessionName]: [{ time, label, at, state, spotsLeft }] } with the
// unavailable slots kept (marked) rather than filtered out, so the RMP can see
// that a time is taken instead of wondering why it vanished.
export async function fetchAvailableSlots(doctorId, dateStr) {
  const day = await fetchDayAvailability(doctorId, dateStr);
  const grouped = {};
  day.sessions.forEach((session) => {
    grouped[session.name || 'Consulting hours'] = session.slots;
  });
  return grouped;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

// `at` is the slot instant from fetchAvailableSlots. Booking goes through
// book_appointment_slot so an RMP cannot put a patient into a slot another
// patient already holds — the old direct insert had no capacity check at all.
export async function createBooking({ rmpId, patientId, hospitalId, doctorId, at, payment = 'Cash', serviceCharge = 0, familyMemberId = null }) {
  if (!at) throw new Error('Please pick the slot again.');

  const appointmentId = await bookSlot({
    doctorStaffId:  doctorId,
    at,
    type:           'clinic',
    patientId,
    // NULL = the account holder themself; otherwise the household member this
    // visit is for, so the patient app files it (and everything careFlow
    // derives from it) under the right person.
    familyMemberId,
    patientNotes:   `Booked by Healthcare Consultant. Service charge: ₹${serviceCharge}. Payment: ${payment}.`,
    rmpId,
  });

  await supabase.from('rmp_commissions').insert({
    rmp_id:         rmpId,
    appointment_id: appointmentId,
    amount:         60,
    type:           'credit',
    label:          'Partner incentive',
  });

  return { id: appointmentId };
}

export async function fetchRmpBookings(rmpId) {
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, scheduled_at, status,
      profiles:patient_id(id, name, phone),
      staff:doctor_staff_id(id, name, specialty),
      organisations:organisation_id(id, name)
    `)
    .eq('rmp_id', rmpId)
    .order('scheduled_at', { ascending: false });
  if (error) throw error;

  return (data || []).map(a => {
    const apptDate  = a.scheduled_at ? a.scheduled_at.slice(0, 10) : '';
    const isToday   = apptDate === today;
    const dateLabel = isToday
      ? 'Today'
      : apptDate
        ? new Date(a.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
    // Map the DB status to the RMP UI vocabulary so the Bookings filter
    // (Pending / Confirmed / Completed) works and a hospital's confirmation
    // (scheduled → in_progress) shows up as "Confirmed".
    const STATUS_LABEL = {
      scheduled:   'Pending',
      suggested:   'Pending',
      in_progress: 'Confirmed',
      completed:   'Completed',
      cancelled:   'Cancelled',
    };
    const status = STATUS_LABEL[a.status] || 'Pending';
    return {
      id:            a.id,
      patientName:   a.profiles?.name || 'Patient',
      providerName:  a.staff ? (/^dr\.?\s/i.test(a.staff.name || '') ? a.staff.name : `Dr ${a.staff.name}`) : 'Doctor',
      hospitalName:  a.organisations?.name || 'Hospital',
      time:          a.scheduled_at ? formatTime(new Date(a.scheduled_at).toTimeString().slice(0, 5)) : '',
      date:          dateLabel,
      status,
      rawStatus:     a.status,
      isToday,
      services:      [],
      stage:         'doctor',
      payment:       'Cash',
      serviceCharge: 49,
      commission:    60,
      patientId:     a.profiles?.id,
      doctorId:      a.staff?.id,
    };
  });
}

// Live journey + documents for a booking the RMP made. Goes through the
// rmp_patient_journey RPC (migration-048): RLS blocks an RMP from reading a
// patient's check-ins / records directly, so the SECURITY DEFINER function
// returns exactly this visit's status + documents, gated on the RMP owning
// the appointment. Returns { status, arrivedAt, checkedInAt, documents, … }.
export async function fetchPatientJourney(appointmentId) {
  const { data, error } = await supabase.rpc('rmp_patient_journey', { p_appointment: appointmentId });
  if (error) throw error;
  return data || null;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function fetchRmpStats(rmpId) {
  const [patientsRes, bookingsRes, pendingRes] = await Promise.all([
    supabase.from('rmp_patients').select('patient_id', { count: 'exact', head: true }).eq('rmp_id', rmpId),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('rmp_id', rmpId),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('rmp_id', rmpId).eq('status', 'scheduled'),
  ]);
  return {
    patients: patientsRes.count || 0,
    bookings: bookingsRes.count || 0,
    pending: pendingRes.count || 0,
  };
}

// ─── Earnings ─────────────────────────────────────────────────────────────────

export async function fetchRmpEarnings(rmpId) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const [historyRes, thisMonthRes, prevMonthRes] = await Promise.all([
    supabase
      .from('rmp_commissions')
      .select('id, amount, type, label, created_at')
      .eq('rmp_id', rmpId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('rmp_commissions')
      .select('amount, type')
      .eq('rmp_id', rmpId)
      .gte('created_at', monthStart),
    supabase
      .from('rmp_commissions')
      .select('amount, type')
      .eq('rmp_id', rmpId)
      .gte('created_at', prevMonthStart)
      .lte('created_at', prevMonthEnd),
  ]);

  const sumNet = (rows) => (rows || []).reduce((acc, r) => acc + (r.type === 'credit' ? r.amount : -r.amount), 0);

  const thisMonth = sumNet(thisMonthRes.data);
  const prevMonth = sumNet(prevMonthRes.data);
  const growthPct = prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : 0;
  const bookingsThisMonth = (thisMonthRes.data || []).filter(r => r.type === 'credit').length;

  const history = (historyRes.data || []).map(r => ({
    id: r.id,
    label: r.label || 'Partner Incentive',
    date: new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    amount: r.amount,
    type: r.type,
  }));

  const credits = (historyRes.data || []).filter(r => r.type === 'credit').reduce((a, r) => a + r.amount, 0);
  const debits = (historyRes.data || []).filter(r => r.type === 'debit').reduce((a, r) => a + r.amount, 0);
  const withdrawable = credits - debits;

  return {
    commission: {
      thisMonth,
      growthPct,
      bookings: bookingsThisMonth,
      perBooking: 60,
      withdrawable: Math.max(withdrawable, 0),
    },
    history,
  };
}
