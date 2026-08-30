import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Modal, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../lib/store';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { fetchDayAvailability, getNextNDays, localDay, SLOT_STATE } from '../lib/schedule';
import styles from './Appointments.styles';

// ── Status display config ───────────────────────────────────────────────────
const STATUS = {
  scheduled:   { label: 'Pending',    bg: '#fef3c7', text: '#92400e', icon: 'time-outline' },
  in_progress: { label: 'Confirmed',  bg: '#d1fae5', text: '#065f46', icon: 'checkmark-circle-outline' },
  suggested:   { label: 'Time Sent',  bg: '#dbeafe', text: '#1e40af', icon: 'calendar-outline' },
  completed:   { label: 'Completed',  bg: '#f0fdf4', text: '#166534', icon: 'checkmark-done-outline' },
  cancelled:   { label: 'Cancelled',  bg: '#fee2e2', text: '#991b1b', icon: 'close-circle-outline' },
};

const TABS = ['Pending', 'Confirmed', 'All'];

// Suggest-a-new-time offers the next 7 days, starting tomorrow.
const SUGGEST_DAYS = getNextNDays(8).slice(1);

const minutesSince = (iso) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 60000) : 0;

// Suggest-a-time and walk-in slots both come from the doctor's own schedule
// (doctor_availability) instead of the two fixed lists that used to live here.
// Times another patient already holds stay visible and marked, so the desk can
// see the day rather than guessing at a list that never matched reality.

export default function Appointments({ navigation }) {
  const appointments        = useStore(s => s.appointmentsList);
  const loadAppointmentsList = useStore(s => s.loadAppointmentsList);
  const acceptAppointment   = useStore(s => s.acceptAppointment);
  const declineAppointment  = useStore(s => s.declineAppointment);
  const suggestNewTime      = useStore(s => s.suggestNewTime);
  const resolveOrgId        = useStore(s => s.resolveOrgId);
  const doctors             = useStore(s => s.doctors);

  const [tab,      setTab]      = useState('Pending');
  const [acting,   setActing]   = useState(null);
  const [suggestModal, setSuggestModal] = useState(null);
  const [suggestDay,   setSuggestDay]   = useState(0);
  const [suggestSlot,  setSuggestSlot]  = useState(null);   // the whole slot object
  const [submitting,   setSubmitting]   = useState(false);
  const [declineTarget, setDeclineTarget] = useState(null);

  // ── Walk-in / admin-created appointment modal ─────────────────────────────
  const [walkInModal,   setWalkInModal]   = useState(false);
  const [wiName,        setWiName]        = useState('');
  const [wiPhone,       setWiPhone]       = useState('');
  const [wiDoctor,      setWiDoctor]      = useState(null);
  const [wiType,        setWiType]        = useState('OPD');
  const [wiTime,        setWiTime]        = useState(null);  // the whole slot object
  const [wiSaving,      setWiSaving]      = useState(false);

  const WI_TYPES = ['OPD', 'Follow-up', 'Review', 'Emergency', 'Walk-in'];

  // Today's real grid for the doctor the desk picked.
  const [wiSlots, setWiSlots] = useState([]);
  const [wiLoadingSlots, setWiLoadingSlots] = useState(false);
  useEffect(() => {
    if (!walkInModal || !wiDoctor?.id) { setWiSlots([]); return; }
    setWiLoadingSlots(true);
    setWiTime(null);
    fetchDayAvailability(wiDoctor.id, localDay(new Date()))
      .then((day) => setWiSlots(day.slots))
      .catch(() => setWiSlots([]))
      .finally(() => setWiLoadingSlots(false));
  }, [walkInModal, wiDoctor?.id]);

  // The suggest modal's grid, for the selected day.
  const [suggestSlots, setSuggestSlots] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  useEffect(() => {
    const doctorId = suggestModal?.doctorStaffId;
    if (!suggestModal || !doctorId) { setSuggestSlots([]); return; }
    setSuggestLoading(true);
    setSuggestSlot(null);
    fetchDayAvailability(doctorId, SUGGEST_DAYS[suggestDay].iso)
      .then((day) => setSuggestSlots(day.slots))
      .catch(() => setSuggestSlots([]))
      .finally(() => setSuggestLoading(false));
  }, [suggestModal?.id, suggestModal?.doctorStaffId, suggestDay]);

  const createWalkIn = async () => {
    if (!wiName.trim())   { showBanner('Patient name is required.', 'warn'); return; }
    if (!wiDoctor)        { showBanner('Please select a doctor.', 'warn'); return; }
    if (!wiTime)          { showBanner('Please select a time slot.', 'warn'); return; }
    setWiSaving(true);
    try {
      const orgId = await resolveOrgId();
      if (!orgId) { showBanner('No hospital context. Please re-login.', 'warn'); return; }

      // Try to find existing patient profile by phone; if not found, create minimal entry
      let patientId = null;
      const phone10 = wiPhone.replace(/\D/g, '').slice(-10);
      if (phone10.length === 10) {
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', `+91${phone10}`)
          .maybeSingle();
        patientId = existing?.id || null;

        if (!patientId) {
          // Create a minimal walk-in profile so appointment can link to it
          const { data: created } = await supabase
            .from('profiles')
            .insert({ name: wiName.trim(), phone: `+91${phone10}`, organisation_id: orgId, status: 'active' })
            .select('id')
            .single();
          patientId = created?.id || null;
        }
      }

      // `source` and `notes` were written here for a long time and neither
      // column exists — the insert failed every time while the UI reported
      // success. The real columns are is_walkin / patient_notes.
      //
      // Capacity is enforced by the trigger on appointments, so a walk-in can
      // no longer be dropped onto a slot a booked patient already holds.
      const { error } = await supabase.from('appointments').insert({
        organisation_id: orgId,
        doctor_staff_id: wiDoctor.id,
        patient_id: patientId,
        type: 'clinic',
        status: 'in_progress',          // walk-ins are immediately confirmed
        scheduled_at: wiTime.at,
        is_walkin: true,
        patient_notes: `${wiType} walk-in: ${wiName.trim()}${wiPhone ? ` (${wiPhone})` : ''}`,
        confirmed_by_role: 'hospital_admin',
      });
      if (error) {
        throw new Error(
          /SLOT_FULL/.test(error.message || '')
            ? 'That slot is already taken for this doctor. Pick another time.'
            : (error.message || 'Could not create appointment.')
        );
      }

      setWalkInModal(false);
      setWiName(''); setWiPhone(''); setWiDoctor(null); setWiType('OPD'); setWiTime(null);
      showBanner(`Walk-in added for ${wiName.trim()}`, 'success');
      loadAppointmentsList();
    } catch (e) {
      showBanner(e?.message || 'Could not create appointment.', 'warn');
    } finally { setWiSaving(false); }
  };

  // Notification banner state
  const [banner, setBanner] = useState(null);
  const bannerTimer = useRef(null);

  const showBanner = useCallback((message, type = 'info') => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ message, type });
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  // Load list on every focus
  useFocusEffect(useCallback(() => {
    loadAppointmentsList();
  }, [loadAppointmentsList]));

  // ── Supabase Realtime: new bookings (INSERT) + status changes (UPDATE) ────
  useEffect(() => {
    let channel;
    let cancelled = false;

    const setup = async (attempt = 0) => {
      const orgId = await resolveOrgId();
      if (cancelled) return;
      if (!orgId) {
        // Retry up to 3 times — auth might not be fully ready on first render
        if (attempt < 3) setTimeout(() => setup(attempt + 1), 2000);
        return;
      }

      channel = supabase
        .channel(`appointments-provider-${orgId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'appointments',
            filter: `organisation_id=eq.${orgId}` },
          () => {
            showBanner('🔔 New appointment request from a patient!', 'new');
            loadAppointmentsList();
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'appointments',
            filter: `organisation_id=eq.${orgId}` },
          (payload) => {
            const n = payload.new;
            const o = payload.old;

            // The assigned DOCTOR confirmed a booking → notify the hospital
            if (n.status === 'in_progress' && o.status === 'scheduled' && n.confirmed_by_role === 'doctor') {
              showBanner(`✅ Dr. ${n.confirmed_by_name || ''} confirmed an appointment.`.trim(), 'success');
            }
            // Patient rescheduled → reschedule_count bumped (check first, it also
            // resets status to 'scheduled')
            else if ((n.reschedule_count || 0) > (o.reschedule_count || 0)) {
              showBanner('🔄 A patient rescheduled their appointment — please re-confirm.', 'new');
            }
            // Patient accepted the time suggestion → back to scheduled
            else if (n.status === 'scheduled' && o.status === 'suggested') {
              showBanner('✅ Patient accepted your suggested time!', 'success');
            }
            // pg_cron flipped reminder_sent → 30-min overdue reminder
            if (n.reminder_sent === true && !o.reminder_sent) {
              showBanner('⏰ Reminder: a patient is still waiting for confirmation!', 'warn');
            }
            // Patient cancelled their own appointment
            if (n.status === 'cancelled' && o.status === 'scheduled') {
              showBanner('❌ A patient cancelled their appointment request.', 'warn');
            }
            loadAppointmentsList();
          }
        )
        .subscribe();
    };

    setup();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, []);

  // ── Filter by tab ─────────────────────────────────────────────────────────
  const filtered = appointments.filter(a => {
    if (tab === 'Pending')   return a.status === 'scheduled';
    if (tab === 'Confirmed') return ['in_progress', 'suggested'].includes(a.status);
    return true;
  });

  const pendingCount = appointments.filter(a => a.status === 'scheduled').length;

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAccept = async (apt) => {
    setActing(apt.id);
    const ok = await acceptAppointment(apt.id);
    setActing(null);
    if (ok) showBanner(`✅ Accepted booking for ${apt.patient}`, 'success');
    else     Alert.alert('Error', 'Could not accept. Please try again.');
  };

  const handleDecline = (apt) => setDeclineTarget(apt);

  const confirmDecline = async () => {
    if (!declineTarget) return;
    const apt = declineTarget;
    setDeclineTarget(null);
    setActing(apt.id);
    await declineAppointment(apt.id);
    setActing(null);
    showBanner(`Declined booking for ${apt.patient}`, 'warn');
  };

  const openSuggest = (apt) => {
    setSuggestDay(0);
    setSuggestSlot('');
    setSuggestModal(apt);
  };

  const handleSuggest = async () => {
    if (!suggestSlot) {
      showBanner('Please pick a time slot to suggest.', 'warn');
      return;
    }
    setSubmitting(true);
    // `at` is the server-resolved instant for the slot — no local date maths,
    // and the RPC refuses it if another patient has taken it meanwhile.
    const result = await suggestNewTime(suggestModal.id, suggestSlot.at);
    setSubmitting(false);

    if (result === true) {
      setSuggestModal(null);
      showBanner(`📅 New time suggested to ${suggestModal.patient}`, 'info');
      return;
    }
    showBanner(result?.message || 'Could not send suggestion. Please try again.', 'warn');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* Notification banner */}
      {banner && (
        <View style={[styles.banner,
          banner.type === 'new'     && styles.bannerNew,
          banner.type === 'success' && styles.bannerSuccess,
          banner.type === 'warn'    && styles.bannerWarn,
        ]}>
          <Text style={styles.bannerText}>{banner.message}</Text>
          <TouchableOpacity onPress={() => setBanner(null)}>
            <Ionicons name="close" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.canGoBack() && navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Appointments</Text>
            <Text style={styles.headerSub}>Manage patient booking requests</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
            </View>
          )}
          <TouchableOpacity style={styles.addBtn} onPress={() => setWalkInModal(true)}>
            <Ionicons name="add" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t}{t === 'Pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>No appointments here.</Text>
          </View>
        ) : filtered.map(apt => {
          const cfg       = STATUS[apt.status] || STATUS.scheduled;
          const isPending = apt.status === 'scheduled';
          const isActing  = acting === apt.id;
          const waitMins  = isPending ? minutesSince(apt.bookedAt) : 0;
          const isOverdue = waitMins >= 30;

          return (
            <View key={apt.id} style={[styles.card, isPending && styles.cardPending, isOverdue && styles.cardOverdue]}>
              {/* Overdue reminder strip */}
              {isOverdue && (
                <View style={styles.overdueStrip}>
                  <Ionicons name="alert-circle" size={13} color="#92400e" style={{ marginRight: 5 }} />
                  <Text style={styles.overdueText}>Waiting {waitMins} min — please respond</Text>
                </View>
              )}

              {/* Card header */}
              <View style={styles.cardTop}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>
                    {(apt.patient || 'P').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{apt.patient || 'Patient'}</Text>
                  <Text style={styles.cardSub}>{apt.doctor} · {apt.type}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={11} color={cfg.text} />
                  <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
                </View>
              </View>

              {/* Time */}
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                <Text style={styles.timeText}>{apt.time}</Text>
              </View>

              {/* Actions — only for pending (scheduled) appointments */}
              {isPending && (
                <View style={styles.actions}>
                  {isActing ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <>
                      <TouchableOpacity style={styles.btnAccept}
                        onPress={() => handleAccept(apt)}>
                        <Ionicons name="checkmark" size={14} color={COLORS.white} />
                        <Text style={styles.btnAcceptText}>Accept</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.btnSuggest}
                        onPress={() => openSuggest(apt)}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.btnSuggestText}>Suggest Time</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.btnDecline}
                        onPress={() => handleDecline(apt)}>
                        <Ionicons name="close" size={14} color="#dc2626" />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {/* Tap to view detail */}
              <TouchableOpacity style={styles.detailLink}
                onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: apt.id })}>
                <Text style={styles.detailLinkText}>View Details</Text>
                <Ionicons name="chevron-forward" size={13} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Decline confirmation modal */}
      <Modal visible={!!declineTarget} animationType="fade" transparent
        onRequestClose={() => setDeclineTarget(null)}>
        <View style={styles.declineOverlay}>
          <View style={styles.declineBox}>
            <View style={styles.declineIconWrap}>
              <Ionicons name="close-circle" size={40} color="#dc2626" />
            </View>
            <Text style={styles.declineTitle}>Decline Booking?</Text>
            <Text style={styles.declineMsg}>
              {declineTarget?.patient}'s appointment request will be cancelled. They will be notified.
            </Text>
            <View style={styles.declineBtns}>
              <TouchableOpacity style={styles.declineKeep} onPress={() => setDeclineTarget(null)}>
                <Text style={styles.declineKeepText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.declineConfirm} onPress={confirmDecline}>
                <Text style={styles.declineConfirmText}>Yes, Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Suggest Time Modal */}
      <Modal visible={!!suggestModal} animationType="slide" transparent
        onRequestClose={() => setSuggestModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Suggest New Time</Text>
              <TouchableOpacity onPress={() => setSuggestModal(null)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Choose an alternative date and time for {suggestModal?.patient}.
              They will receive a notification to accept or decline.
            </Text>

            {/* Day picker */}
            <Text style={styles.pickLabel}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {SUGGEST_DAYS.map((d, i) => (
                <TouchableOpacity key={d.iso}
                  style={[styles.dayPill, suggestDay === i && styles.dayPillActive]}
                  onPress={() => setSuggestDay(i)}>
                  <Text style={[styles.dayPillText, suggestDay === i && { color: COLORS.white }]}>
                    {d.day} {d.num}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time picker */}
            <Text style={styles.pickLabel}>Select Time</Text>
            {suggestLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 14 }} />
            ) : suggestSlots.length === 0 ? (
              <Text style={styles.slotEmpty}>
                This doctor has no consulting hours on that day.
              </Text>
            ) : (
              <View style={styles.slotsGrid}>
                {suggestSlots.map(slot => {
                  const sel = suggestSlot?.time === slot.time && suggestSlot?.sessionId === slot.sessionId;
                  const taken = slot.state === SLOT_STATE.FULL;
                  const off = slot.state === SLOT_STATE.BLOCKED || slot.state === SLOT_STATE.PAST;
                  return (
                    <TouchableOpacity key={`${slot.sessionId}-${slot.time}`}
                      disabled={taken || off}
                      style={[
                        styles.slotPill,
                        sel && styles.slotPillActive,
                        taken && styles.slotPillTaken,
                        off && styles.slotPillOff,
                      ]}
                      onPress={() => setSuggestSlot(slot)}>
                      <Text style={[
                        styles.slotText,
                        sel && { color: COLORS.white },
                        taken && styles.slotTextTaken,
                      ]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.confirmBtn}
              onPress={handleSuggest} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.confirmBtnText}>Send Suggestion to Patient</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Walk-in appointment modal */}
      <Modal visible={walkInModal} animationType="slide" transparent onRequestClose={() => setWalkInModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Walk-in / Appointment</Text>
              <TouchableOpacity onPress={() => setWalkInModal(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Patient name */}
              <Text style={styles.wiLabel}>Patient Name *</Text>
              <TextInput
                style={styles.wiInput}
                value={wiName}
                onChangeText={setWiName}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={COLORS.textSecondary}
              />

              {/* Patient phone */}
              <Text style={styles.wiLabel}>Phone (optional)</Text>
              <TextInput
                style={styles.wiInput}
                value={wiPhone}
                onChangeText={setWiPhone}
                placeholder="10-digit mobile number"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
              />

              {/* Doctor */}
              <Text style={styles.wiLabel}>Doctor *</Text>
              {doctors.length === 0 ? (
                <Text style={styles.wiHint}>No doctors added yet. Add one in Doctors tab first.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {doctors.map(d => {
                      const sel = wiDoctor?.id === d.id;
                      return (
                        <TouchableOpacity key={d.id}
                          style={[styles.wiChip, sel && styles.wiChipActive]}
                          onPress={() => setWiDoctor(d)}>
                          <Text style={[styles.wiChipText, sel && styles.wiChipTextActive]}>{d.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {/* Type */}
              <Text style={styles.wiLabel}>Visit Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                {WI_TYPES.map(t => {
                  const sel = wiType === t;
                  return (
                    <TouchableOpacity key={t}
                      style={[styles.wiChip, sel && styles.wiChipActive]}
                      onPress={() => setWiType(t)}>
                      <Text style={[styles.wiChipText, sel && styles.wiChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Time */}
              <Text style={styles.wiLabel}>Time Slot (today) *</Text>
              {!wiDoctor ? (
                <Text style={styles.slotEmpty}>Pick a doctor to see today's slots.</Text>
              ) : wiLoadingSlots ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 10 }} />
              ) : (
                <>
                  {/* A patient at the desk is a fact, not a booking request —
                      "Now" stays available even outside consulting hours. */}
                  <TouchableOpacity
                    style={[styles.wiChip, wiTime?.sessionId === 'now' && styles.wiChipActive, { marginBottom: 8, alignSelf: 'flex-start' }]}
                    onPress={() => setWiTime({ sessionId: 'now', time: 'now', label: 'Right now', at: new Date().toISOString() })}>
                    <Text style={[styles.wiChipText, wiTime?.sessionId === 'now' && styles.wiChipTextActive]}>
                      Right now
                    </Text>
                  </TouchableOpacity>
                  {wiSlots.length === 0 ? (
                    <Text style={styles.slotEmpty}>
                      {wiDoctor.name} has no consulting hours today.
                    </Text>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {wiSlots.map(slot => {
                          const sel = wiTime?.time === slot.time && wiTime?.sessionId === slot.sessionId;
                          const taken = slot.state === SLOT_STATE.FULL;
                          const off = slot.state === SLOT_STATE.BLOCKED;
                          return (
                            <TouchableOpacity key={`${slot.sessionId}-${slot.time}`}
                              disabled={taken || off}
                              style={[
                                styles.wiChip,
                                sel && styles.wiChipActive,
                                taken && styles.slotPillTaken,
                                off && styles.slotPillOff,
                              ]}
                              onPress={() => setWiTime(slot)}>
                              <Text style={[
                                styles.wiChipText,
                                sel && styles.wiChipTextActive,
                                taken && styles.slotTextTaken,
                              ]}>
                                {slot.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </ScrollView>
                  )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.wiConfirmBtn, (!wiName.trim() || !wiDoctor || !wiTime || wiSaving) && { opacity: 0.5 }]}
              onPress={createWalkIn}
              disabled={!wiName.trim() || !wiDoctor || !wiTime || wiSaving}
            >
              {wiSaving
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.wiConfirmText}>Add Appointment</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
