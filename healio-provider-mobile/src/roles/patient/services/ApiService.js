// ─────────────────────────────────────────────────────────────────────────────
// Patient app API service
//
// Every function maps 1-to-1 with a Supabase query.
// When Supabase is connected, replace each mock return with the commented line.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MOCK_DATA } from './mockData';
import { supabase } from './supabase';
import { getActiveFamilyMemberId, scopeByFamily, isMissingFamilyColumn, fetchWithFamilyFallback } from './activeProfile';
import { fetchDayAvailability, bookSlot, moveSlot, localDay } from '../../../lib/schedule';

// ── Robust date/time parsing for the app's "17 Jun 2026" + "10:30 AM" strings ──
// `new Date(\`${dateStr} ${timeStr}\`)` relies on the JS engine's ambient,
// non-standard string parser — V8 (Chrome/Node debugger) accepts this loose
// format, but Hermes (React Native's actual on-device engine) is stricter and
// can return an Invalid Date for the exact same string. That silently broke
// booking/reschedule on-device while looking fine in the debugger. Parsing
// into explicit numeric fields and using `new Date(y, m, d, h, mi)` — the
// ECMA-262 numeric constructor form — works identically on every engine.
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function parseAppDateTime(dateStr, timeStr) {
  const dm = /^(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})$/.exec(String(dateStr || '').trim());
  const tm = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(String(timeStr || '').trim());
  if (!dm || !tm) return null;
  const month = MONTHS[dm[2].slice(0, 1).toUpperCase() + dm[2].slice(1, 3).toLowerCase()];
  if (month === undefined) return null;
  let hour = Number(tm[1]) % 12;
  if (tm[3].toUpperCase() === 'PM') hour += 12;
  const d = new Date(Number(dm[3]), month, Number(dm[1]), hour, Number(tm[2]), 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

// ── Persistent cancelled-appointment store ────────────────────────────────────
// Backed by AsyncStorage so it survives Fast Refresh, hot reloads, and app
// restarts. The in-memory Set is the fast path; AsyncStorage is the source of
// truth that re-populates the Set after any module reload.
const CANCELLED_KEY = '@healio_cancelled_appointments';
const _localCancelled = new Set();

// Load any previously-cancelled IDs from storage on module init.
// This is fire-and-forget; reads happen fast enough before any UI renders.
(async () => {
  try {
    const raw = await AsyncStorage.getItem(CANCELLED_KEY);
    if (raw) JSON.parse(raw).forEach(id => _localCancelled.add(id));
  } catch (_) {}
})();

async function _persistCancelled(id) {
  _localCancelled.add(id);
  try {
    const all = Array.from(_localCancelled);
    await AsyncStorage.setItem(CANCELLED_KEY, JSON.stringify(all));
  } catch (_) {}
}

// Remove IDs whose cancellation the DB has now confirmed — keeps the local
// "hide while pending" set from growing forever.
async function _unpersistCancelled(ids) {
  ids.forEach(id => _localCancelled.delete(id));
  try {
    await AsyncStorage.setItem(CANCELLED_KEY, JSON.stringify(Array.from(_localCancelled)));
  } catch (_) {}
}

// Every read tries Supabase first and falls back to mock data on error/empty,
// so the app keeps working no matter the backend state.
async function withFallback(fn, fallback) {
  try {
    const result = await fn();
    if (result == null || (Array.isArray(result) && result.length === 0)) return fallback;
    return result;
  } catch (e) {
    return fallback;
  }
}

export const ApiService = {
  sleep: (ms = 500) => new Promise(resolve => setTimeout(resolve, ms)),

  // ── Auth ────────────────────────────────────────────────────────────────────
  // Logged in → REAL profile (never the mock user). Mock only when no session.
  getUser: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return MOCK_DATA.user; // not logged in → preview
      const { data } = await supabase
        .from('profiles').select('*, wallets(balance)').eq('id', user.id).maybeSingle();
      const wallet = data && (Array.isArray(data.wallets) ? data.wallets[0] : data.wallets);
      return {
        id: user.id,
        name: data?.name || 'New User',
        phone: data?.phone || '',
        email: data?.email || user.email || '',
        bloodType: data?.blood_group || '—',
        height: '—',
        weight: '—',
        location: data?.city || 'Dhaka, Bangladesh',
        // Only a user-chosen avatar; no random placeholder (Home falls back to a person icon).
        avatar: data?.avatar_url || null,
        walletBalance: Number(wallet?.balance ?? 0),
      };
    } catch (e) {
      return MOCK_DATA.user;
    }
  },

  updateProfile: async (patch) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const dbPatch = {};
        if (patch.name) dbPatch.name = patch.name;
        if (patch.email) dbPatch.email = patch.email;
        if (patch.bloodType) dbPatch.blood_group = patch.bloodType;
        await supabase.from('profiles').update(dbPatch).eq('id', user.id);
      }
    } catch (e) { /* ignore, fall through to local */ }
    Object.assign(MOCK_DATA.user, patch);
    return MOCK_DATA.user;
  },

  // ── Services ─────────────────────────────────────────────────────────────────
  getServices: async () => {
    return withFallback(async () => {
      const { data } = await supabase
        .from('service_categories').select('*').eq('enabled', true).order('display_order');
      return (data || []).map(s => ({
        id: s.id,
        name: s.name,
        icon: s.icon?.endsWith('-outline') ? s.icon : `${s.icon}-outline`,
        desc: s.description || '',
      }));
    }, MOCK_DATA.services);
  },

  // ── Appointments ─────────────────────────────────────────────────────────────
  // Own data: returns the logged-in patient's REAL appointments (empty if none).
  // Only falls back to mock when NOT logged in (preview mode).
  getAppointments: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return MOCK_DATA.appointments.map(a => ({ ...a, rawStatus: a.rawStatus || (a.status === 'Upcoming' ? 'scheduled' : a.status?.toLowerCase()) }));
      // Scope to whichever profile is active (account owner or a family member) —
      // see ProfileSelector / ActiveProfileContext.
      const familyId = getActiveFamilyMemberId();
      const baseQuery = () => supabase
        .from('appointments')
        .select('id, type, status, scheduled_at, reschedule_count, doctor_staff_id, staff(name, specialty), organisations(name)')
        .eq('patient_id', user.id)
        .order('scheduled_at', { ascending: false });
      let { data, error } = await scopeByFamily(baseQuery(), familyId);
      if (error && isMissingFamilyColumn(error)) {
        // migration-030 hasn't been run yet — fall back to unscoped so
        // appointments still show instead of silently disappearing.
        ({ data } = await baseQuery());
      } else if (error) {
        console.warn('[getAppointments] query error:', error.message);
      }
      const statusMap = {
        scheduled:   'Upcoming',    // pending acceptance
        in_progress: 'Upcoming',    // confirmed by provider
        suggested:   'Upcoming',    // provider suggested a new time
        completed:   'Past',
        missed:      'Past',        // patient did not attend
        no_show:     'Past',        // alias used by some providers
        cancelled:   'Cancelled',
      };
      const now = new Date();
      // DB has caught up on these — drop them from the local set so it doesn't
      // grow forever in AsyncStorage.
      const confirmed = (data || []).filter(a => a.status === 'cancelled' && _localCancelled.has(a.id)).map(a => a.id);
      if (confirmed.length) _unpersistCancelled(confirmed);
      return (data || [])
        // Hide a row only while the DB hasn't caught up to the cancel yet —
        // once status is actually 'cancelled' it must show (so it lands in the
        // Cancelled tab and the patient can rebook). Otherwise a cancelled
        // appointment would be hidden from every tab forever.
        .filter(a => a.status === 'cancelled' || !_localCancelled.has(a.id))
        .map(a => {
          const d = new Date(a.scheduled_at);
          // Doctor never closed the appointment but the slot has already passed →
          // treat as missed so it lands in the Past tab with the amber missed banner.
          const activeStale = (a.status === 'scheduled' || a.status === 'in_progress') && d < now;
          const mappedStatus = activeStale ? 'Past' : (statusMap[a.status] || 'Upcoming');
          const effectiveRaw  = activeStale ? 'missed' : a.status;
          return {
            id: a.id,
            // Needed to look the doctor's real slot grid up when rescheduling.
            doctorId: a.doctor_staff_id || null,
            doctorName: a.staff?.name || 'Doctor',
            specialty: a.staff?.specialty || '',
            date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: a.type === 'video' ? 'Video Consultation' : a.type === 'homecare' ? 'Home Visit' : 'Clinic Visit',
            status: mappedStatus,
            rawStatus: effectiveRaw,
            scheduledAt: a.scheduled_at,
            rescheduleCount: Number(a.reschedule_count || 0),
            location: a.organisations?.name || '',
          };
        });
    } catch (e) {
      return MOCK_DATA.appointments;
    }
  },

  // The doctor's bookable grid for one date.
  //
  // This used to return a hardcoded capacity of 1 against a hardcoded list of
  // times that ignored doctor_schedules entirely — a doctor's availability
  // changed nothing about what a patient could book. It now returns whatever
  // doctor_availability() generates from their sessions, minus leave and
  // blocked slots, with live booked counts.
  //
  // `dateStr` is an ISO day (YYYY-MM-DD). Callers used to pass two different
  // formats to this same function; ISO is now the only accepted shape.
  //
  // Returns { slots, slotCapacity, bookedSlots, dayState } — slotCapacity and
  // bookedSlots are kept for the older call sites that still read them.
  getSlotAvailability: async (doctorId, dateStr, doctorNameFallback) => {
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))
      ? dateStr
      : localDay(dateStr ? new Date(dateStr) : new Date());

    // ── Mock mode: no real doctorId → check MOCK_DATA ────────────────────────
    if (!doctorId) {
      const bookedSlots = {};
      MOCK_DATA.appointments.forEach(a => {
        if (a.doctorName === doctorNameFallback && a.status === 'Upcoming') {
          bookedSlots[a.time] = (bookedSlots[a.time] || 0) + 1;
        }
      });
      return { slots: [], slotCapacity: 1, bookedSlots, dayState: 'off' };
    }

    try {
      const day = await fetchDayAvailability(doctorId, iso);
      const bookedSlots = {};
      day.slots.forEach((slot) => { bookedSlots[slot.label] = slot.booked; });
      return {
        slots: day.slots,
        sessions: day.sessions,
        dayState: day.state,
        counts: day.counts,
        // Highest capacity on the day — drives the "up to N patients/slot" note.
        slotCapacity: day.slots.reduce((max, s) => Math.max(max, s.capacity), 1),
        bookedSlots,
      };
    } catch (e) {
      return { slots: [], slotCapacity: 1, bookedSlots: {}, dayState: 'off' };
    }
  },

  // Creates a REAL appointment through book_appointment_slot.
  //
  // The old version read a count and then inserted in a separate round-trip —
  // two patients tapping the same slot at the same moment both passed the
  // check and both got a row. The RPC does the count and the insert inside one
  // transaction holding a per-slot advisory lock, and a BEFORE INSERT trigger
  // re-checks capacity regardless of how the row arrives. The slot genuinely
  // cannot be taken twice now.
  //
  // `newApp.at` is the slot instant returned by getSlotAvailability. Booking by
  // that value rather than re-deriving it from date+time strings also removes
  // the timezone drift the old parse introduced.
  addAppointment: async (newApp) => {
    const { data: { user } } = await supabase.auth.getUser();

    // ── Mock-mode duplicate guard (no real user or no doctorId) ──────────────
    if (!user || !newApp.doctorId) {
      const alreadyBooked = MOCK_DATA.appointments.some(
        a => a.doctorName === newApp.doctorName && a.status === 'Upcoming'
      );
      if (alreadyBooked) throw Object.assign(new Error('DUPLICATE'), { code: 'DUPLICATE' });
      MOCK_DATA.appointments.unshift(newApp);
      return newApp;
    }

    if (!newApp.at) {
      throw Object.assign(
        new Error('Please pick the slot again.'),
        { code: 'BAD_DATE' },
      );
    }

    // ── Guard: this profile already has an active booking with this doctor ───
    // Scoped to the active profile so two family members can each book the
    // same doctor. Excludes locally-cancelled ids — a cancel may not have
    // flushed to the DB yet.
    const familyId = getActiveFamilyMemberId();
    const activeBaseQuery = () => supabase
      .from('appointments')
      .select('id')
      .eq('patient_id', user.id)
      .eq('doctor_staff_id', newApp.doctorId)
      .in('status', ['scheduled', 'in_progress']);
    let { data: activeRows, error: activeErr } = await scopeByFamily(activeBaseQuery(), familyId);
    if (activeErr && isMissingFamilyColumn(activeErr)) {
      ({ data: activeRows } = await activeBaseQuery());
    }
    const dupCheck = (activeRows || []).find(a => !_localCancelled.has(a.id));
    if (dupCheck) throw Object.assign(new Error('DUPLICATE'), { code: 'DUPLICATE' });

    const typeMap = { 'Video Consultation': 'video', 'Video Call': 'video', 'Home Visit': 'homecare' };
    const fee = typeof newApp.fee === 'string'
      ? Number(newApp.fee.replace(/[^\d.]/g, '')) || 0
      : (newApp.fee || 0);

    // Capacity, schedule window, leave and blocks are all enforced server-side;
    // scheduleError() turns the raised name into e.code for the UI.
    const id = await bookSlot({
      doctorStaffId: newApp.doctorId,
      at: newApp.at,
      type: typeMap[newApp.type] || 'clinic',
      familyMemberId: familyId,
      fee,
      platformFee: 20,
    });
    return { ...newApp, id };
  },

  // Patient accepts the new time the provider suggested → status: 'scheduled' again
  acceptSuggestedTime: async (id) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'scheduled' })
        .eq('id', id);
      if (error) throw error;
    } catch (_) {}
    const mock = MOCK_DATA.appointments.find(a => a.id === id);
    if (mock) mock.rawStatus = 'scheduled';
    return { id, status: 'scheduled' };
  },

  // Max times a patient may reschedule before they must contact the hospital.
  MAX_RESCHEDULES: 3,

  // Returns how many times this appointment has been rescheduled (0 if unknown).
  getRescheduleCount: async (id) => {
    try {
      const { data } = await supabase
        .from('appointments').select('reschedule_count').eq('id', id).maybeSingle();
      return Number(data?.reschedule_count || 0);
    } catch (_) { return 0; }
  },

  // `at` is the slot instant from getSlotAvailability. Reschedule goes through
  // move_appointment_slot so it gets the same validation as a fresh booking —
  // it used to be a bare UPDATE, which could drop a patient onto a slot another
  // patient already held.
  rescheduleAppointment: async (id, newDate, newTime, at) => {
    // Mock-only appointment ids (no real DB row) still update MOCK_DATA so the
    // demo flow works.
    const mockOnly = MOCK_DATA.appointments.find(a => a.id === id);
    if (mockOnly) { mockOnly.date = newDate; mockOnly.time = newTime; return mockOnly; }

    if (!at) throw new Error('Please pick the new slot again.');

    // Enforce the reschedule limit
    const { data: row } = await supabase
      .from('appointments').select('reschedule_count').eq('id', id).maybeSingle();
    const count = Number(row?.reschedule_count || 0);
    if (count >= ApiService.MAX_RESCHEDULES) {
      throw Object.assign(new Error('RESCHEDULE_LIMIT'), { code: 'RESCHEDULE_LIMIT' });
    }

    // status='scheduled' re-triggers the provider's confirm flow and the
    // UPDATE realtime notification. Errors are thrown, never swallowed.
    await moveSlot({ appointmentId: id, at, status: 'scheduled', countReschedule: true });
    return { id, date: newDate, time: newTime };
  },

  cancelAppointment: async (id) => {
    // 1. Persist to AsyncStorage + in-memory Set so re-fetches never bring it back.
    await _persistCancelled(id);

    // 2. Update mock data if this was a demo booking
    const mockApp = MOCK_DATA.appointments.find(a => a.id === id);
    if (mockApp) mockApp.status = 'Cancelled';

    // 3. Update status in DB — requires the RLS policy below to be set in Supabase.
    try {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id);
    } catch (_) {}

    return { id, status: 'Cancelled' };
  },

  // ── Records / Health ─────────────────────────────────────────────────────────
  getRecords: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return MOCK_DATA.records;

      const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const sortKey = (d) => (d ? new Date(d).getTime() : 0);

      // Scope to whichever profile is active (account owner or a family member).
      const familyId = getActiveFamilyMemberId();

      // health_records: select with the doctor/hospital embed (needs
      // migration-016's organisation_id/created_by_staff_id columns). If
      // that migration hasn't run yet, the embed 42703s/PGRST200s — fall
      // back to a plain select so records still show, just without the
      // doctor/hospital name enrichment until it's applied.
      const loadHealthRecords = async () => {
        const withEmbed = () => supabase.from('health_records')
          .select('*, staff:created_by_staff_id(name, specialty), organisations(name)')
          .eq('patient_id', user.id);
        const plain = () => supabase.from('health_records').select('*').eq('patient_id', user.id);

        let { data, error } = await scopeByFamily(withEmbed(), familyId);
        if (error && isMissingFamilyColumn(error)) {
          ({ data, error } = await withEmbed());
        }
        if (error) {
          ({ data, error } = await scopeByFamily(plain(), familyId));
          if (error && isMissingFamilyColumn(error)) {
            ({ data, error } = await plain());
          }
        }
        if (error) console.warn('[getRecords] health_records:', error.message);
        return data || [];
      };

      // Aggregate everything the Records screen shows: clinical records,
      // payments (transactions, account-wide — not scoped per family member)
      // and medicine orders (pharmacy).
      const [recsData, txns, pharmData] = await Promise.all([
        loadHealthRecords(),
        supabase.from('transactions').select('id, amount, type, status, created_at').eq('patient_id', user.id),
        fetchWithFamilyFallback(() => supabase.from('pharmacy_orders')
          .select('id, order_id, items, status, total, created_at')
          .eq('patient_id', user.id), familyId),
      ]);
      const recs = { data: recsData };
      const pharm = { data: pharmData };

      const out = [];

      (recs.data || []).forEach(r => out.push({
        id: `rec-${r.id}`, type: r.type, title: r.title, provider: r.uploaded_by || '—',
        date: fmt(r.recorded_at), _ts: sortKey(r.recorded_at),
        category: r.type === 'lab_report' ? 'Lab Reports' : r.type === 'prescription' ? 'Prescriptions' : 'Medical History',
        icon: r.type === 'lab_report' ? 'flask-outline' : r.type === 'prescription' ? 'document-text-outline' : 'medical-outline',
        details: r.notes || '', status: '',
        // Extra fields used by Records.js to group into per-visit cards.
        appointmentId: r.appointment_id || null,
        organisationId: r.organisation_id || null,
        organisationName: r.organisations?.name || '',
        doctorName: r.staff?.name || '',
        uploadedBy: r.uploaded_by || '',
        fileUrl: r.file_url || null,
      }));

      (txns.data || []).forEach(t => out.push({
        id: `txn-${t.id}`, type: 'payment',
        title: t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : 'Payment',
        provider: 'Healio', date: fmt(t.created_at), _ts: sortKey(t.created_at),
        category: 'Payments', icon: 'wallet-outline', details: '',
        amount: `₹${Number(t.amount || 0).toLocaleString('en-IN')}`,
        status: t.status === 'completed' ? 'Paid' : (t.status || ''),
      }));

      (pharm.data || []).forEach(o => out.push({
        id: `ph-${o.id}`, type: 'pharmacy',
        title: `Pharmacy Order ${o.order_id || ''}`.trim(),
        provider: 'Pharmacy', date: fmt(o.created_at), _ts: sortKey(o.created_at),
        category: 'Medicine', icon: 'medkit-outline',
        details: Array.isArray(o.items) ? o.items.map(i => i.name || i).join(', ') : '',
        amount: o.total != null ? `₹${Number(o.total).toLocaleString('en-IN')}` : undefined,
        status: o.status === 'delivered' || o.status === 'dispensed' || o.status === 'completed' ? 'Delivered' : (o.status || ''),
      }));

      out.sort((a, b) => (b._ts || 0) - (a._ts || 0));
      return out;
    } catch (e) {
      return MOCK_DATA.records;
    }
  },

  // Patient adds their own document (e.g. an old prescription, a report from
  // outside Healio) straight into their record vault. `asset` is the object
  // returned by expo-image-picker: { uri, base64 }. Uses the same base64 →
  // Uint8Array upload approach as ProfileSetup.js — more reliable on Android
  // than fetch(uri).blob().
  addPatientRecord: async ({ title, type = 'other', notes = '', asset }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please log in to add a record.');
    if (!asset?.base64) throw new Error('No file selected.');

    const ext = (asset.mimeType?.split('/').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const binaryStr = atob(asset.base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const { error: upErr } = await supabase.storage
      .from('records')
      .upload(path, bytes, { contentType: asset.mimeType || `image/${ext}`, upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('records').getPublicUrl(path);

    const familyId = getActiveFamilyMemberId();
    const insertRow = {
      patient_id: user.id,
      family_member_id: familyId,
      type,
      title: title || 'My Upload',
      file_url: pub.publicUrl,
      notes,
      recorded_at: new Date().toISOString().slice(0, 10),
      uploaded_by: 'patient',
    };
    let { error } = await supabase.from('health_records').insert(insertRow);
    if (error && isMissingFamilyColumn(error)) {
      const { family_member_id, ...withoutFamily } = insertRow;
      ({ error } = await supabase.from('health_records').insert(withoutFamily));
    }
    if (error) throw error;
    return { ok: true, fileUrl: pub.publicUrl };
  },

  // ── Providers / Doctors ──────────────────────────────────────────────────────
  getDoctors: async () => {
    return withFallback(async () => {
      const { data } = await supabase
        .from('staff').select('id, name, specialty, rating, consultation_fee, organisation_id, organisations(name, city, type, consultation_fee)')
        .eq('role', 'doctor').eq('status', 'active').limit(50);
      return (data || []).map(d => {
        const fee = d.consultation_fee ?? d.organisations?.consultation_fee ?? 300;
        // A solo practitioner is their OWN one-person organisation, typed
        // 'clinic' (migration-057) — so the split is on the org's type, not on
        // whether an organisation_id exists. Anything else is hospital-backed.
        const solo = d.organisations?.type === 'clinic';
        return {
          id: d.id,
          organisationId: d.organisation_id,
          name: d.name,
          specialty: d.specialty || 'General Physician',
          rating: d.rating != null ? Number(d.rating) : null,
          reviews: 0,
          location: d.organisations?.city || 'Dhaka',
          distance: null,
          experience: '—',
          fee: `₹${Number(fee)}`,
          feeValue: Number(fee),
          // An individual doctor practises under their own name, so showing the
          // "clinic" as a hospital would read as a second, separate provider.
          hospital: solo ? '' : (d.organisations?.name || ''),
          source: solo || !d.organisation_id ? 'individual' : 'hospital',
          workingHours: { start: 9, end: 17, days: [1, 2, 3, 4, 5, 6] },
        };
      });
    }, MOCK_DATA.doctors);
  },

  // Doctors that belong to a specific hospital — used by HospitalDetail so a
  // patient can pick a doctor at that hospital and book them directly.
  getDoctorsByHospital: async (organisationId) => {
    if (!organisationId) return [];
    try {
      const { data } = await supabase
        .from('staff')
        .select('id, name, specialty, rating, consultation_fee, organisation_id, organisations(name, city, consultation_fee)')
        .eq('role', 'doctor').eq('status', 'active')
        .eq('organisation_id', organisationId);
      return (data || []).map(d => {
        const fee = d.consultation_fee ?? d.organisations?.consultation_fee ?? 300;
        return {
          id: d.id,
          organisationId: d.organisation_id,
          name: d.name,
          specialty: d.specialty || 'General Physician',
          rating: d.rating != null ? Number(d.rating) : null,
          location: d.organisations?.city || '',
          distance: null,
          fee: `₹${Number(fee)}`,
          feeValue: Number(fee),
          hospital: d.organisations?.name || '',
          source: 'hospital',
          workingHours: { start: 9, end: 17, days: [1, 2, 3, 4, 5, 6] },
        };
      });
    } catch (e) {
      return [];
    }
  },

  // ── Labs & pharmacies ────────────────────────────────────────────────────────
  //
  // These come in two shapes and only ONE of them is an organisation. A
  // standalone provider has its own `organisations` row (type 'diagnostic' /
  // 'pharmacy'); a hospital's lab or pharmacy is a `staff` row inside the
  // hospital (role 'lab_technician' / 'pharmacy_assistant', `department` naming
  // the unit). Querying organisations alone — as this did — hides every
  // hospital-run lab and pharmacy, which is most of them.
  //
  // rmp_service_facilities (migration-051) returns both as one catalog. It has
  // no RMP gate despite the name — it is a public catalog, the same data the
  // hospital list already exposes — so the patient app reads it too.
  //
  // Deliberately NOT wrapped in withFallback: an empty result must render the
  // list's own "no results" state. Falling back to MOCK_DATA put fictional
  // providers ("Apollo Diagnostics, Dhaka") in front of patients, who could
  // then raise a real order against an id that exists nowhere.
  getFacilities: async (kind) => {
    const { data, error } = await supabase.rpc('rmp_service_facilities', { p_kind: kind });
    if (error) {
      console.warn('rmp_service_facilities:', error.message);
      return [];
    }
    return (data || []).map(f => ({
      id: f.id,
      organisationId: f.organisation_id,
      name: f.unit ? `${f.org_name} · ${f.unit}` : f.org_name,
      unit: f.unit || null,
      source: f.source,
      type: f.source === 'hospital' ? `Inside ${f.org_name}` : (kind === 'lab' ? 'Diagnostic centre' : 'Pharmacy'),
      location: f.city || '',
      address: f.address || '',
      distance: null,
      rating: null,
    }));
  },

  getLabs: async () => ApiService.getFacilities('lab'),

  getPharmacies: async () => ApiService.getFacilities('pharmacy'),

  // ── Hospitals ────────────────────────────────────────────────────────────────
  getHospitals: async () => {
    try {
      // Try with location columns (migration 014). If they don't exist yet,
      // fall back to the core columns so the hospital list never breaks.
      let { data, error } = await supabase
        .from('organisations')
        .select('id, name, city, beds, is_test, status, address, latitude, longitude')
        .eq('type', 'hospital')
        .or('status.eq.active,is_test.eq.true')
        .limit(50);
      if (error) {
        const res = await supabase
          .from('organisations')
          .select('id, name, city, beds, is_test, status')
          .eq('type', 'hospital')
          .or('status.eq.active,is_test.eq.true')
          .limit(50);
        data = res.data;
      }
      return (data || []).map(o => ({
        id: o.id,
        name: o.name,
        distance: null,
        rating: null,
        location: o.city || 'Dhaka',
        address: o.address || '',
        latitude: o.latitude != null ? Number(o.latitude) : null,
        longitude: o.longitude != null ? Number(o.longitude) : null,
        type: o.is_test ? 'Test Hospital' : 'Multispecialty',
        beds: o.beds ? `${o.beds}+` : '200+',
        specialties: 'General, Surgery, ICU',
        emergency: '24/7 Emergency',
        phone: '—',
      }));
    } catch (e) {
      console.error('Failed to load hospitals from Supabase', e);
      return [];
    }
  },

  // ── Services ─────────────────────────────────────────────────────────────────
  getHomeCare: async () => {
    await ApiService.sleep();
    // const { data } = await supabase.from('providers').select('*').eq('type', 'homecare').eq('status', 'active');
    // return data;
    return MOCK_DATA.homeCare || [];
  },

  getEmergency: async () => {
    await ApiService.sleep();
    // const { data } = await supabase.from('emergency_services').select('*');
    // return data;
    return MOCK_DATA.emergency || [];
  },

  getAmbulance: async () => {
    await ApiService.sleep();
    // const { data } = await supabase.from('ambulance_services').select('*');
    // return data;
    return MOCK_DATA.ambulance || [];
  },

  getInsurance: async () => {
    await ApiService.sleep();
    // const { data } = await supabase.from('insurance_plans').select('*');
    // return data;
    return MOCK_DATA.insurance || [];
  },

  getLocations: async () => {
    await ApiService.sleep();
    // const { data: { user } } = await supabase.auth.getUser();
    // const { data } = await supabase.from('saved_addresses').select('*').eq('user_id', user.id);
    // return data;
    return MOCK_DATA.locations;
  },

  // ── Wallet ───────────────────────────────────────────────────────────────────
  getWalletBalance: async () => {
    await ApiService.sleep();
    // const { data: { user } } = await supabase.auth.getUser();
    // const { data } = await supabase.from('wallets').select('balance').eq('patient_id', user.id).single();
    // return data?.balance ?? 0;
    return MOCK_DATA.user?.walletBalance ?? 0;
  },

  getWalletTransactions: async () => {
    await ApiService.sleep();
    // const { data: { user } } = await supabase.auth.getUser();
    // const { data } = await supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    // return data;
    return MOCK_DATA.transactions || [];
  },

  topUpWallet: async (amount, method) => {
    await ApiService.sleep(300);
    // const { data: { user } } = await supabase.auth.getUser();
    // await supabase.from('transactions').insert({ user_id: user.id, type: 'topup', amount, method, status: 'completed' });
    // await supabase.rpc('increment_wallet_balance', { user_id: user.id, amount });
    if (MOCK_DATA.user) MOCK_DATA.user.walletBalance = (MOCK_DATA.user.walletBalance || 0) + amount;
    return { success: true };
  },
};
