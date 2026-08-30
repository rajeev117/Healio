import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import ProviderAvatar from '../components/ProviderAvatar';
import { ApiService } from '../services/ApiService';
import { useLanguage } from '../context/LanguageContext';
import { useWallet } from '../context/WalletContext';
import { getNextNDays, SLOT_STATE, DAY_STATE } from '../../../lib/schedule';

// Dates start tomorrow here — this modal is the "book a future visit" path;
// same-day booking lives on the full BookAppointment screen.
const BOOKING_DAYS = getNextNDays(8).slice(1);

export default function DoctorDetail({ route, navigation }) {
  const item = route.params?.item || route.params?.doctor || route.params?.selectedDoctor || null;
  const { t } = useLanguage();
  const { balance, hasPremiumAccess } = useWallet();

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [chosenDate, setChosenDate]   = useState('');   // ISO day
  const [chosenSlot, setChosenSlot]   = useState(null); // the whole slot object
  const [booking, setBooking]         = useState(false);
  const [daySlots, setDaySlots]       = useState({ state: DAY_STATE.OFF, slots: [] });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [hasActiveBooking, setHasActiveBooking] = useState(null); // null = checking, false = free, true = booked
  const [bookingConfirmed, setBookingConfirmed] = useState(false);

  // Check if patient already has an active appointment with this doctor
  useEffect(() => {
    if (!item) return;
    ApiService.getAppointments().then(appointments => {
      const active = appointments.some(
        a => a.doctorName === item.name &&
             ['scheduled', 'in_progress', 'suggested', 'Upcoming'].includes(a.rawStatus || a.status)
      );
      setHasActiveBooking(active);
    }).catch(() => {});
  }, [item?.name]);

  // The doctor's real grid for the chosen date — sessions minus leave/blocks,
  // with live booked counts. Was a fixed six-slot array that ignored the
  // doctor's schedule entirely.
  const loadSlots = React.useCallback(() => {
    if (!chosenDate) return;
    setLoadingSlots(true);
    setChosenSlot(null);
    ApiService.getSlotAvailability(item?.id ?? null, chosenDate, item?.name ?? '')
      .then(({ slots, dayState }) => setDaySlots({ state: dayState, slots: slots || [] }))
      .catch(() => setDaySlots({ state: DAY_STATE.OFF, slots: [] }))
      .finally(() => setLoadingSlots(false));
  }, [chosenDate, item?.id, item?.name]);

  useEffect(() => {
    if (!showBookingModal || !chosenDate) return;
    loadSlots();
  }, [chosenDate, showBookingModal, loadSlots]);

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Doctor Detail</Text>
          <View style={styles.shareBtn} />
        </View>
        <View style={styles.fallbackState}>
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.fallbackTitle}>Doctor details unavailable</Text>
          <Text style={styles.fallbackText}>The selected doctor could not be loaded. Go back and open it again.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleOpenBooking = () => {
    if (!hasPremiumAccess) {
      Alert.alert(
        'Booking Access Locked',
        `Healio requires a minimum credit balance of ₹50 to book consultations. Current balance: ₹${balance}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Deposit Now', onPress: () => navigation.navigate('HealioPlusPayment') },
        ]
      );
      return;
    }
    setChosenDate(BOOKING_DAYS[0].iso);
    setChosenSlot(null);
    setDaySlots({ state: DAY_STATE.OFF, slots: [] });
    setShowBookingModal(true);
  };

  const handleConfirmBooking = async () => {
    if (!chosenDate || !chosenSlot) {
      Alert.alert('Select Date & Time', 'Please select both a date and a time slot.');
      return;
    }
    setBooking(true);
    try {
      // `at` is the server-resolved instant for this slot; capacity is enforced
      // server-side under a per-slot lock, so no pre-check is needed here.
      await ApiService.addAppointment({
        id: 'a' + Math.random().toString(36).slice(2, 10),
        doctorId: item.id,
        organisationId: item.organisationId,
        doctorName: item.name,
        specialty: item.specialty || 'Doctor',
        date: chosenDate,
        time: chosenSlot.label,
        at: chosenSlot.at,
        type: item.type || 'Clinic Visit',
        fee: item.fee,
        status: 'Upcoming',
        location: item.location || 'Dhaka',
      });
      setBooking(false);
      setHasActiveBooking(true);
      setBookingConfirmed(true);
    } catch (error) {
      setBooking(false);
      if (error?.code === 'DUPLICATE') {
        Alert.alert(
          'Already Booked',
          `You already have an active appointment with ${item.name}. Please cancel or complete it before booking again.`
        );
        return;
      }
      const stale = ['SLOT_FULL', 'SLOT_BLOCKED', 'ON_LEAVE', 'OUTSIDE_SCHEDULE', 'SLOT_PAST'];
      if (stale.includes(error?.code)) {
        Alert.alert('Slot no longer available', error.message, [{ text: 'OK' }]);
        loadSlots();
      } else {
        Alert.alert('Booking Failed', error?.message || 'Could not book at this time. Please try again.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Doctor Detail</Text>
        <TouchableOpacity style={styles.shareBtn}>
          <Ionicons name="share-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <ProviderAvatar kind="Doctors" name={item?.name} uri={item?.image} size={96} />
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.specialty}>{item.specialty ? t(item.specialty.toLowerCase()) : 'Doctor'}</Text>

          <View style={styles.statsRow}>
            {item.rating ? <StatBox value={item.rating} label="Rating" /> : null}
            <StatBox value={item.experience || '—'} label="Experience" center />
            {item.distance ? <StatBox value={item.distance} label="Distance" /> : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <SectionTitle title="About" />
          <Text style={styles.bodyText}>
            {item.name} provides patient-first care with a strong focus on consultation clarity, follow-up planning, and practical treatment guidance.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <SectionTitle title="Clinic Info" />
          <InfoRow icon="location-outline" label={item.location || 'Dhaka, Bangladesh'} />
          <InfoRow icon="time-outline" label={item.availability || 'Mon - Sat, 09:00 AM - 08:00 PM'} />
          <InfoRow icon="call-outline" label={item.phone || '+880 1700 000000'} />
        </View>

        <View style={styles.sectionCard}>
          <SectionTitle title="Consultation" />
          <InfoRow icon="cash-outline" label={item.fee || '₹500'} rightText="Fee" />
          <InfoRow icon="ribbon-outline" label={item.specialty ? t(item.specialty.toLowerCase()) : 'Specialist care'} rightText="Specialty" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Call', `Calling ${item.name}...`)}>
          <Ionicons name="call-outline" size={18} color={COLORS.primary} />
          <Text style={styles.secondaryBtnText}>Call</Text>
        </TouchableOpacity>
        {hasActiveBooking === null ? (
          <View style={[styles.primaryBtn, styles.primaryBtnBooked]}>
            <ActivityIndicator size="small" color={COLORS.white} />
          </View>
        ) : hasActiveBooking ? (
          <View style={[styles.primaryBtn, styles.primaryBtnBooked]}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
            <Text style={styles.primaryBtnText}>Already Booked</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenBooking}>
            <Text style={styles.primaryBtnText}>Book Appointment</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowBookingModal(false); setBookingConfirmed(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>

            {bookingConfirmed ? (
              <View style={styles.confirmationView}>
                <View style={styles.confirmationIconWrap}>
                  <Ionicons name="time-outline" size={48} color={COLORS.primary} />
                </View>
                <Text style={styles.confirmationTitle}>Request Submitted</Text>
                <Text style={styles.confirmationMsg}>
                  Your appointment request with <Text style={{ fontWeight: '800' }}>{item.name}</Text> for{' '}
                  <Text style={{ fontWeight: '800' }}>{chosenDate}</Text> at{' '}
                  <Text style={{ fontWeight: '800' }}>{chosenSlot?.label}</Text> has been sent.
                </Text>
                <Text style={styles.confirmationNote}>
                  Please allow 1–2 hours for the doctor or hospital to confirm. You will be notified once accepted.
                </Text>
                <TouchableOpacity
                  style={styles.viewApptsBtn}
                  onPress={() => {
                    setShowBookingModal(false);
                    setBookingConfirmed(false);
                    navigation.navigate('Main', { screen: 'Appointments' });
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.confirmBtnText}>View My Appointments</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => { setShowBookingModal(false); setBookingConfirmed(false); }}
                >
                  <Text style={styles.dismissBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Date & Time</Text>
                  <TouchableOpacity onPress={() => setShowBookingModal(false)} disabled={booking}>
                    <Ionicons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                  <View style={styles.bookingBadge}>
                    <ProviderAvatar kind="Doctors" name={item?.name} uri={item?.image} size={38} />
                    <View>
                      <Text style={styles.badgeName}>{item.name}</Text>
                      <Text style={styles.badgeSub}>{item.specialty ? t(item.specialty.toLowerCase()) : 'Doctor'}</Text>
                    </View>
                  </View>

                  <Text style={styles.modalSectionTitle}>Select Date</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
                    {BOOKING_DAYS.map((day) => {
                      const isSelected = chosenDate === day.iso;
                      return (
                        <TouchableOpacity
                          key={day.iso}
                          style={[styles.dayPill, isSelected && styles.dayPillActive]}
                          onPress={() => setChosenDate(day.iso)}
                        >
                          <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>{day.day}</Text>
                          <Text style={[styles.dayNum, isSelected && styles.dayNameActive]}>{day.num}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.modalSectionTitle}>Select Time</Text>
                  {!chosenDate ? (
                    <Text style={styles.slotHint}>Pick a date to see available times.</Text>
                  ) : loadingSlots ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 14 }} />
                  ) : daySlots.state === DAY_STATE.LEAVE ? (
                    <Text style={styles.slotHint}>{item.name} is on leave that day.</Text>
                  ) : daySlots.slots.length === 0 ? (
                    <Text style={styles.slotHint}>{item.name} does not consult on that day.</Text>
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
                              isSelected && styles.slotPillActive,
                              isFull     && styles.slotPillFull,
                              (isBlocked || isPast) && styles.slotPillOff,
                            ]}
                            onPress={() => setChosenSlot(slot)}
                          >
                            <Text style={[
                              styles.slotText,
                              isSelected && styles.slotTextActive,
                              isFull     && styles.slotTextFull,
                            ]}>
                              {slot.label}
                            </Text>
                            {isFull && <Text style={styles.slotFullLabel}>Booked</Text>}
                            {isBlocked && <Text style={styles.slotOffLabel}>Unavailable</Text>}
                            {!disabled && slot.capacity > 1 && (
                              <Text style={styles.slotOffLabel}>{slot.spotsLeft} left</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmBooking} disabled={booking}>
                  {booking ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmBtnText}>Confirm Booking</Text>}
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const SectionTitle = ({ title }) => (
  <Text style={styles.sectionTitle}>{title}</Text>
);

const StatBox = ({ value, label, center }) => (
  <View style={[styles.statBox, center && styles.statBoxCenter]}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const InfoRow = ({ icon, label, rightText }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <Text style={styles.infoText}>{label}</Text>
    {rightText ? <Text style={styles.infoTag}>{rightText}</Text> : null}
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.m,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  shareBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  fallbackState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.l,
    gap: 12,
  },
  fallbackTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  fallbackText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  content: { padding: SPACING.m, paddingBottom: SPACING.xl },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.l,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.m,
  },
  heroIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  name: { fontSize: 22, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  specialty: { fontSize: 14, color: COLORS.primary, fontWeight: '700', marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'stretch', width: '100%', marginTop: SPACING.l },
  statBox: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 18, paddingVertical: 12, alignItems: 'center' },
  statBoxCenter: { marginHorizontal: 10 },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.l,
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m },
  bodyText: { fontSize: 14, lineHeight: 22, color: COLORS.textSecondary },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoText: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: '600' },
  infoTag: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  footer: {
    flexDirection: 'row',
    padding: SPACING.m,
    paddingTop: 0,
    gap: 12,
    backgroundColor: COLORS.surface,
  },
  secondaryBtn: {
    flex: 0.34,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '800' },
  primaryBtn: {
    flex: 0.66,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryBtnBooked: { backgroundColor: '#6b7280' },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: SPACING.l,
    maxHeight: '88%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.m },
  modalTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  modalBody: { paddingBottom: SPACING.m },
  bookingBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.m, gap: 12 },
  badgeAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  badgeName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  badgeSub: { fontSize: 12, color: COLORS.textSecondary },
  modalSectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginTop: 4, marginBottom: 10, textTransform: 'uppercase' },
  pillsRow: { paddingBottom: 8 },
  dayPill: {
    width: 64,
    marginRight: 10,
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dayPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },
  dayNum: { fontSize: 16, color: COLORS.text, fontWeight: '800', marginTop: 4 },
  dayNameActive: { color: COLORS.white },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotPill: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slotPillActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.primary },
  // Taken slots are red rather than a faded grey, so it is obvious the time is
  // gone instead of looking like the app failed to respond to the tap.
  slotPillFull:   { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error },
  slotPillOff:    { opacity: 0.4, backgroundColor: COLORS.surface, borderStyle: 'dashed' },
  slotText:       { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  slotTextActive: { color: COLORS.primary },
  slotTextFull:   { color: COLORS.error, textDecorationLine: 'line-through' },
  slotFullLabel:  { fontSize: 9, color: COLORS.error, fontWeight: '800', marginTop: 2 },
  slotOffLabel:   { fontSize: 9, color: COLORS.textSecondary, fontWeight: '700', marginTop: 2 },
  slotHint:       { fontSize: 12.5, color: COLORS.textSecondary, paddingVertical: 12 },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: 18, height: 54, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.l },
  confirmBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  viewApptsBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.l,
  },
  dismissBtn: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.s },
  dismissBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  confirmationView: { alignItems: 'center', paddingVertical: SPACING.l, paddingHorizontal: SPACING.m },
  confirmationIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.l,
  },
  confirmationTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: SPACING.m, textAlign: 'center' },
  confirmationMsg: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: SPACING.m },
  confirmationNote: {
    fontSize: 13, color: COLORS.primary, textAlign: 'center', lineHeight: 20,
    backgroundColor: COLORS.secondary, borderRadius: 14, padding: 14, marginBottom: SPACING.s,
  },
});
