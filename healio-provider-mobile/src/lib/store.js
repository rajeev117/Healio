import { create } from 'zustand';
import { supabase, emailFromPhone } from './supabase';
import { moveSlot } from './schedule';

// Parse a fee string like "₹800" / "800" into a number, or null when empty
// (null tells the DB to fall back to the hospital's default consultation fee).
function parseFeeAmount(fee) {
  const digits = String(fee ?? '').replace(/[^\d.]/g, '');
  return digits ? Number(digits) : null;
}

export const useStore = create((set, get) => ({
  doctors: [],
  patients: [],
  pharmacy: [],
  labs: [],
  homecare: [],
  schedules: [],
  walletBalance: 0,
  subscription: {
    holdAmount: 5000,
    activatedAt: null,
  },
  businessProfile: {
    name: '',
    city: '',
    logoUri: null,
    address: '',
    phone: '',
    email: '',
    beds: '',
    departments: [],
  },

  // Earnings & payouts (frontend mock)
  availableEarnings: 0,
  pendingEarnings: 0,
  ledger: [], // ledger entries: top-ups, service earnings, commissions, refunds, payouts
  payouts: [],

  // Actions
  setBusinessProfile: (patch) => {
    set((state) => ({
      businessProfile: {
        ...state.businessProfile,
        ...patch,
      }
    }));
  },

  topUpWallet: (amount) => {
    if (!amount || amount <= 0) return false;
    set((state) => ({
      walletBalance: (state.walletBalance || 0) + amount,
      availableEarnings: (state.availableEarnings || 0) + amount,
    }));
    return true;
  },

  purchaseSubscription: () => {
    const state = get();
    const holdAmount = state.subscription?.holdAmount || 5000;
    if ((state.walletBalance || 0) < holdAmount) return false;

    const activatedAt = new Date().toISOString();
    set((current) => ({
      walletBalance: (current.walletBalance || 0) - holdAmount,
      subscription: {
        ...current.subscription,
        holdAmount,
        activatedAt,
      },
    }));
    return true;
  },

  isSubscriptionActive: () => {
    const state = get();
    return Boolean(state.subscription?.activatedAt);
  },

  // Earnings actions
  addEarning: (entry) => {
    // entry: { id?, type, gross, platformFee, net, status='pending'|'available', reference?, date }
    set((s) => {
      const e = { id: entry.id || `e-${Date.now()}`, date: entry.date || Date.now(), status: entry.status || 'pending', ...entry };
      const ledger = (s.ledger || []).concat(e);
      const next = {};
      if (e.status === 'available') next.availableEarnings = (s.availableEarnings || 0) + (e.net || 0);
      else next.pendingEarnings = (s.pendingEarnings || 0) + (e.net || 0);
      return { ledger, ...next };
    });
  },

  // Request a payout from available earnings. Persisted to the `payouts`
  // table (migration-034) — this used to be purely in-memory, so a
  // "successful" request vanished on the next reload with no record
  // anywhere that it happened.
  requestPayout: async (amount, method = 'bank') => {
    const state = get();
    const avail = state.availableEarnings || 0;
    if (amount <= 0 || amount > avail) return false;
    try {
      const orgId = await get().resolveOrgId();
      if (!orgId) return false;
      const { data, error } = await supabase
        .from('payouts')
        .insert({ organisation_id: orgId, amount, method, status: 'requested' })
        .select('id, requested_at').single();
      if (error) throw error;
      set((s) => ({
        payouts: [{ id: data.id, amount, method, status: 'requested', requestedAt: new Date(data.requested_at).getTime() }, ...(s.payouts || [])],
        availableEarnings: Math.max(0, (s.availableEarnings || 0) - amount),
      }));
      return true;
    } catch (e) {
      console.warn('[requestPayout] failed:', e?.message);
      return false;
    }
  },

  // Mark payout completed/failed (admin/back-office action)
  finalizePayout: async (payoutId, success = true) => {
    set((s) => {
      const payouts = (s.payouts || []).map((p) => (p.id === payoutId ? { ...p, status: success ? 'paid' : 'failed', completedAt: Date.now() } : p));
      return { payouts };
    });
    try {
      await supabase.from('payouts').update({ status: success ? 'paid' : 'failed', completed_at: new Date().toISOString() }).eq('id', payoutId);
    } catch (e) { /* local state already updated; DB write is best-effort here */ }
  },

  isPayoutsEnabled: () => {
    const s = get();
    // placeholder for KYC/payout setup checks
    return true;
  },

  addTransaction: (tx) => {
    // legacy: append to ledger and update balances
    get().addEarning({ id: tx.id, type: tx.type, gross: tx.amount, platformFee: 0, net: tx.amount, status: 'available', reference: tx.reference, date: tx.date });
  },

  // Initialize earnings state from persistent storage is intentionally disabled.
  initWalletFromStorage: async () => {},

  // Compute real earnings from this hospital's appointments.
  //   available = net of completed appointments (fee − platform_fee)
  //   pending   = net of scheduled/confirmed appointments not yet completed
  loadEarnings: async () => {
    try {
      const orgId = await get().resolveOrgId();
      if (!orgId) return;

      const { data: appts } = await supabase
        .from('appointments')
        .select('status, fee, platform_fee, scheduled_at, profiles(name), staff(name)')
        .eq('organisation_id', orgId);
      if (!appts) return;

      const net = (a) => Math.max(0, Number(a.fee || 0) - Number(a.platform_fee || 0));
      let available = 0, pending = 0;
      const ledger = [];
      appts.forEach((a) => {
        const n = net(a);
        if (n <= 0) return;
        const done = a.status === 'completed';
        if (done) available += n; else pending += n;
        ledger.push({
          id: `appt-${a.scheduled_at}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'Consultation', gross: Number(a.fee || 0), platformFee: Number(a.platform_fee || 0),
          net: n, status: done ? 'available' : 'pending',
          reference: a.profiles?.name || 'Patient', date: a.scheduled_at,
        });
      });
      ledger.sort((x, y) => new Date(y.date) - new Date(x.date));

      // Subtract already-requested/paid payouts (migration-034) from
      // available — without this, "available" never goes down after a
      // payout since it's recomputed fresh from appointments every time.
      let payouts = get().payouts || [];
      try {
        const { data: payoutRows, error: payoutErr } = await supabase
          .from('payouts').select('*').eq('organisation_id', orgId).order('requested_at', { ascending: false });
        if (payoutErr) throw payoutErr;
        payouts = (payoutRows || []).map(p => ({
          id: p.id, amount: Number(p.amount || 0), method: p.method, status: p.status,
          requestedAt: new Date(p.requested_at).getTime(),
          completedAt: p.completed_at ? new Date(p.completed_at).getTime() : null,
        }));
        const deducted = payouts.filter(p => p.status !== 'failed').reduce((sum, p) => sum + p.amount, 0);
        available = Math.max(0, available - deducted);
      } catch (e) {
        // migration-034 not applied yet — skip payout deduction, keep
        // whatever's already in local state.
      }

      set({ availableEarnings: available, pendingEarnings: pending, ledger, payouts });
    } catch (e) { /* keep current values */ }
  },

  // Resolve the logged-in user's hospital (staff member or hospital admin).
  // Tries four strategies in order so it works even when user_id linking hasn't run yet.
  resolveOrgId: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { console.warn('[resolveOrgId] no auth user'); return null; }

      // 1. Staff member linked by user_id
      const { data: staffById } = await supabase
        .from('staff').select('organisation_id').eq('user_id', user.id).maybeSingle();
      if (staffById?.organisation_id) return staffById.organisation_id;

      // 2. Hospital admin linked by admin_user_id
      const { data: orgById } = await supabase
        .from('organisations').select('id').eq('admin_user_id', user.id).maybeSingle();
      if (orgById?.id) return orgById.id;

      // 3. Not linked yet → claim_account() links staff/org server-side
      //    (a direct UPDATE is blocked by RLS). Then re-read.
      try { await supabase.rpc('claim_account'); } catch (_) {}

      const { data: staff2 } = await supabase
        .from('staff').select('organisation_id').eq('user_id', user.id).maybeSingle();
      if (staff2?.organisation_id) return staff2.organisation_id;

      const { data: org2 } = await supabase
        .from('organisations').select('id').eq('admin_user_id', user.id).maybeSingle();
      if (org2?.id) return org2.id;

      console.warn('[resolveOrgId] no org found for user', user.id, user.email);
      return null;
    } catch (e) {
      console.error('[resolveOrgId] error:', e);
      return null;
    }
  },

  // Add a doctor to the staff table (role = doctor), scoped to this hospital.
  // The auth account links later on the doctor's first phone-OTP login.
  // Returns { id } on success or { error } on failure.
  addDoctor: async (d) => {
    const orgId = await get().resolveOrgId();
    if (!orgId) return { error: 'No hospital context. Please re-login.' };
    const phone10 = String(d.phone || '').replace(/\D/g, '').slice(-10);
    if (phone10.length !== 10) return { error: 'A valid 10-digit phone number is required.' };
    const fee = parseFeeAmount(d.fee);
    const { data, error } = await supabase.from('staff').insert({
      staff_id: `DR-${Date.now().toString().slice(-5)}`,
      organisation_id: orgId,
      name: String(d.name || '').trim(),
      role: 'doctor',
      specialty: d.speciality || null,
      department: d.department || null,
      phone: `+91${phone10}`,
      email: emailFromPhone(phone10),   // deterministic login email
      status: 'active',
      consultation_fee: fee,            // null → hospital default
      patients_per_slot: d.slotsPerDay ? Number(String(d.slotsPerDay).replace(/\D/g, '')) || null : null,
      verified_at: new Date().toISOString(),
      is_test: false,
    }).select('id').single();
    if (error) return { error: error.message };
    await get().hydrateFromSupabase();
    return { id: data?.id };
  },

  // Update a doctor's profile in the staff table, then re-hydrate.
  updateDoctor: async (id, patch) => {
    const update = {};
    if (patch.name != null) update.name = String(patch.name).trim();
    if (patch.speciality != null) update.specialty = patch.speciality || null;
    if (patch.department != null) update.department = patch.department || null;
    if (patch.fee != null) update.consultation_fee = parseFeeAmount(patch.fee);
    if (patch.slotsPerDay != null) update.patients_per_slot = Number(String(patch.slotsPerDay).replace(/\D/g, '')) || null;
    if (patch.email != null) update.email = patch.email || null;
    if (patch.phone != null) {
      const phone10 = String(patch.phone).replace(/\D/g, '').slice(-10);
      if (phone10.length === 10) update.phone = `+91${phone10}`;
    }
    const { error } = await supabase.from('staff').update(update).eq('id', id);
    if (error) return { error: error.message };
    await get().hydrateFromSupabase();
    return {};
  },

  // Flip a doctor's active status. Optimistically updates the UI, then persists;
  // re-hydrates on failure to fall back to the true DB state.
  toggleDoctorActive: async (id) => {
    const current = get().doctors.find((d) => d.id === id);
    const nextActive = !(current?.active);
    set((state) => ({
      doctors: state.doctors.map((d) => (d.id === id ? { ...d, active: nextActive } : d)),
    }));
    const { error } = await supabase
      .from('staff').update({ status: nextActive ? 'active' : 'inactive' }).eq('id', id);
    if (error) await get().hydrateFromSupabase();
  },

  // Operations status
  setPharmacyStatus: (id, status) => {
    set((state) => ({
      pharmacy: state.pharmacy.map((o) => (o.id === id ? { ...o, status } : o))
    }));
  },

  setLabStatus: (id, status) => {
    set((state) => ({
      labs: state.labs.map((o) => (o.id === id ? { ...o, status } : o))
    }));
  },

  setHomeStatus: (id, status) => {
    set((state) => ({
      homecare: state.homecare.map((o) => (o.id === id ? { ...o, status } : o))
    }));
  },

  // Schedules
  upsertSchedule: (s) => {
    set((state) => {
      const exists = state.schedules.some((x) => x.id === s.id);
      return {
        schedules: exists
          ? state.schedules.map((x) => (x.id === s.id ? s : x))
          : [...state.schedules, s]
      };
    });
  },

  deleteSchedule: (id) => {
    set((state) => ({
      schedules: state.schedules.filter((x) => x.id !== id)
    }));
  },
  
  getPatient: (id) => {
    return get().patients.find((p) => p.id === id);
  },

  // ── Supabase hydration ───────────────────────────────────────────────────────
  // Loads everything for the logged-in user's hospital and maps DB rows back to
  // the shapes the screens already use. Falls back to mock arrays on error/empty
  // so the app never breaks. Call once after login.
  hydrateFromSupabase: async () => {
    try {
      const orgId = await get().resolveOrgId();
      if (!orgId) return;

      const PH = { pending:'Pending', confirmed:'Pending', processing:'Dispatched', out_for_delivery:'Dispatched', ready:'Dispatched', completed:'Delivered', dispensed:'Delivered', cancelled:'Pending' };
      const LB = { pending:'Sample pending', confirmed:'Sample pending', processing:'Processing', ready:'Report ready', completed:'Delivered', dispensed:'Delivered', cancelled:'Sample pending' };
      const HC = { pending:'Scheduled', confirmed:'Active', processing:'Active', completed:'Completed', cancelled:'Cancelled', ready:'Active', out_for_delivery:'Active', dispensed:'Completed' };

      // QR check-ins are the walk-in front door (migration-043): only the last
      // 24h count — that's the consent window for assigning a doctor.
      const checkinSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [org, staff, appts, ph, lab, hc, checkins, emadms] = await Promise.all([
        supabase.from('organisations').select('*').eq('id', orgId).maybeSingle(),
        supabase.from('staff').select('*').eq('organisation_id', orgId).eq('role','doctor'),
        // Appointments: join patient profile via patient_id FK and doctor via doctor_staff_id FK
        supabase.from('appointments')
          .select('*, patient:profiles!patient_id(id, name, gender, phone, blood_group, city), doctor:staff!doctor_staff_id(name, specialty)')
          .eq('organisation_id', orgId)
          .order('scheduled_at', { ascending: false }),
        supabase.from('pharmacy_orders').select('*, profiles!patient_id(name)').eq('organisation_id', orgId),
        supabase.from('lab_orders').select('*, profiles!patient_id(name)').eq('organisation_id', orgId),
        supabase.from('homecare_orders').select('*, profiles!patient_id(name)').eq('organisation_id', orgId),
        supabase.from('qr_checkins')
          .select('id, patient_id, kind, status, created_at, patient:profiles!patient_id(id, name, gender, phone, blood_group, city)')
          .eq('organisation_id', orgId)
          .gte('created_at', checkinSince)
          .order('created_at', { ascending: false }),
        // Accepted RMP emergency admissions (migration-046) — the patient is on
        // the way; they belong in the Patients list even with no appointment.
        supabase.from('emergency_admissions')
          .select('id, patient_id, status, created_at, patient:profiles!patient_id(id, name, gender, phone, blood_group, city)')
          .eq('organisation_id', orgId)
          .eq('status', 'accepted')
          .gte('created_at', checkinSince)
          .order('created_at', { ascending: false }),
      ]);

      // Patients: derive from appointments — patients are individual users, not org members
      const seenPatientIds = new Set();
      const uniquePatients = (appts.data || [])
        .filter(a => a.patient?.id && !seenPatientIds.has(a.patient.id) && seenPatientIds.add(a.patient.id))
        .map(a => a.patient);

      const apptRows = appts.data || [];
      const countFor = (sid) => apptRows.filter(a => a.doctor_staff_id === sid && ['scheduled','in_progress'].includes(a.status)).length;

      // Map patient_id → their latest appointment status
      const patientLatestStatus = {};
      [...apptRows].reverse().forEach(a => {
        if (a.patient_id) patientLatestStatus[a.patient_id] = a.status;
      });
      // appointment status → human label for patient card
      const apptStatusLabel = {
        scheduled:   'Pending Confirmation',
        in_progress: 'Confirmed',
        suggested:   'Time Suggested',
        completed:   'Completed',
        cancelled:   'Cancelled',
      };

      // Logged in → show this hospital's REAL data, even when a list is empty.
      // (Never leave mock doctors/patients showing once we know the org.)
      const next = {};

      // Real hospital identity for Home/Profile headers.
      if (org.data) {
        const o = org.data;
        next.businessProfile = {
          ...get().businessProfile,
          name: o.name || get().businessProfile.name,
          city: o.city || get().businessProfile.city,
          address: o.address || '',
          phone: o.admin_phone || '',
          email: o.admin_email || '',
          beds: o.beds != null ? String(o.beds) : '',
          departments: Array.isArray(o.departments) && o.departments.length
            ? o.departments : get().businessProfile.departments,
          // Centralized consultation defaults — prefill the doctor form
          defaultFee: o.consultation_fee != null ? String(o.consultation_fee) : '',
          defaultPatientsPerSlot: o.default_patients_per_slot != null ? String(o.default_patients_per_slot) : '',
        };
      }

      next.doctors = (staff.data || []).map(s => ({
        id: s.id, name: s.name, speciality: s.specialty || 'General', department: s.department || 'General',
        today: countFor(s.id), rating: Number(s.rating || 0),
        fee: s.consultation_fee != null ? `₹${s.consultation_fee}` : '₹500',
        slotsPerDay: s.patients_per_slot != null ? String(s.patients_per_slot) : '',
        phone: s.phone || '', email: s.email || '', active: s.status === 'active',
      }));
      // Latest UNHANDLED check-in per patient — a fresh scan puts (or bumps)
      // the patient in the list as "Checked in" until a doctor is assigned.
      const checkinRows = checkins.data || [];
      const newCheckinByPatient = {};
      checkinRows.forEach(c => {
        if (c.status === 'new' && !newCheckinByPatient[c.patient_id]) newCheckinByPatient[c.patient_id] = c;
      });

      // Patients: unique patients derived from appointments (not profiles.organisation_id —
      // patients are individual users, not members of a hospital organisation).
      next.patients = uniquePatients.map(p => ({
        id: p.id, name: p.name || 'Patient', age: '—', gender: p.gender || '—',
        lastVisit: newCheckinByPatient[p.id] ? 'Today' : 'Recent',
        status: newCheckinByPatient[p.id] ? 'Checked in'
          : (apptStatusLabel[patientLatestStatus[p.id]] || 'OPD'),
        phone: p.phone || '', email: p.email || '',
        bloodGroup: p.blood_group || '—', address: p.city || '', allergies: [],
        conditions: [], history: [], appointments: [],
      }));

      // Walk-ins: checked-in patients with no appointment history here yet.
      checkinRows.forEach(c => {
        const p = c.patient;
        if (!p?.id || seenPatientIds.has(p.id)) return;
        seenPatientIds.add(p.id);
        next.patients.unshift({
          id: p.id, name: p.name || 'Patient', age: '—', gender: p.gender || '—',
          lastVisit: 'Today',
          status: c.status === 'new' ? 'Checked in' : 'OPD',
          phone: p.phone || '', email: p.email || '',
          bloodGroup: p.blood_group || '—', address: p.city || '', allergies: [],
          conditions: [], history: [], appointments: [],
        });
      });

      // Accepted emergency admissions: the patient is inbound — pin them on
      // top with an Emergency badge (overrides whatever status they had).
      (emadms.data || []).forEach(e => {
        const p = e.patient;
        if (!p?.id) return;
        const existing = next.patients.find(x => x.id === p.id);
        if (existing) {
          existing.status = 'Emergency';
          existing.lastVisit = 'Today';
          next.patients = [existing, ...next.patients.filter(x => x.id !== p.id)];
          return;
        }
        seenPatientIds.add(p.id);
        next.patients.unshift({
          id: p.id, name: p.name || 'Patient', age: '—', gender: p.gender || '—',
          lastVisit: 'Today', status: 'Emergency',
          phone: p.phone || '', email: p.email || '',
          bloodGroup: p.blood_group || '—', address: p.city || '', allergies: [],
          conditions: [], history: [], appointments: [],
        });
      });
      next.pharmacy = (ph.data || []).map(o => ({
        id: o.order_id || o.id,
        dbId: o.id,                                   // real UUID for updates
        patient: o.profiles?.name || '—',
        medicines: Array.isArray(o.items) ? o.items.map(i => i.name || i) : [],
        items: Array.isArray(o.items) ? o.items.length : 0,
        total: '₹' + Number(o.total || 0).toLocaleString('en-IN'),
        rawStatus: o.status,
        status: PH[o.status] || 'Pending',
        dispenseNote: o.dispense_note || '',
      }));
      next.labs = (lab.data || []).map(o => ({
        id: o.order_id || o.id,
        dbId: o.id,                                   // real UUID for updates
        patientId: o.patient_id,                      // needed to suggest a doctor follow-up
        patient: o.profiles?.name || '—',
        department: o.department || null,             // which lab the order is for
        tests: Array.isArray(o.tests) ? o.tests.map(t => t.name || t) : [],
        test: Array.isArray(o.tests) && o.tests[0]?.name ? o.tests[0].name : 'Lab Test',
        rawStatus: o.status,
        status: LB[o.status] || 'Sample pending',
        reportUrl: o.report_url || null,
        resultNote: o.result_note || '',
      }));
      next.homecare = (hc.data || []).map(o => ({
        id: o.order_id || o.id,
        dbId: o.id,                             // real UUID for Supabase updates
        patient: o.profiles?.name || '—',
        package: o.service_name || 'Home Care',
        days: 1,
        status: HC[o.status] || 'Scheduled',
      }));

      set(next);
    } catch (e) {
      console.error('[hydrateFromSupabase] error:', e?.message || e);
    }
  },

  // Home dashboard aggregates (real): today's revenue, 7-day trend, today's queue.
  homeToday: 0,
  homeTrend: [0, 0, 0, 0, 0, 0, 0],
  homeAppointments: [],
  pendingAdmits: 0,
  loadHomeDashboard: async () => {
    try {
      const orgId = await get().resolveOrgId();
      if (!orgId) return;

      const start = new Date(); start.setHours(0, 0, 0, 0);
      const weekAgo = new Date(start); weekAgo.setDate(weekAgo.getDate() - 6);

      const [{ data: appts }, { data: hc }] = await Promise.all([
        supabase.from('appointments')
          .select('fee, status, scheduled_at, type, patient:profiles!patient_id(name), doctor:staff!doctor_staff_id(name)')
          .eq('organisation_id', orgId)
          .gte('scheduled_at', weekAgo.toISOString())
          .order('scheduled_at'),
        supabase.from('homecare_orders')
          .select('status').eq('organisation_id', orgId)
          .in('status', ['pending', 'confirmed']),
      ]);

      const rows = appts || [];
      const startMs = start.getTime();
      const todayRows = rows.filter(a => new Date(a.scheduled_at).getTime() >= startMs);
      const billableStatuses = ['completed', 'in_progress', 'scheduled'];
      const todayRevenue = todayRows
        .filter(a => billableStatuses.includes(a.status))
        .reduce((s, a) => s + Number(a.fee || 0), 0);

      // 7-day revenue trend (oldest → newest)
      const trend = Array.from({ length: 7 }, () => 0);
      rows.filter(a => billableStatuses.includes(a.status)).forEach(a => {
        const idx = Math.floor((new Date(a.scheduled_at).setHours(0, 0, 0, 0) - weekAgo.getTime()) / 86400000);
        if (idx >= 0 && idx < 7) trend[idx] += Number(a.fee || 0);
      });

      set({
        homeToday: todayRevenue,
        homeTrend: trend.some(v => v > 0) ? trend : [0, 0, 0, 0, 0, 0, 1],
        homeAppointments: todayRows.slice(0, 3).map((a, i) => ({
          id: `${a.scheduled_at}-${i}`,
          patient: a.patient?.name || 'Patient',
          doctor: a.doctor?.name || 'Doctor',
          // Needed to look up that doctor's real slots when suggesting a time.
          doctorStaffId: a.doctor_staff_id || null,
          type: a.type || 'clinic',
          time: new Date(a.scheduled_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          // Consultation journey shown on the hospital dashboard:
          // checked-in/booked → Arrived, with the doctor → Examining, done → Completed.
          status: a.status === 'completed' ? 'completed' : a.status === 'in_progress' ? 'examining' : 'arrived',
        })),
        pendingAdmits: (hc || []).length,
      });
    } catch (e) { /* keep defaults */ }
  },

  // Full appointment list for the org (used by the Appointments manager screen).
  appointmentsList: [],
  loadAppointmentsList: async () => {
    try {
      const orgId = await get().resolveOrgId();
      console.log('[appointments] resolveOrgId →', orgId);
      if (!orgId) {
        console.warn('[appointments] No orgId — skipping query. Check admin_user_id / user_id linking.');
        return;
      }
      const { data, error } = await supabase
        .from('appointments')
        .select('id, fee, status, scheduled_at, created_at, reminder_sent, type, rmp_id, doctor_staff_id, patient:profiles!patient_id(name), doctor:staff!doctor_staff_id(name)')
        .eq('organisation_id', orgId)
        .order('scheduled_at', { ascending: false });
      console.log('[appointments] rows:', data?.length, '| error:', error?.message);
      if (error) { console.error('[appointments] query error:', error); return; }
      set({
        appointmentsList: (data || []).map(a => ({
          id: a.id,
          patient: a.patient?.name || 'Patient',
          doctor: a.doctor?.name || 'Doctor',
          type: a.type || 'clinic',
          status: a.status,
          fee: Number(a.fee || 0),
          time: new Date(a.scheduled_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
          scheduledAt: a.scheduled_at,
          bookedAt: a.created_at,
          reminderSent: a.reminder_sent || false,
          // rmp_id is set only when a Registered Medical Practitioner booked this
          // on the patient's behalf → surface it as a "booked through RMP" flag.
          bookedByRmp: !!a.rmp_id,
        })),
      });
    } catch (e) { console.error('[appointments] unexpected error:', e); }
  },

  // Back-compat names → all delegate to the single hydrator
  fetchDoctors: async () => get().hydrateFromSupabase(),
  fetchPatients: async () => get().hydrateFromSupabase(),
  fetchAppointments: async () => get().hydrateFromSupabase(),
  fetchOrders: async () => get().hydrateFromSupabase(),

  // ── Appointment workflow actions ──────────────────────────────────────────────

  // Resolve who the current user is when confirming (doctor vs hospital admin).
  resolveConfirmer: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: staffRow } = await supabase
          .from('staff').select('role, name').eq('user_id', user.id).maybeSingle();
        if (staffRow?.role === 'doctor') return { role: 'doctor', name: staffRow.name || 'Doctor' };
      }
    } catch (_) {}
    return { role: 'hospital_admin', name: get().businessProfile?.name || 'Hospital' };
  },

  // Accept a patient's booking request → status: in_progress (confirmed).
  // Records WHO confirmed so the other party + patient can be notified.
  acceptAppointment: async (appointmentId) => {
    set((s) => ({
      appointmentsList: (s.appointmentsList || []).map(a =>
        a.id === appointmentId ? { ...a, status: 'in_progress' } : a
      ),
    }));
    try {
      const who = await get().resolveConfirmer();
      const { error } = await supabase.from('appointments')
        .update({ status: 'in_progress', confirmed_by_role: who.role, confirmed_by_name: who.name })
        .eq('id', appointmentId);
      return !error;
    } catch { return false; }
  },

  // Decline a patient's booking → status: cancelled
  declineAppointment: async (appointmentId) => {
    set((s) => ({
      appointmentsList: (s.appointmentsList || []).map(a =>
        a.id === appointmentId ? { ...a, status: 'cancelled' } : a
      ),
    }));
    try {
      const { error } = await supabase.from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);
      return !error;
    } catch { return false; }
  },

  // Suggest a new date/time to the patient.
  // Updates scheduled_at to the new time and sets status: 'suggested'
  // so the patient app shows a "New Time Offered" banner.
  // Suggesting a new time is a booking like any other — it moves the patient
  // onto a slot and holds it while they decide. It used to be a bare UPDATE
  // with no capacity check, so the desk could offer a time another patient
  // already had. move_appointment_slot validates it under the same slot lock.
  // Returns true, or an Error carrying .code so the caller can explain why.
  suggestNewTime: async (appointmentId, isoDateTime) => {
    const previous = (get().appointmentsList || []).find(a => a.id === appointmentId);
    set((s) => ({
      appointmentsList: (s.appointmentsList || []).map(a =>
        a.id === appointmentId
          ? { ...a, status: 'suggested', scheduledAt: isoDateTime,
              time: new Date(isoDateTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
          : a
      ),
    }));
    try {
      await moveSlot({ appointmentId, at: isoDateTime, status: 'suggested' });
      return true;
    } catch (e) {
      // Put the row back — the optimistic update was wrong.
      if (previous) {
        set((s) => ({
          appointmentsList: (s.appointmentsList || []).map(a =>
            a.id === appointmentId ? previous : a
          ),
        }));
      }
      return e;
    }
  },

  // Update appointment status + persist (used by AppointmentDetail / queue actions).
  updateAppointmentStatus: async (appointmentId, status) => {
    if (!appointmentId) return false;
    // Optimistic update of the cached list
    set((s) => ({
      appointmentsList: (s.appointmentsList || []).map(a => a.id === appointmentId ? { ...a, status } : a),
    }));
    try {
      // Only real UUIDs exist in the DB; mock ids are skipped harmlessly.
      const { error } = await supabase.from('appointments')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', appointmentId);
      return !error;
    } catch (e) { return false; }
  },

  // Complete an order — persist to DB first, then update in-memory list.
  completeOrder: async (table, orderId) => {
    try {
      const { error } = await supabase.from(table).update({ status: 'completed' }).eq('id', orderId);
      if (error) console.warn('[completeOrder] DB error:', error.message);
    } catch (e) {
      console.warn('[completeOrder] error:', e?.message);
    }
    if (table === 'pharmacy_orders') get().setPharmacyStatus(orderId, 'completed');
    else if (table === 'lab_orders') get().setLabStatus(orderId, 'completed');
    else get().setHomeStatus(orderId, 'completed');
  },
}));

