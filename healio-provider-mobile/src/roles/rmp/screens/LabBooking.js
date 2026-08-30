// ─────────────────────────────────────────────────────────────────────────────
// LabBooking (RMP) — book tests for a linked patient, on their behalf.
//   Step 1 — Prescription: attach an image/PDF and/or type the tests needed
//   Step 2 — Sample collection: home visit or walk-in
//   Step 3 — Date & time slot
//   Step 4 — Checkout: review and send the request
//
// Deliberately the same shape as the patient app's LabBooking: no test
// catalogue, nothing priced here. The request lands in the lab's queue
// (components/OrderRequestsScreen), a technician prices it by hand, and the
// patient accepts that invoice in their own app before anything is charged.
// The only difference is who raised it — that rides on the request as
// `bookedByLabel` so the lab can see a Healthcare Consultant sent it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import PrescriptionRequest, { hasRequest } from '../components/PrescriptionRequest';
import { useAuth } from '../../../context/AuthContext';
import { createRequest } from '../../../lib/orderRequests';

const STEPS = ['Prescription', 'Collection', 'Schedule', 'Checkout'];

const TIME_SLOTS = ['07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '04:00 PM'];

const HOME_VISIT_FEE = 50;

function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      full: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate(),
      isToday: i === 0,
    };
  });
}

export default function LabBooking({ navigation, route }) {
  const { patient, facility } = route.params;
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [notes, setNotes] = useState('');
  const [collectionType, setCollectionType] = useState('walkin'); // 'walkin' | 'home'
  const [address, setAddress] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [booking, setBooking] = useState(false);

  const days = getNext7Days();
  const requestReady = hasRequest(attachments, notes);
  const homeVisitFee = collectionType === 'home' ? HOME_VISIT_FEE : 0;

  const canNext = () => {
    if (step === 0) return requestReady;
    if (step === 1) return collectionType === 'walkin' || address.trim().length > 5;
    if (step === 2) return !!selectedDate && !!selectedTime;
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !requestReady) {
      Alert.alert(
        'Add the prescription or details',
        'Attach a prescription image/PDF, or type the tests the patient needs, to continue.'
      );
      return;
    }
    if (step < 3) setStep(s => s + 1);
    else handleConfirm();
  };

  // Sending only raises the request — the lab prices it and the patient accepts
  // that amount before anything is charged. Nothing is written to `lab_orders`:
  // that table's insert policy is `patient_id = auth.uid()`, so an RMP booking
  // on someone's behalf would be rejected by RLS.
  const handleConfirm = async () => {
    setBooking(true);
    try {
      const request = await createRequest({
        kind: 'lab',
        providerId: facility.id,
        providerName: facility.name,
        // A hospital's lab is a unit inside it — keep the org and unit so the
        // request can be routed to the right desk.
        organisationId: facility.organisationId || null,
        providerUnit: facility.unit || null,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone || null,
        // Present when the tests are for a household member — patientId stays
        // the account, patientName is already the member's.
        familyMemberId: patient.familyMemberId || null,
        relation: patient.relation || null,
        rmpId: user?.userId || null,
        bookedBy: 'rmp',
        bookedByLabel: `${user?.name || 'Healthcare Consultant'} · Healthcare Consultant`,
        notes: notes.trim(),
        attachments: attachments.map(a => ({ name: a.name, kind: a.kind, size: a.size, uri: a.uri })),
        fulfilment: collectionType,
        fulfilmentLabel: collectionType === 'home' ? 'Home collection' : 'Walk-in at lab',
        address: collectionType === 'home' ? address.trim() : null,
        slot: `${selectedDate} · ${selectedTime}`,
        fee: collectionType === 'home' ? { label: 'Home collection fee', amount: HOME_VISIT_FEE } : null,
      });
      navigation.replace('OrderRequestStatus', { requestId: request.id, patient });
    } catch (e) {
      Alert.alert('Could not send', e.message || 'Please try again.');
    } finally {
      setBooking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Book Lab Tests"
        step={`Step ${step + 1}/${STEPS.length}`}
        onBack={() => (step > 0 ? setStep(s => s - 1) : navigation.goBack())}
      />

      <View style={styles.contextBar}>
        <Ionicons name="flask-outline" size={15} color={COLORS.primary} />
        <Text style={styles.contextText} numberOfLines={2}>
          {facility.name} · for <Text style={styles.contextName}>{patient.name}</Text>
          {!!patient.accountName && <Text>{` (${patient.relation}) · account: ${patient.accountName}`}</Text>}
        </Text>
      </View>

      {/* Step indicators */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
              {i < step
                ? <Ionicons name="checkmark" size={12} color={COLORS.white} />
                : <Text style={[styles.stepNum, i <= step && styles.stepNumActive]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          {/* Step 0: Prescription / test details */}
          {step === 0 && (
            <PrescriptionRequest
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              notes={notes}
              onNotesChange={setNotes}
              title="Upload prescription"
              subtitle="Attach a clear photo or PDF of the prescription listing the tests."
              notesLabel="Test details or message"
              notesPlaceholder="e.g. CBC, Thyroid profile (T3, T4, TSH), fasting sugar. Add any instructions for the lab…"
              helper="Attach a prescription, type the tests needed, or both — at least one is needed to continue."
              rxNote="Some tests need a doctor’s prescription. The lab will confirm before collection."
            />
          )}

          {/* Step 1: Collection type */}
          {step === 1 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>Sample Collection</Text>
              {[
                { id: 'walkin', icon: 'business', label: 'Walk-in at Lab', desc: 'Patient visits the lab. No extra charge.', extra: 'Free' },
                { id: 'home',   icon: 'home',     label: 'Home Collection', desc: 'Technician visits the patient’s home.',  extra: `+₹${HOME_VISIT_FEE}` },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionCard, collectionType === opt.id && styles.optionCardActive]}
                  onPress={() => setCollectionType(opt.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.optionIcon, collectionType === opt.id && styles.optionIconActive]}>
                    <Ionicons name={opt.icon} size={22} color={collectionType === opt.id ? COLORS.primary : COLORS.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.desc}</Text>
                  </View>
                  <Text style={[styles.optionExtra, { color: opt.id === 'home' ? COLORS.textSecondary : COLORS.success }]}>
                    {opt.extra}
                  </Text>
                </TouchableOpacity>
              ))}
              {collectionType === 'home' && (
                <View>
                  <Text style={styles.fieldLabel}>Collection Address *</Text>
                  <TextInput
                    style={styles.addressInput}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Flat no., building, street, area…"
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}
            </View>
          )}

          {/* Step 2: Schedule */}
          {step === 2 && (
            <View style={{ gap: 16 }}>
              <Text style={styles.sectionTitle}>Pick Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {days.map(d => (
                    <TouchableOpacity
                      key={d.full}
                      style={[styles.dayChip, selectedDate === d.full && styles.dayChipActive]}
                      onPress={() => setSelectedDate(d.full)}
                    >
                      <Text style={[styles.dayName, selectedDate === d.full && styles.chipTextActive]}>{d.day}</Text>
                      <Text style={[styles.dayNum, selectedDate === d.full && styles.chipTextActive]}>{d.date}</Text>
                      {d.isToday && <Text style={[styles.todayLabel, selectedDate === d.full && styles.chipTextActive]}>Today</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.sectionTitle}>Pick Time</Text>
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map(slot => (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.timeChip, selectedTime === slot && styles.timeChipActive]}
                    onPress={() => setSelectedTime(slot)}
                  >
                    <Text style={[styles.timeText, selectedTime === slot && styles.chipTextActive]}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 3: Checkout */}
          {step === 3 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>Review</Text>

              <View style={styles.summaryCard}>
                <Text style={styles.summarySection}>Patient</Text>
                <Text style={styles.summaryValue}>{patient.name}{patient.phone ? ` · ${patient.phone}` : ''}</Text>

                <View style={styles.divider} />
                <Text style={styles.summarySection}>Lab</Text>
                <Text style={styles.summaryValue}>{facility.name}</Text>

                <View style={styles.divider} />
                <Text style={styles.summarySection}>Request</Text>
                {attachments.length > 0 ? attachments.map(a => (
                  <View key={a.id} style={styles.attachRow}>
                    <Ionicons name={a.kind === 'pdf' ? 'document-text-outline' : 'image-outline'} size={15} color={COLORS.primary} />
                    <Text style={styles.attachName} numberOfLines={1}>{a.name}</Text>
                  </View>
                )) : (
                  <Text style={styles.summaryMeta}>No file attached</Text>
                )}
                {!!notes.trim() && <Text style={styles.notesPreview}>{notes.trim()}</Text>}

                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summarySection}>Collection</Text>
                  <TouchableOpacity onPress={() => setStep(1)} hitSlop={8}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>{collectionType === 'home' ? 'Home collection' : 'Walk-in at lab'}</Text>
                  <Text style={styles.summaryRowValue}>{homeVisitFee > 0 ? `₹${homeVisitFee}` : 'Free'}</Text>
                </View>
                {collectionType === 'home' && <Text style={styles.summaryMeta}>{address}</Text>}

                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>{selectedDate}</Text>
                  <Text style={styles.summaryRowValue}>{selectedTime}</Text>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summarySection}>Charges</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Tests (as per prescription)</Text>
                  <Text style={styles.pendingValue}>On review</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>{collectionType === 'home' ? 'Home collection fee' : 'Walk-in collection'}</Text>
                  <Text style={styles.summaryRowValue}>{homeVisitFee > 0 ? `₹${homeVisitFee}` : 'Free'}</Text>
                </View>
                <View style={[styles.divider, { marginVertical: 8 }]} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Final amount</Text>
                  <Text style={styles.pendingValue}>After approval</Text>
                </View>
                <View style={styles.noticeRow}>
                  <Ionicons name="information-circle-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.noticeText}>
                    Nothing is charged now. {facility.name} reviews the prescription and sends
                    an invoice with the final amount — the booking is confirmed once
                    {' '}{patient.name} accepts it in the Healio patient app.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        {step === 3 && (
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomTotalLabel}>Payable now</Text>
            <Text style={styles.bottomTotalValue}>₹0</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, (!canNext() || booking) && styles.nextBtnDisabled]}
          disabled={!canNext() || booking}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {booking ? 'Sending Request…' : step < 3 ? 'Continue' : 'Send Booking Request'}
          </Text>
          {!booking && <Ionicons name={step < 3 ? 'arrow-forward' : 'checkmark-circle'} size={18} color={COLORS.white} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 130 },
  contextBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primarySoft, marginHorizontal: 20,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 12,
  },
  contextText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary },
  contextName: { fontWeight: '700', color: COLORS.text },

  stepBar: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, gap: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginTop: 12,
  },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  stepDotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNum: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  stepNumActive: { color: COLORS.primary },
  stepLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  stepLabelActive: { color: COLORS.primary, fontWeight: '800' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  optionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border,
  },
  optionCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  optionIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  optionIconActive: { backgroundColor: COLORS.white },
  optionLabel: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  optionDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  optionExtra: { fontSize: 13, fontWeight: '700' },

  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  addressInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
    color: COLORS.text, backgroundColor: COLORS.surface, textAlignVertical: 'top',
  },

  dayChip: {
    width: 58, paddingVertical: 10, borderRadius: 14, backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', gap: 2,
  },
  dayChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayName: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  dayNum: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  todayLabel: { fontSize: 8, fontWeight: '700', color: COLORS.primary },
  chipTextActive: { color: COLORS.white },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  timeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },

  summaryCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
  },
  summarySection: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRowLabel: { fontSize: 13, color: COLORS.text, flex: 1 },
  summaryRowValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  pendingValue: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  summaryMeta: { fontSize: 11, color: COLORS.textSecondary },
  totalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  changeLink: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  notesPreview: { fontSize: 12.5, color: COLORS.text, lineHeight: 18, marginTop: 4 },
  noticeRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  noticeText: { flex: 1, fontSize: 11, color: COLORS.textSecondary, lineHeight: 15.5 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18, gap: 10,
  },
  bottomTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomTotalLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  bottomTotalValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 26, height: 52,
  },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
