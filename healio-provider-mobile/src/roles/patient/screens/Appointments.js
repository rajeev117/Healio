import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAppointments } from '../controllers/AppointmentController';
import { useLanguage } from '../context/LanguageContext';
import { useWallet } from '../context/WalletContext';
import { ApiService } from '../services/ApiService';
import { supabase } from '../services/supabase';   // for Realtime subscription
import { getNextNDays, SLOT_STATE, DAY_STATE } from '../../../lib/schedule';

const categories = ['Upcoming', 'Past', 'Cancelled'];

const NOTIF_COLORS = {
  success: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
  info:    { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  error:   { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};
// Slots come from the doctor's own schedule (doctor_availability) — there is
// no fixed list any more. A reschedule is validated exactly like a new booking,
// so it cannot land on a slot another patient already holds.

export default function Appointments({ navigation }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('Upcoming');
  const { loading, appointments, refresh, cancelAppointment } = useAppointments(activeTab);
  const { balance, hasPremiumAccess } = useWallet();

  // Rescheduling Modal states
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [chosenDate, setChosenDate] = useState('');   // ISO day
  const [chosenSlot, setChosenSlot] = useState(null); // the whole slot object
  const [daySlots, setDaySlots] = useState({ state: DAY_STATE.OFF, slots: [] });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cancel confirmation modal
  const [cancelTargetId, setCancelTargetId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // In-app notification banner (works on web + native)
  const [notifBanner, setNotifBanner] = useState(null); // { message, type, icon }
  const notifTimer = useRef(null);
  const showNotif = (message, type = 'info', icon = 'notifications') => {
    if (notifTimer.current) clearTimeout(notifTimer.current);
    setNotifBanner({ message, type, icon });
    notifTimer.current = setTimeout(() => setNotifBanner(null), 5000);
  };

  // ── Supabase Realtime: notify patient when their appointment status changes ──
  useEffect(() => {
    let channel;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        channel = supabase
          .channel(`patient-appointments-${user.id}`)
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'appointments',
              filter: `patient_id=eq.${user.id}` },
            (payload) => {
              const s = payload.new?.status;
              if (s === 'in_progress') {
                showNotif('Appointment confirmed! The doctor/hospital has accepted your booking.', 'success', 'checkmark-circle');
              } else if (s === 'suggested') {
                showNotif('New time suggested. Check your Upcoming tab to accept or change it.', 'info', 'calendar');
              } else if (s === 'cancelled') {
                showNotif('Your appointment was declined. You can rebook at another time.', 'error', 'close-circle');
              }
              refresh();
            }
          )
          .subscribe();
      } catch (_) {}
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  // The next 7 dates, starting tomorrow. This replaces a hand-rolled generator
  // whose months array was rotated by five against a 0-based getMonth(), so
  // every reschedule string named the wrong month and the appointment landed
  // roughly five months away.
  const rescheduleDays = getNextNDays(8).slice(1);

  // The doctor's real grid for the chosen date.
  const loadSlots = React.useCallback((doctorId, iso) => {
    if (!doctorId || !iso) { setDaySlots({ state: DAY_STATE.OFF, slots: [] }); return; }
    setLoadingSlots(true);
    ApiService.getSlotAvailability(doctorId, iso)
      .then(({ slots, dayState }) => setDaySlots({ state: dayState, slots: slots || [] }))
      .catch(() => setDaySlots({ state: DAY_STATE.OFF, slots: [] }))
      .finally(() => setLoadingSlots(false));
  }, []);

  useEffect(() => {
    if (!showRescheduleModal || !selectedAppointment?.doctorId || !chosenDate) return;
    setChosenSlot(null);
    loadSlots(selectedAppointment.doctorId, chosenDate);
  }, [showRescheduleModal, selectedAppointment?.doctorId, chosenDate, loadSlots]);

  const MAX_RESCHEDULES = 3;

  const handleOpenReschedule = (item) => {
    if (!hasPremiumAccess) {
      Alert.alert(
        "Booking Access Locked",
        `Healio requires a minimum credit balance of ₹50 to book or reschedule consultations. Current balance: ₹${balance}.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Deposit Now", onPress: () => navigation.navigate('HealioPlusPayment') },
        ]
      );
      return;
    }

    const used = item.rescheduleCount || 0;
    // Already at the limit → must contact the hospital
    if (used >= MAX_RESCHEDULES) {
      showNotif(
        `You've reached the limit of ${MAX_RESCHEDULES} reschedules for this appointment. Please contact the hospital to make further changes.`,
        'error', 'alert-circle'
      );
      return;
    }

    setSelectedAppointment(item);
    setChosenDate(rescheduleDays[0].iso);
    setChosenSlot(null);
    setDaySlots({ state: DAY_STATE.OFF, slots: [] });
    setShowRescheduleModal(true);
  };

  const handleConfirmReschedule = async () => {
    if (!chosenDate || !chosenSlot) {
      Alert.alert("Select Date & Time", "Please select a date and a time slot to reschedule.");
      return;
    }
    setSubmitting(true);
    try {
      await ApiService.rescheduleAppointment(
        selectedAppointment.id, chosenDate, chosenSlot.label, chosenSlot.at,
      );
      setSubmitting(false);
      setShowRescheduleModal(false);
      const used = (selectedAppointment.rescheduleCount || 0) + 1;
      const left = MAX_RESCHEDULES - used;
      showNotif(
        left > 0
          ? `Appointment rescheduled. The hospital has been notified. You have ${left} reschedule${left === 1 ? '' : 's'} left.`
          : `Appointment rescheduled. The hospital has been notified. This was your last allowed reschedule — contact the hospital for any further changes.`,
        'success', 'checkmark-circle'
      );
      refresh();
    } catch (e) {
      setSubmitting(false);
      if (e?.code === 'RESCHEDULE_LIMIT') {
        setShowRescheduleModal(false);
        showNotif(
          `You've reached the limit of ${MAX_RESCHEDULES} reschedules. Please contact the hospital for further changes.`,
          'error', 'alert-circle'
        );
      } else if (['SLOT_FULL', 'SLOT_BLOCKED', 'ON_LEAVE', 'OUTSIDE_SCHEDULE', 'SLOT_PAST'].includes(e?.code)) {
        // The grid moved while the modal was open — say so and refresh it.
        Alert.alert('Slot no longer available', e.message);
        setChosenSlot(null);
        loadSlots(selectedAppointment?.doctorId, chosenDate);
      } else {
        Alert.alert("Error", e?.message || "Could not reschedule appointment at this time.");
      }
    }
  };

  const handleCancelAppointment = (id) => {
    setCancelTargetId(id);
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelAppointment(cancelTargetId);
    } catch (_) {}
    setCancelling(false);
    setCancelTargetId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {notifBanner && (() => {
        const c = NOTIF_COLORS[notifBanner.type] || NOTIF_COLORS.info;
        return (
          <View style={[styles.notifBanner, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Ionicons name={`${notifBanner.icon}-outline`} size={18} color={c.text} style={{ marginRight: 10 }} />
            <Text style={[styles.notifBannerText, { color: c.text }]}>{notifBanner.message}</Text>
            <TouchableOpacity onPress={() => setNotifBanner(null)}>
              <Ionicons name="close" size={16} color={c.text} />
            </TouchableOpacity>
          </View>
        );
      })()}
      <View style={styles.header}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>{t('my_appointments')}</Text>
      </View>
      
      {/* Tabs switcher rounded pill */}
      <View style={styles.tabContainer}>
        <View style={styles.roundedTabBar}>
          {categories.map((cat) => {
            const isActive = activeTab === cat;
            return (
              <TouchableOpacity 
                key={cat} 
                style={[styles.roundedTab, isActive && styles.activeRoundedTab]}
                onPress={() => setActiveTab(cat)}
              >
                <Text style={[styles.roundedTabText, isActive && styles.activeRoundedTabText]}>
                  {t(cat.toLowerCase() + '_tab')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : appointments.length > 0 ? (
          appointments.map(item => (
            <AppointmentItem
              key={item.id}
              item={{ ...item, doctor: item.doctorName, date: `${item.date}, ${item.time}` }}
              onReschedule={() => handleOpenReschedule(item)}
              onCancel={() => handleCancelAppointment(item.id)}
              onAcceptSuggestion={async () => {
                await ApiService.acceptSuggestedTime(item.id);
                Alert.alert('Accepted ✅', 'Your appointment time has been confirmed. The hospital will be notified.');
                refresh();
              }}
              onJoinCall={() => navigation.navigate('VideoConsultation', { appointmentId: item.id })}
              onViewPrescription={() => navigation.navigate('Prescriptions')}
            />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={COLORS.border} />
            <Text style={styles.emptyText}>{t('no_appointments')} ({t(activeTab.toLowerCase() + '_tab').toLowerCase()})</Text>
          </View>
        )}
      </ScrollView>

      {/* Rescheduling Modal */}
      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Appointment</Text>
              <TouchableOpacity onPress={() => setShowRescheduleModal(false)} disabled={submitting}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollBody}>
              {/* Doctor Quick Badge */}
              {selectedAppointment && (
                <View style={styles.doctorQuickBadge}>
                  <View style={styles.badgeAvatar}>
                    <Text style={styles.badgeAvatarText}>
                      {selectedAppointment.doctorName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.badgeName}>{selectedAppointment.doctorName}</Text>
                    <Text style={styles.badgeSub}>{t(selectedAppointment.specialty.toLowerCase())}</Text>
                  </View>
                </View>
              )}

              {/* Reschedule limit warning */}
              {selectedAppointment && (
                <View style={styles.reschedWarn}>
                  <Ionicons name="information-circle-outline" size={16} color="#92400e" style={{ marginRight: 6 }} />
                  <Text style={styles.reschedWarnText}>
                    {`You can reschedule up to ${MAX_RESCHEDULES} times. ${MAX_RESCHEDULES - (selectedAppointment.rescheduleCount || 0)} left — after that, contact the hospital.`}
                  </Text>
                </View>
              )}

              {/* Date Selection */}
              <Text style={styles.sectionHeading}>Select Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {rescheduleDays.map((d) => {
                  const isSelected = chosenDate === d.iso;
                  return (
                    <TouchableOpacity
                      key={d.iso}
                      style={[styles.datePill, isSelected && styles.selectedDatePill]}
                      onPress={() => setChosenDate(d.iso)}
                    >
                      <Text style={[styles.dayNameText, isSelected && styles.selectedDateText]}>{d.day}</Text>
                      <Text style={[styles.dateNumText, isSelected && styles.selectedDateText]}>{d.num}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time Slot Selection */}
              <Text style={styles.sectionHeading}>Select Time Slot</Text>
              {loadingSlots ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 14 }} />
              ) : daySlots.state === DAY_STATE.LEAVE ? (
                <Text style={styles.slotHint}>
                  {selectedAppointment?.doctorName || 'The doctor'} is on leave that day.
                </Text>
              ) : daySlots.slots.length === 0 ? (
                <Text style={styles.slotHint}>
                  {selectedAppointment?.doctorName || 'The doctor'} does not consult on that day.
                </Text>
              ) : (
                <View style={styles.slotsGrid}>
                  {daySlots.slots.map((slot) => {
                    const isSelected = chosenSlot?.time === slot.time
                      && chosenSlot?.sessionId === slot.sessionId;
                    const isFull    = slot.state === SLOT_STATE.FULL;
                    const isBlocked = slot.state === SLOT_STATE.BLOCKED;
                    const isPast    = slot.state === SLOT_STATE.PAST;
                    const disabled  = isFull || isBlocked || isPast;
                    return (
                      <TouchableOpacity
                        key={`${slot.sessionId}-${slot.time}`}
                        disabled={disabled}
                        style={[
                          styles.slotPill,
                          isSelected && styles.selectedSlotPill,
                          isFull && styles.fullSlotPill,
                          (isBlocked || isPast) && styles.offSlotPill,
                        ]}
                        onPress={() => setChosenSlot(slot)}
                      >
                        <Text style={[
                          styles.slotText,
                          isSelected && styles.selectedSlotText,
                          isFull && styles.fullSlotText,
                        ]}>
                          {slot.label}
                        </Text>
                        {isFull && <Text style={styles.fullSlotLabel}>Booked</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.confirmBtn}
              onPress={handleConfirmReschedule}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm Rescheduling</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cancel confirmation modal */}
      <Modal
        visible={!!cancelTargetId}
        animationType="fade"
        transparent
        onRequestClose={() => !cancelling && setCancelTargetId(null)}
      >
        <View style={styles.cancelOverlay}>
          <View style={styles.cancelModal}>
            <View style={styles.cancelIconWrap}>
              <Ionicons name="alert-circle" size={40} color="#dc2626" />
            </View>
            <Text style={styles.cancelModalTitle}>Cancel Appointment?</Text>
            <Text style={styles.cancelModalMsg}>
              This appointment will be cancelled immediately.
            </Text>
            <View style={styles.cancelRefundBox}>
              <Ionicons name="information-circle-outline" size={16} color="#92400e" style={{ marginRight: 6, marginTop: 1 }} />
              <Text style={styles.cancelRefundText}>
                No refund will be issued for this cancellation. The consultation fee paid will be forfeited.
              </Text>
            </View>
            <View style={styles.cancelModalBtns}>
              <TouchableOpacity
                style={styles.cancelModalKeep}
                onPress={() => setCancelTargetId(null)}
                disabled={cancelling}
              >
                <Text style={styles.cancelModalKeepText}>Keep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelModalConfirm}
                onPress={handleConfirmCancel}
                disabled={cancelling}
              >
                {cancelling
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={styles.cancelModalConfirmText}>Yes, Cancel</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Per-rawStatus badge config ────────────────────────────────────────────────
const RAW_STATUS_BADGE = {
  scheduled:   { label: 'Pending Confirmation', icon: 'time-outline',           bg: '#fef3c7', text: '#92400e' },
  in_progress: { label: 'Confirmed',            icon: 'checkmark-circle',       bg: '#d1fae5', text: '#065f46' },
  suggested:   { label: 'New Time Offered',     icon: 'calendar-outline',       bg: '#dbeafe', text: '#1e40af' },
  completed:   { label: 'Completed',            icon: 'checkmark-circle',       bg: '#d1fae5', text: '#065f46' },
  missed:      { label: 'Missed',               icon: 'alert-circle-outline',   bg: '#fef3c7', text: '#92400e' },
  no_show:     { label: 'Missed',               icon: 'alert-circle-outline',   bg: '#fef3c7', text: '#92400e' },
};

const AppointmentItem = ({ item, onReschedule, onCancel, onAcceptSuggestion, onJoinCall, onViewPrescription }) => {
  const { t } = useLanguage();
  const { doctor, specialty, date, type, status, rawStatus } = item;
  const isVideo     = type === 'Video Consultation' || type === 'Video';
  const initials    = doctor.split(' ').map(n => n[0]).slice(0, 2).join('');
  const badge       = rawStatus && RAW_STATUS_BADGE[rawStatus];
  const isSuggested = rawStatus === 'suggested';
  const isMissed    = rawStatus === 'missed' || rawStatus === 'no_show';
  const datePart    = date.split(',')[0]?.trim() || date;
  const timePart    = date.split(',')[1]?.trim() || '';

  return (
    <View style={[styles.card, isSuggested && styles.cardSuggested]}>

      {/* Status strip — shown for upcoming (confirmation state) and past (completed/missed) */}
      {badge && (status === 'Upcoming' || status === 'Past') && (
        <View style={[styles.statusStrip, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.icon} size={13} color={badge.text} style={{ marginRight: 5 }} />
          <Text style={[styles.statusStripText, { color: badge.text }]}>{badge.label}</Text>
        </View>
      )}

      {/* Doctor row */}
      <View style={styles.cardHeader}>
        <View style={styles.doctorAvatar}>
          <Text style={styles.doctorInitials}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.doctorName}>{doctor}</Text>
          <Text style={styles.specialty}>{t(specialty.toLowerCase())}</Text>
        </View>
        <View style={[styles.modeBadge, isVideo ? styles.videoBadge : styles.clinicBadge]}>
          <Ionicons
            name={isVideo ? 'videocam' : 'business-outline'}
            size={11}
            color={isVideo ? '#2e7d32' : COLORS.primary}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.modeBadgeText, { color: isVideo ? '#2e7d32' : COLORS.primary }]}>
            {isVideo ? 'Video' : 'In-clinic'}
          </Text>
        </View>
      </View>

      {/* Info rows */}
      <View style={styles.infoBlock}>
        <View style={styles.infoRow}>
          <View style={styles.infoIconWrap}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
          </View>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoValue}>{datePart}</Text>
        </View>
        {!!timePart && (
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="time-outline" size={14} color={COLORS.primary} />
            </View>
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{timePart}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <View style={styles.infoIconWrap}>
            <Ionicons name={isVideo ? 'wifi-outline' : 'location-outline'} size={14} color={COLORS.primary} />
          </View>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {isVideo ? 'Online Consult' : (item.location || 'Clinic')}
          </Text>
        </View>
      </View>

      {/* Actions */}
      {status === 'Upcoming' ? (
        <>
          {isSuggested && (
            <View style={styles.suggestionBox}>
              <Text style={styles.suggestionNote}>
                The doctor has suggested this time. Accept to confirm your slot.
              </Text>
              <View style={styles.suggestionBtns}>
                <TouchableOpacity style={styles.btnAccept} onPress={onAcceptSuggestion}>
                  <Ionicons name="checkmark-circle" size={15} color={COLORS.white} />
                  <Text style={styles.btnAcceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnDecline} onPress={onCancel}>
                  <Text style={styles.btnDeclineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!isSuggested && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionOutline} onPress={onReschedule}>
                <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                <Text style={styles.actionOutlineText}>{t('reschedule')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionPrimary}
                onPress={() => isVideo
                  ? onJoinCall()
                  : Alert.alert('Directions', 'Directions to clinic opened.')}
              >
                <Ionicons name={isVideo ? 'videocam' : 'navigate-outline'} size={14} color={COLORS.white} />
                <Text style={styles.actionPrimaryText}>{isVideo ? 'Join call' : 'Directions'}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
            <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {isMissed && (
            <View style={styles.missedBanner}>
              <Ionicons name="alert-circle-outline" size={15} color="#92400e" />
              <Text style={styles.missedBannerText}>
                You missed this appointment. Rebook to secure a new slot with the same doctor.
              </Text>
            </View>
          )}
          <View style={styles.actions}>
            {!isMissed && (
              <TouchableOpacity
                style={styles.actionOutline}
                onPress={onViewPrescription}
              >
                <Ionicons name="document-text-outline" size={14} color={COLORS.primary} />
                <Text style={styles.actionOutlineText}>Prescription</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionPrimary, isMissed && { flex: 1 }]}
              onPress={onReschedule}
            >
              <Ionicons name={isMissed ? 'calendar' : 'refresh-outline'} size={14} color={COLORS.white} />
              <Text style={styles.actionPrimaryText}>{isMissed ? 'Rebook Now' : 'Book again'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: SPACING.m 
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  
  /* rounded tab bar style */
  tabContainer: {
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    backgroundColor: COLORS.white,
  },
  roundedTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roundedTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20,
  },
  activeRoundedTab: {
    backgroundColor: COLORS.white,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  roundedTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeRoundedTabText: {
    color: COLORS.text,
    fontWeight: '700',
  },

  content: { padding: SPACING.m, paddingBottom: SPACING.xl },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardSuggested: { borderColor: '#93c5fd', borderWidth: 1.5 },

  // Status strip across top of card
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.m,
    paddingVertical: 7,
  },
  statusStripText: { fontSize: 12, fontWeight: '700' },

  // Doctor header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    paddingBottom: SPACING.s,
  },
  doctorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  doctorInitials: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  doctorName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  specialty: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  modeBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
  },
  videoBadge:  { backgroundColor: '#E8F5E9' },
  clinicBadge: { backgroundColor: COLORS.secondary },
  modeBadgeText: { fontSize: 10, fontWeight: '700' },

  // Info block
  infoBlock: {
    marginHorizontal: SPACING.m,
    marginBottom: SPACING.m,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  infoLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', width: 64 },
  infoValue:  { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '700' },

  // Action buttons
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.m,
    paddingBottom: SPACING.m,
  },
  actionOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.white,
  },
  actionOutlineText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  actionPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 14,
    backgroundColor: COLORS.primary,
  },
  actionPrimaryText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginHorizontal: SPACING.m, marginBottom: SPACING.m,
    paddingVertical: 9, borderRadius: 12,
    borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff5f5',
  },
  cancelBtnText: { fontSize: 12, fontWeight: '700', color: '#dc2626' },

  // Suggestion box
  suggestionBox: {
    marginHorizontal: SPACING.m,
    marginBottom: SPACING.m,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  suggestionNote: {
    fontSize: 12, color: '#1e40af', lineHeight: 18, fontWeight: '600', marginBottom: 10,
  },
  suggestionBtns: { flexDirection: 'row', gap: 8 },
  btnAccept: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primary,
  },
  btnAcceptText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  btnDecline: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fff5f5',
  },
  btnDeclineText: { color: '#dc2626', fontWeight: '700', fontSize: 13 },

  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: COLORS.textSecondary, marginTop: 16, fontSize: 16 },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: SPACING.l,
    minHeight: '55%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
    paddingBottom: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalScrollBody: {
    paddingVertical: SPACING.s,
  },
  doctorQuickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    padding: 12,
    borderRadius: 16,
    marginBottom: SPACING.m,
  },
  badgeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  badgeAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  badgeName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  badgeSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.m,
    marginBottom: SPACING.m,
  },
  horizontalScroll: {
    marginHorizontal: -SPACING.l,
    paddingHorizontal: SPACING.l,
    marginBottom: SPACING.s,
  },
  datePill: {
    width: 60,
    height: 70,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  selectedDatePill: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  dateNumText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  selectedDateText: {
    color: COLORS.white,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.l,
  },
  slotPill: {
    width: '30%',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    marginBottom: 10,
  },
  selectedSlotPill: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.primary,
  },
  slotText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  selectedSlotText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  // A slot someone else holds reads as taken, not as a dead button.
  fullSlotPill: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: COLORS.error,
  },
  offSlotPill: {
    opacity: 0.4,
    borderStyle: 'dashed',
  },
  fullSlotText: {
    color: COLORS.error,
    textDecorationLine: 'line-through',
  },
  fullSlotLabel: {
    fontSize: 9,
    color: COLORS.error,
    fontWeight: '800',
    marginTop: 2,
  },
  slotHint: {
    fontSize: 12.5,
    color: COLORS.textSecondary,
    paddingVertical: 12,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 26,
    alignItems: 'center',
    marginTop: SPACING.m,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  confirmBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },

  // Cancel confirmation modal
  cancelOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  cancelModal: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.l,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  cancelIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff5f5',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.m,
  },
  cancelModalTitle: {
    fontSize: 20, fontWeight: '900', color: COLORS.text,
    marginBottom: 8, textAlign: 'center',
  },
  cancelModalMsg: {
    fontSize: 14, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: SPACING.m,
  },
  cancelRefundBox: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: SPACING.l,
    alignItems: 'flex-start',
  },
  cancelRefundText: {
    flex: 1, fontSize: 13, color: '#92400e', lineHeight: 19, fontWeight: '600',
  },
  cancelModalBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelModalKeep: {
    flex: 1, height: 50, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  cancelModalKeepText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  cancelModalConfirm: {
    flex: 1, height: 50, borderRadius: 14,
    backgroundColor: '#dc2626',
    justifyContent: 'center', alignItems: 'center',
  },
  cancelModalConfirmText: { fontSize: 15, fontWeight: '700', color: COLORS.white },

  missedBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: SPACING.m, marginBottom: SPACING.s,
    padding: 10, borderRadius: 10,
    backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a',
  },
  missedBannerText: {
    flex: 1, fontSize: 12, color: '#92400e', fontWeight: '600', lineHeight: 17,
  },
  notifBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: SPACING.m, marginTop: SPACING.s,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  notifBannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  reschedWarn: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, marginBottom: SPACING.m,
  },
  reschedWarnText: { flex: 1, fontSize: 12, color: '#92400e', fontWeight: '600', lineHeight: 17 },
});
