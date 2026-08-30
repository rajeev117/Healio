import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import ProviderAvatar from '../components/ProviderAvatar';
import { ApiService } from '../services/ApiService';
import { usePlatformConfig } from '../context/PlatformConfigContext';
import {
  fetchAvailability, getNextNDays, buildSlots, fmt12,
  SLOT_STATE, DAY_STATE,
} from '../../../lib/schedule';

// ─────────────────────────────────────────────────────────────────────────────
// Book Appointment.
//
// The slot grid used to be a hardcoded ALL_TIME_SLOTS array that ignored the
// doctor's schedule completely — every doctor "offered" the same twelve times
// whether they consulted then or not. It now comes from doctor_availability(),
// generated from the sessions the doctor (or their hospital) defined, minus
// leave and blocked slots.
//
// A slot that is taken shows RED and cannot be tapped. That is a UI courtesy,
// not the guarantee: booking goes through book_appointment_slot, which counts
// under a per-slot lock, so the second patient to reach a slot is refused even
// if both tapped at the same instant.
// ─────────────────────────────────────────────────────────────────────────────

const VISIT_TYPES = [
  { id: 'clinic',   label: 'Clinic Visit',  icon: 'business',  desc: 'Visit in person at the clinic' },
  { id: 'video',    label: 'Video Call',     icon: 'videocam',  desc: 'Online consultation from home' },
  { id: 'homecare', label: 'Home Visit',     icon: 'home',      desc: 'Doctor visits you at home' },
];

// Same-day bookings need a little lead time — nobody can be at a clinic in
// four minutes. Applied on top of the server's own past-slot rejection.
const LEAD_MINUTES = 60;

// Demo grid for mock doctors (no real staff row, so no real schedule). Kept
// so the offline/demo flow still shows something; real doctors never use it.
function demoDay(iso) {
  const slots = buildSlots('09:00', '17:00', 30).map((time) => ({
    time,
    label: fmt12(time),
    at: null,
    state: SLOT_STATE.FREE,
    booked: 0,
    capacity: 1,
    spotsLeft: 1,
    sessionId: 'demo',
    sessionName: 'Consulting hours',
  }));
  return {
    iso,
    state: DAY_STATE.OPEN,
    sessions: [{ id: 'demo', name: 'Consulting hours', slots }],
    slots,
    counts: { total: slots.length, free: slots.length, full: 0, blocked: 0 },
  };
}

export default function BookAppointment({ navigation, route }) {
  const { isEnabled } = usePlatformConfig();
  const doctor = route?.params?.doctor || {
    id: null, name: 'Dr. Ayaan Khan', specialty: 'General Physician', fee: 300, rating: 4.8,
  };
  const days = getNextNDays(7);
  const visitTypes = VISIT_TYPES.filter(t => {
    if (t.id === 'video' && !isEnabled('video_calls')) return false;
    return true;
  });

  const [selectedDay,  setSelectedDay]  = useState(0);
  const [selectedSlot, setSelectedSlot] = useState(null);   // the whole slot object
  const [selectedType, setSelectedType] = useState('clinic');
  const [step,         setStep]         = useState(1);
  const [booking,      setBooking]      = useState(false);

  const [availability, setAvailability] = useState({ order: [], days: {} });
  const [loadingSlots, setLoadingSlots] = useState(true);

  const slotOpacity = useRef(new Animated.Value(1)).current;

  // One call covers the whole 7-day strip, so switching days is instant and the
  // strip can dim the doctor's non-working days before they are tapped.
  const loadAvailability = React.useCallback(() => {
    setLoadingSlots(true);
    Animated.timing(slotOpacity, { toValue: 0.3, duration: 150, useNativeDriver: true }).start();

    const request = doctor.id
      ? fetchAvailability(doctor.id, days[0].iso, 7)
      : Promise.resolve({
          order: days.map(d => d.iso),
          days: Object.fromEntries(days.map(d => [d.iso, demoDay(d.iso)])),
        });

    return request
      .then(setAvailability)
      .catch(() => setAvailability({ order: [], days: {} }))
      .finally(() => {
        setLoadingSlots(false);
        Animated.timing(slotOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
  }, [doctor.id]);

  useEffect(() => { loadAvailability(); }, [loadAvailability]);
  useEffect(() => { setSelectedSlot(null); }, [selectedDay]);

  const day = availability.days[days[selectedDay].iso]
    || { state: DAY_STATE.OFF, sessions: [], slots: [], counts: {} };
  const dayCapacity = day.slots.reduce((max, s) => Math.max(max, s.capacity), 1);

  // A same-day slot inside the lead-time window is shown, but not bookable.
  const tooSoon = (slot) => {
    if (!days[selectedDay].isToday) return false;
    const at = slot.at ? new Date(slot.at) : null;
    if (!at) return false;
    return at.getTime() - Date.now() < LEAD_MINUTES * 60 * 1000;
  };

  const handleContinue = () => {
    if (!selectedSlot) {
      Alert.alert('Select a time slot', 'Please pick a time to continue.');
      return;
    }
    setStep(2);
  };

  const handleBook = async () => {
    const typeLabel =
      selectedType === 'video'    ? 'Video Consultation' :
      selectedType === 'homecare' ? 'Home Visit'         : 'Clinic Visit';

    // `at` is the server-resolved instant for this slot. Carrying it through
    // (rather than re-parsing "27 Aug 2026" + "09:15 AM" on the device) is what
    // keeps the booking on the slot the patient actually tapped.
    const appointment = {
      id:             'a' + Math.random().toString(36).slice(2, 10),
      doctorId:       doctor.id,
      organisationId: doctor.organisationId,
      doctorName:     doctor.name,
      specialty:      doctor.specialty,
      date:           days[selectedDay].full,
      time:           selectedSlot.label,
      at:             selectedSlot.at,
      type:           typeLabel,
      fee:            doctor.fee,
      status:         'Upcoming',
    };
    const fee = Number(doctor.fee) || 0;

    // Paid consultations go through the checkout — wallet, UPI, card, net
    // banking, or cash at the clinic. The appointment itself is created once
    // the payment is settled (see screens/PaymentProcessing).
    if (fee > 0) {
      navigation.navigate('PayGateway', {
        amount: fee,
        allowWallet: true,
        allowCash: true,
        cashLabel: selectedType === 'homecare' ? 'Pay cash at the visit' : 'Pay cash at the clinic',
        purpose: {
          type: 'appointment',
          appointment,
          label: `Consultation — ${doctor.name}`,
          sublabel: `${typeLabel} · ${days[selectedDay].full}, ${selectedSlot.label}`,
          referenceType: 'appointment',
        },
      });
      return;
    }

    setBooking(true);
    try {
      await ApiService.addAppointment(appointment);
      setBooking(false);
      Alert.alert(
        'Request Submitted ⏳',
        `Your appointment request with ${doctor.name} for ${days[selectedDay].full} at ${selectedSlot.label} has been sent.\n\nPlease allow 1–2 hours for the doctor or hospital to confirm your slot. You will be notified once it's accepted.`,
        [{ text: 'My Appointments', onPress: () => navigation.navigate('Main', { screen: 'Appointments' }) }]
      );
    } catch (e) {
      setBooking(false);
      if (e.code === 'DUPLICATE') {
        Alert.alert(
          'Already Booked',
          `You already have an appointment with ${doctor.name} at this time slot. Please choose a different time or date.`,
          [{ text: 'OK' }]
        );
        return;
      }
      // SLOT_FULL / SLOT_BLOCKED / ON_LEAVE / OUTSIDE_SCHEDULE / SLOT_PAST all
      // mean the grid moved under the patient — say so, then refresh it.
      const stale = ['SLOT_FULL', 'SLOT_BLOCKED', 'ON_LEAVE', 'OUTSIDE_SCHEDULE', 'SLOT_PAST'];
      if (stale.includes(e.code)) {
        Alert.alert('Slot no longer available', e.message, [{ text: 'OK' }]);
        setSelectedSlot(null);
        setStep(1);
        loadAvailability();
      } else {
        Alert.alert('Error', e?.message || 'Could not book appointment. Please try again.');
      }
    }
  };

  const renderSlot = (slot) => {
    const isFull    = slot.state === SLOT_STATE.FULL;
    const isBlocked = slot.state === SLOT_STATE.BLOCKED;
    const isPast    = slot.state === SLOT_STATE.PAST || tooSoon(slot);
    const isDisabled = isFull || isBlocked || isPast;
    const selected  = selectedSlot?.time === slot.time && selectedSlot?.sessionId === slot.sessionId;

    return (
      <TouchableOpacity
        key={`${slot.sessionId}-${slot.time}`}
        disabled={isDisabled}
        style={[
          styles.slotChip,
          isPast && !isFull && styles.slotChipPast,
          isFull && styles.slotChipFull,
          isBlocked && styles.slotChipBlocked,
          selected && styles.slotChipActive,
        ]}
        onPress={() => setSelectedSlot(slot)}
      >
        <Text style={[
          styles.slotText,
          isPast && !isFull && styles.slotTextPast,
          isFull && styles.slotTextFull,
          isBlocked && styles.slotTextBlocked,
          selected && styles.slotTextActive,
        ]}>
          {slot.label}
        </Text>
        {isFull      && <Text style={styles.slotFullText}>Booked</Text>}
        {isBlocked   && <Text style={styles.slotBlockedText}>Unavailable</Text>}
        {isPast && !isFull && !isBlocked && <Text style={styles.slotSubText}>Past</Text>}
        {!isDisabled && slot.capacity > 1 && (
          <Text style={[styles.slotSubText, selected && { color: COLORS.white }]}>
            {slot.spotsLeft} left
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => step === 2 ? setStep(1) : navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Appointment</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {['Schedule', 'Confirm'].map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepCircle, step > i && styles.stepCircleActive]}>
              {step > i + 1
                ? <Ionicons name="checkmark" size={13} color={COLORS.white} />
                : <Text style={[styles.stepNum, step > i && styles.stepNumActive]}>{i + 1}</Text>
              }
            </View>
            <Text style={[styles.stepLabel, step > i && styles.stepLabelActive]}>{label}</Text>
            {i < 1 && <View style={[styles.stepLine, step > 1 && styles.stepLineActive]} />}
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Doctor card */}
        <View style={styles.doctorCard}>
          <ProviderAvatar kind="Doctors" name={doctor?.name} uri={doctor?.image} size={56} />
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>{doctor.name}</Text>
            <Text style={styles.doctorSpec}>{doctor.specialty}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#FFC107" />
              <Text style={styles.ratingText}>{doctor.rating} · ₹{doctor.fee} per visit</Text>
            </View>
          </View>
        </View>

        {step === 1 && (
          <>
            {/* Visit type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Visit Type</Text>
              {visitTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.typeCard, selectedType === type.id && styles.typeCardActive]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <View style={[styles.typeIcon, selectedType === type.id && styles.typeIconActive]}>
                    <Ionicons name={type.icon} size={20} color={selectedType === type.id ? COLORS.white : COLORS.primary} />
                  </View>
                  <View style={styles.typeText}>
                    <Text style={[styles.typeLabel, selectedType === type.id && styles.typeLabelActive]}>{type.label}</Text>
                    <Text style={styles.typeDesc}>{type.desc}</Text>
                  </View>
                  {selectedType === type.id && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Date picker — days the doctor doesn't consult are dimmed */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {days.map((d, i) => {
                  const info = availability.days[d.iso];
                  const closed = !loadingSlots && (!info || info.state !== DAY_STATE.OPEN);
                  const onLeave = info?.state === DAY_STATE.LEAVE;
                  return (
                    <TouchableOpacity
                      key={d.iso}
                      style={[
                        styles.dayChip,
                        selectedDay === i && styles.dayChipActive,
                        closed && styles.dayChipClosed,
                      ]}
                      onPress={() => setSelectedDay(i)}
                    >
                      <Text style={[styles.dayName, selectedDay === i && styles.dayTextActive]}>{d.day}</Text>
                      <Text style={[styles.dayDate, selectedDay === i && styles.dayTextActive]}>{d.num}</Text>
                      {d.isToday && <Text style={styles.todayText}>Today</Text>}
                      {onLeave && !d.isToday && <Text style={styles.leaveText}>Leave</Text>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Time slots, generated from the doctor's own sessions */}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Select Time</Text>
                {dayCapacity > 1 && (
                  <Text style={styles.capacityNote}>Up to {dayCapacity} patients/slot</Text>
                )}
              </View>

              {loadingSlots ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
              ) : day.state === DAY_STATE.LEAVE ? (
                <View style={styles.emptyDay}>
                  <Ionicons name="moon-outline" size={28} color={COLORS.border} />
                  <Text style={styles.emptyDayTitle}>{doctor.name} is on leave</Text>
                  <Text style={styles.emptyDaySub}>Please pick another date.</Text>
                </View>
              ) : day.slots.length === 0 ? (
                <View style={styles.emptyDay}>
                  <Ionicons name="calendar-outline" size={28} color={COLORS.border} />
                  <Text style={styles.emptyDayTitle}>No consulting hours</Text>
                  <Text style={styles.emptyDaySub}>
                    {doctor.name} does not consult on this day. Try another date.
                  </Text>
                </View>
              ) : (
                <Animated.View style={{ opacity: slotOpacity }}>
                  {day.sessions.map((session) => (
                    <View key={session.id} style={styles.sessionBlock}>
                      {day.sessions.length > 1 && (
                        <Text style={styles.sessionName}>{session.name}</Text>
                      )}
                      <View style={styles.slotsGrid}>
                        {session.slots.map(renderSlot)}
                      </View>
                    </View>
                  ))}

                  <View style={styles.legend}>
                    <View style={[styles.legendSwatch, { backgroundColor: COLORS.background, borderColor: COLORS.border }]} />
                    <Text style={styles.legendText}>Available</Text>
                    <View style={[styles.legendSwatch, { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error, marginLeft: 12 }]} />
                    <Text style={styles.legendText}>Booked</Text>
                  </View>
                </Animated.View>
              )}
            </View>
          </>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Booking Summary</Text>
            {[
              { icon: 'person',   label: 'Doctor',     value: doctor.name },
              { icon: 'medical',  label: 'Speciality', value: doctor.specialty },
              { icon: VISIT_TYPES.find(t => t.id === selectedType)?.icon || 'business', label: 'Visit Type', value: VISIT_TYPES.find(t => t.id === selectedType)?.label },
              { icon: 'calendar', label: 'Date',       value: days[selectedDay].full },
              { icon: 'time',     label: 'Time',       value: selectedSlot?.label },
            ].map(({ icon, label, value }) => (
              <View key={label} style={styles.summaryRow}>
                <View style={styles.summaryIcon}>
                  <Ionicons name={icon} size={15} color={COLORS.primary} />
                </View>
                <View style={styles.summaryText}>
                  <Text style={styles.summaryLabel}>{label}</Text>
                  <Text style={styles.summaryValue}>{value}</Text>
                </View>
              </View>
            ))}
            <View style={styles.divider} />
            {[
              { label: 'Consultation Fee', amount: doctor.fee },
              { label: 'Platform Fee',     amount: 20 },
            ].map(({ label, amount }) => (
              <View key={label} style={styles.feeRow}>
                <Text style={styles.feeName}>{label}</Text>
                <Text style={styles.feeAmt}>₹{amount}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalAmount}>₹{doctor.fee + 20}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, booking && styles.ctaDisabled]}
          onPress={step === 1 ? handleContinue : handleBook}
          disabled={booking}
        >
          {booking ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.ctaText}>
                {step === 1 ? 'Continue' : `Confirm & Pay ₹${doctor.fee + 20}`}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: SPACING.l,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border,
  },
  stepCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNum:          { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary },
  stepNumActive:    { color: COLORS.white },
  stepLabel:        { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  stepLabelActive:  { color: COLORS.primary },
  stepLine:         { width: 40, height: 2, backgroundColor: COLORS.border, marginHorizontal: 4 },
  stepLineActive:   { backgroundColor: COLORS.primary },
  doctorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: SPACING.m, marginBottom: 12,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  doctorSpec: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  section: {
    marginHorizontal: SPACING.m, marginBottom: 14,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle:   { fontSize: 15, fontWeight: '800', color: COLORS.text },
  capacityNote:   { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 10, marginBottom: 8,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  typeCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  typeIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.primarySoft,
  },
  typeIconActive: { backgroundColor: COLORS.primary },
  typeText:        { flex: 1 },
  typeLabel:       { fontSize: 14, fontWeight: '700', color: COLORS.text },
  typeLabelActive: { color: COLORS.primary },
  typeDesc:        { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  dayChip: {
    width: 56, marginRight: 10, paddingVertical: 10, borderRadius: 12,
    alignItems: 'center', backgroundColor: COLORS.background,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  dayChipActive:  { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  dayChipClosed:  { opacity: 0.4 },
  dayName:        { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  dayDate:        { fontSize: 18, fontWeight: '800', color: COLORS.text, marginVertical: 2 },
  dayTextActive:  { color: COLORS.white },
  todayText:      { fontSize: 9, fontWeight: '700', color: COLORS.primary },
  leaveText:      { fontSize: 9, fontWeight: '700', color: COLORS.error },

  sessionBlock:   { marginBottom: 14 },
  sessionName: {
    fontSize: 12, fontWeight: '800', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  slotsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
    alignItems: 'center', minWidth: 90,
  },
  slotChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  // A taken slot is red, not a faded grey — the patient should see instantly
  // that someone else has it, rather than wondering why the chip won't respond.
  slotChipFull:    { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error },
  slotChipBlocked: { backgroundColor: COLORS.mutedSoft, borderColor: COLORS.border, borderStyle: 'dashed' },
  slotChipPast:    { backgroundColor: COLORS.surface, borderColor: COLORS.border, opacity: 0.35 },
  slotText:        { fontSize: 12, fontWeight: '700', color: COLORS.text },
  slotTextActive:  { color: COLORS.white },
  slotTextFull:    { color: COLORS.error, textDecorationLine: 'line-through' },
  slotTextBlocked: { color: COLORS.textSecondary },
  slotTextPast:    { color: COLORS.textSecondary },
  slotSubText:     { fontSize: 9, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  slotFullText:    { fontSize: 9, color: COLORS.error, fontWeight: '800', marginTop: 2 },
  slotBlockedText: { fontSize: 9, color: COLORS.textSecondary, fontWeight: '700', marginTop: 2 },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  legendSwatch: { width: 11, height: 11, borderRadius: 3, borderWidth: 1.5 },
  legendText: { fontSize: 10.5, fontWeight: '700', color: COLORS.textSecondary },

  emptyDay: { alignItems: 'center', gap: 6, paddingVertical: 24, paddingHorizontal: 16 },
  emptyDayTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textSecondary },
  emptyDaySub: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 17 },

  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  summaryIcon: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.primarySoft,
  },
  summaryText:   { flex: 1 },
  summaryLabel:  { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  summaryValue:  { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 1 },
  divider:       { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  feeRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  feeName:       { fontSize: 13, color: COLORS.textSecondary },
  feeAmt:        { fontSize: 13, fontWeight: '700', color: COLORS.text },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 4, borderTopWidth: 1, borderTopColor: COLORS.border },
  totalLabel:    { fontSize: 15, fontWeight: '800', color: COLORS.text },
  totalAmount:   { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: SPACING.m, backgroundColor: COLORS.background,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  cta: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
