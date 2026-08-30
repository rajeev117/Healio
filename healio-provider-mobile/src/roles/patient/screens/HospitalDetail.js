import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import ProviderAvatar from '../components/ProviderAvatar';
import { ApiService } from '../services/ApiService';
import { useLanguage } from '../context/LanguageContext';
import { useWallet } from '../context/WalletContext';

import { getNextNDays, SLOT_STATE, DAY_STATE } from '../../../lib/schedule';

// An appointment belongs to a DOCTOR, not to a building — appointments.
// doctor_staff_id is a foreign key into staff. This screen used to send the
// hospital's own id as the doctor, so the insert could never succeed. The
// modal now asks which doctor first, then shows that doctor's real slots.
const BOOKING_DAYS = getNextNDays(8).slice(1);

export default function HospitalDetail({ route, navigation }) {
  const item = route.params?.item || route.params?.hospital || route.params?.selectedHospital || null;
  const { t } = useLanguage();
  const { balance, hasPremiumAccess } = useWallet();

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [chosenDate, setChosenDate] = useState('');   // ISO day
  const [chosenSlot, setChosenSlot] = useState(null); // the whole slot object
  const [chosenDoctor, setChosenDoctor] = useState(null);
  const [daySlots, setDaySlots] = useState({ state: DAY_STATE.OFF, slots: [] });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  const hospitalId = item?.id;
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const docs = await ApiService.getDoctorsByHospital(hospitalId);
        if (!active) return;
        setDoctors(docs);
        // One doctor means there is nothing to choose — skip the step.
        if (docs.length === 1) setChosenDoctor(docs[0]);
      } catch (e) { /* ignore */ }
      finally { if (active) setLoadingDoctors(false); }
    })();
    return () => { active = false; };
  }, [hospitalId]);

  if (!item) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hospital Detail</Text>
          <View style={styles.shareBtn} />
        </View>
        <View style={styles.fallbackState}>
          <Ionicons name="alert-circle-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.fallbackTitle}>Hospital details unavailable</Text>
          <Text style={styles.fallbackText}>
            The selected hospital could not be loaded. Go back and open it again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Open Google Maps with turn-by-turn directions. Omitting the origin makes
  // Google use the device's current location and recalc as the user moves.
  const handleDirections = async () => {
    let destination = '';
    if (item.latitude != null && item.longitude != null) {
      destination = `${item.latitude},${item.longitude}`;
    } else {
      destination = encodeURIComponent([item.name, item.address, item.location].filter(Boolean).join(', '));
    }
    if (!destination) {
      Alert.alert('No location', 'This hospital has no location set yet.');
      return;
    }
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
    // Prefer the native maps app, fall back to the browser URL.
    const nativeUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${destination}&directionsmode=driving`,
      android: `google.navigation:q=${destination}`,
    });
    try {
      if (nativeUrl && (await Linking.canOpenURL(nativeUrl))) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (e) {
      Alert.alert('Could not open maps', 'No maps app available on this device.');
    }
  };

  const handleOpenBooking = () => {
    if (!hasPremiumAccess) {
      Alert.alert(
        'Booking Access Locked',
        `Healio requires a minimum credit balance of ₹50 to book hospital visits. Current balance: ₹${balance}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Deposit Now', onPress: () => navigation.navigate('HealioPlusPayment') },
        ]
      );
      return;
    }

    setChosenDate(BOOKING_DAYS[0].iso);
    setChosenSlot(null);
    // Keep the auto-picked doctor when the hospital only has one.
    if (doctors.length !== 1) setChosenDoctor(null);
    setDaySlots({ state: DAY_STATE.OFF, slots: [] });
    setShowBookingModal(true);
  };

  // The chosen doctor's real grid for the chosen date.
  const loadSlots = React.useCallback(() => {
    if (!chosenDoctor?.id || !chosenDate) {
      setDaySlots({ state: DAY_STATE.OFF, slots: [] });
      return;
    }
    setLoadingSlots(true);
    setChosenSlot(null);
    ApiService.getSlotAvailability(chosenDoctor.id, chosenDate)
      .then(({ slots, dayState }) => setDaySlots({ state: dayState, slots: slots || [] }))
      .catch(() => setDaySlots({ state: DAY_STATE.OFF, slots: [] }))
      .finally(() => setLoadingSlots(false));
  }, [chosenDoctor?.id, chosenDate]);

  useEffect(() => {
    if (!showBookingModal) return;
    loadSlots();
  }, [showBookingModal, loadSlots]);

  const handleConfirmBooking = async () => {
    if (!chosenDoctor) {
      Alert.alert('Select a doctor', 'Please choose which doctor you want to see.');
      return;
    }
    if (!chosenDate || !chosenSlot) {
      Alert.alert('Required Fields', 'Please select both a date and a time slot.');
      return;
    }

    setBooking(true);
    try {
      await ApiService.addAppointment({
        id: 'a' + Math.random().toString(36).slice(2, 10),
        doctorId: chosenDoctor.id,
        organisationId: chosenDoctor.organisationId || item.id,
        doctorName: chosenDoctor.name,
        specialty: chosenDoctor.specialty || item.type || 'Hospital Visit',
        date: chosenDate,
        time: chosenSlot.label,
        at: chosenSlot.at,
        type: 'Clinic Visit',
        fee: chosenDoctor.feeValue,
        status: 'Upcoming',
        location: item.location || item.name || '',
      });
      setBooking(false);
      setShowBookingModal(false);
      Alert.alert(
        'Visit Confirmed',
        `Your visit to ${chosenDoctor.name} at ${item.name} is booked for ${chosenSlot.label}.`,
        [{ text: 'View Appointments', onPress: () => navigation.navigate('Main', { screen: 'Appointments' }) }],
      );
    } catch (error) {
      setBooking(false);
      if (error?.code === 'DUPLICATE') {
        Alert.alert('Already Booked', `You already have an active appointment with ${chosenDoctor.name}.`);
        return;
      }
      if (['SLOT_FULL', 'SLOT_BLOCKED', 'ON_LEAVE', 'OUTSIDE_SCHEDULE', 'SLOT_PAST'].includes(error?.code)) {
        Alert.alert('Slot no longer available', error.message);
        loadSlots();
        return;
      }
      Alert.alert('Error', error?.message || 'Could not book visit at this time.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hospital Detail</Text>
        <TouchableOpacity style={styles.shareBtn}>
          <Ionicons name="share-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <ProviderAvatar kind="Hospitals" size={96} />
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.specialty}>{item.type || 'Hospital'}</Text>

          <View style={styles.statsRow}>
            {item.rating ? <StatBox value={item.rating} label="Rating" /> : null}
            <StatBox value={item.beds || '—'} label="Beds" center />
            {item.distance ? <StatBox value={item.distance} label="Distance" /> : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <SectionTitle title="About Hospital" />
          <Text style={styles.bodyText}>
            {item.name} is a trusted care center with a broad multi-specialty setup, emergency response, and coordinated inpatient and outpatient services.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <SectionTitle title="Facility Info" />
          <InfoRow icon="location-outline" label={item.location || 'Dhaka, Bangladesh'} />
          <InfoRow icon="medkit-outline" label={item.specialties || 'Multispecialty care'} />
          <InfoRow icon="time-outline" label={item.emergency || '24/7 Emergency'} />
          <InfoRow icon="call-outline" label={item.phone || '+880 1700 000000'} />
        </View>

        <View style={styles.sectionCard}>
          <SectionTitle title="Services" />
          <ChipRow items={[item.type || 'Multispecialty', 'Emergency', 'Diagnostics', 'ICU']} />
        </View>

        {/* Doctors at this hospital — book a specific doctor directly */}
        <View style={styles.sectionCard}>
          <SectionTitle title="Doctors at this hospital" />
          {loadingDoctors ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
          ) : doctors.length === 0 ? (
            <Text style={styles.bodyText}>No doctors listed for this hospital yet.</Text>
          ) : (
            doctors.map((doc) => (
              <TouchableOpacity
                key={doc.id}
                style={styles.docRow}
                onPress={() => navigation.navigate('DoctorDetail', { item: doc, category: 'Doctors' })}
              >
                <View style={styles.docAvatar}>
                  <Text style={styles.docInitials}>
                    {doc.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{doc.name}</Text>
                  <Text style={styles.docSpec}>{doc.specialty} · {doc.fee}</Text>
                </View>
                <View style={styles.docBookBtn}>
                  <Text style={styles.docBookText}>Book</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleDirections}>
          <Ionicons name="navigate-outline" size={18} color={COLORS.primary} />
          <Text style={styles.secondaryBtnText}>Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleOpenBooking}>
          <Text style={styles.primaryBtnText}>Book Visit</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showBookingModal} animationType="slide" transparent onRequestClose={() => setShowBookingModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date & Time</Text>
              <TouchableOpacity onPress={() => setShowBookingModal(false)} disabled={booking}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <View style={styles.bookingBadge}>
                <ProviderAvatar kind="Hospitals" size={38} />
                <View>
                  <Text style={styles.badgeName}>{item.name}</Text>
                  <Text style={styles.badgeSub}>{item.type || 'Hospital'}</Text>
                </View>
              </View>

              <Text style={styles.modalSectionTitle}>Select Doctor</Text>
              {loadingDoctors ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 14 }} />
              ) : doctors.length === 0 ? (
                <Text style={styles.slotHint}>
                  {item.name} has no doctors accepting appointments right now.
                </Text>
              ) : (
                <View style={styles.slotsGrid}>
                  {doctors.map((doc) => {
                    const isSelected = chosenDoctor?.id === doc.id;
                    return (
                      <TouchableOpacity
                        key={doc.id}
                        style={[styles.doctorPill, isSelected && styles.doctorPillActive]}
                        onPress={() => setChosenDoctor(doc)}
                      >
                        <Text style={[styles.slotText, isSelected && styles.slotTextActive]}>{doc.name}</Text>
                        <Text style={styles.doctorPillSub}>{doc.specialty}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

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
              {!chosenDoctor ? (
                <Text style={styles.slotHint}>Choose a doctor to see their available times.</Text>
              ) : loadingSlots ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 14 }} />
              ) : daySlots.state === DAY_STATE.LEAVE ? (
                <Text style={styles.slotHint}>{chosenDoctor.name} is on leave that day.</Text>
              ) : daySlots.slots.length === 0 ? (
                <Text style={styles.slotHint}>{chosenDoctor.name} does not consult on that day.</Text>
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
                          isFull && styles.slotPillFull,
                          (isBlocked || isPast) && styles.slotPillOff,
                        ]}
                        onPress={() => setChosenSlot(slot)}
                      >
                        <Text style={[
                          styles.slotText,
                          isSelected && styles.slotTextActive,
                          isFull && styles.slotTextFull,
                        ]}>
                          {slot.label}
                        </Text>
                        {isFull && <Text style={styles.slotFullLabel}>Booked</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmBooking} disabled={booking}>
              {booking ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmBtnText}>Confirm Booking</Text>}
            </TouchableOpacity>
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

const InfoRow = ({ icon, label }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <Text style={styles.infoText}>{label}</Text>
  </View>
);

const ChipRow = ({ items }) => (
  <View style={styles.chipRow}>
    {items.map((item) => (
      <View key={item} style={styles.chip}>
        <Text style={styles.chipText}>{item}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  // The "hospital details unavailable" fallback referenced these three keys but
  // none were defined, so it rendered as unstyled left-aligned text.
  fallbackState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.l, gap: 10,
  },
  fallbackTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  fallbackText: {
    fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20,
  },
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
    backgroundColor: '#FFF3E0',
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.secondary,
  },
  chipText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F3F5' },
  docAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  docInitials: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
  docName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  docSpec: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  docBookBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.primary },
  docBookText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
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
  },
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
  doctorPill: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  doctorPillActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.primary },
  doctorPillSub: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  // A slot someone else holds reads as taken, not as a dead button.
  slotPillFull: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error },
  slotPillOff: { opacity: 0.4, borderStyle: 'dashed' },
  slotTextFull: { color: COLORS.error, textDecorationLine: 'line-through' },
  slotFullLabel: { fontSize: 9, color: COLORS.error, fontWeight: '800', marginTop: 2 },
  slotHint: { fontSize: 12.5, color: COLORS.textSecondary, paddingVertical: 12 },
  slotPillActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.primary },
  slotText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  slotTextActive: { color: COLORS.primary },
  confirmBtn: { backgroundColor: COLORS.primary, borderRadius: 18, height: 54, justifyContent: 'center', alignItems: 'center', marginTop: SPACING.l },
  confirmBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
