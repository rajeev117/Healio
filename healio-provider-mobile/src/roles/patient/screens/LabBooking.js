import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { supabase } from '../services/supabase';
import PrescriptionRequest, { hasRequest } from '../components/PrescriptionRequest';
import { createRequest } from '../../../lib/orderRequests';
import { useActiveProfile } from '../context/ActiveProfileContext';
import { displayPatientName } from '../services/activeProfile';

// ─────────────────────────────────────────────────────────────────────────────
// LabBooking — book tests against a doctor's prescription.
//   Step 1 — Prescription: attach an image/PDF and/or type the tests needed
//   Step 2 — Sample collection: home visit or walk-in
//   Step 3 — Date & time slot
//   Step 4 — Checkout: review and send the request
//
// There is no test catalogue and nothing is charged here. The request goes to
// the lab's queue, a technician prices it by hand, and the patient pays only
// after accepting that invoice (screens/OrderApproval).
// ─────────────────────────────────────────────────────────────────────────────

const TIME_SLOTS = ['07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '04:00 PM'];

const HOME_VISIT_FEE = 50;

function getNext7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      full: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate(),
      isToday: i === 0,
    });
  }
  return days;
}

const STEPS = ['Prescription', 'Collection', 'Schedule', 'Checkout'];

export default function LabBooking({ navigation, route }) {
  const lab = route?.params?.lab || { name: 'Apollo Diagnostics', rating: 4.5 };
  const { balance } = useWallet();
  const { profile } = useActiveProfile();

  const [step, setStep]                 = useState(0);
  const [attachments, setAttachments]   = useState([]);
  const [notes, setNotes]               = useState('');
  const [collectionType, setCollectionType] = useState('walkin'); // 'walkin' | 'home'
  const [address, setAddress]           = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [booking, setBooking]           = useState(false);

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
        'Add your prescription or details',
        'Attach a prescription image/PDF, or type the tests you need, to continue.'
      );
      return;
    }
    if (step < 3) setStep((s) => s + 1);
    else handleConfirm();
  };

  // Booking only sends the request — the lab prices it and the patient accepts
  // that amount before anything is charged (see OrderApproval).
  const handleConfirm = async () => {
    setBooking(true);
    let user = null;
    try { ({ data: { user } } = await supabase.auth.getUser()); } catch (_) { /* offline */ }
    const request = await createRequest({
      kind: 'lab',
      providerName: lab.name,
      patientName: displayPatientName(profile, user),
      notes: notes.trim(),
      attachments: attachments.map(a => ({ name: a.name, kind: a.kind, size: a.size, uri: a.uri })),
      fulfilment: collectionType,
      fulfilmentLabel: collectionType === 'home' ? 'Home collection' : 'Walk-in at lab',
      address: collectionType === 'home' ? address.trim() : null,
      slot: `${selectedDate} · ${selectedTime}`,
      fee: collectionType === 'home' ? { label: 'Home collection fee', amount: HOME_VISIT_FEE } : null,
    });
    try {
      if (user) {
        await supabase.from('lab_orders').insert({
          patient_id: user.id,
          // One request line rather than catalogue tests — `name` keeps the
          // order-tracking list readable.
          tests: [{
            type: 'prescription_request',
            name: attachments.length > 0
              ? `Prescription — ${attachments.length} file${attachments.length > 1 ? 's' : ''}`
              : 'Test list',
            notes: notes.trim(),
            attachments: attachments.map(a => ({ name: a.name, kind: a.kind, size: a.size, uri: a.uri })),
          }],
          collection_type: collectionType,
          collection_address: collectionType === 'home' ? address : null,
          scheduled_date: selectedDate,
          scheduled_time: selectedTime,
          home_visit_fee: homeVisitFee,
          total: 0,
          status: 'pending',
          is_test: true,
        });
      }
    } catch (dbErr) {
      console.warn('lab_orders insert:', dbErr);
    }
    setBooking(false);
    navigation.replace('OrderApproval', { requestId: request.id });
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Book Lab Tests</Text>
          <Text style={styles.headerSub}>{lab.name}</Text>
        </View>
        <View style={{ width: 40 }} />
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: SPACING.m, paddingBottom: 120 }}
        >

          {/* Step 0: Prescription / test details */}
          {step === 0 && (
            <PrescriptionRequest
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              notes={notes}
              onNotesChange={setNotes}
              title="Upload prescription"
              subtitle="Attach a clear photo or PDF of the prescription listing your tests."
              notesLabel="Test details or message"
              notesPlaceholder="e.g. CBC, Thyroid profile (T3, T4, TSH), fasting sugar. Add any instructions for the lab…"
              helper="Attach a prescription, type the tests you need, or both — at least one is needed to continue."
              rxNote="Some tests need a doctor’s prescription. The lab will confirm before collection."
            />
          )}

          {/* Step 1: Collection type */}
          {step === 1 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>Sample Collection</Text>
              {[
                { id: 'walkin', icon: 'business', label: 'Walk-in at Lab', desc: 'Visit the lab yourself. No extra charge.', extra: 'Free' },
                { id: 'home',   icon: 'home',     label: 'Home Collection', desc: 'Technician visits your home.',           extra: `+₹${HOME_VISIT_FEE}` },
              ].map(opt => (
                <TouchableOpacity key={opt.id} style={[styles.collectionCard, collectionType === opt.id && styles.collectionCardActive]}
                  onPress={() => setCollectionType(opt.id)}>
                  <View style={[styles.collectionIcon, { backgroundColor: collectionType === opt.id ? COLORS.primarySoft : COLORS.surface }]}>
                    <Ionicons name={opt.icon} size={24} color={collectionType === opt.id ? COLORS.primary : COLORS.textSecondary} />
                  </View>
                  <View style={styles.collectionInfo}>
                    <Text style={styles.collectionLabel}>{opt.label}</Text>
                    <Text style={styles.collectionDesc}>{opt.desc}</Text>
                  </View>
                  <Text style={[styles.collectionExtra, { color: opt.id === 'home' ? COLORS.textSecondary : COLORS.success }]}>
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
                    <TouchableOpacity key={d.full} style={[styles.dayChip, selectedDate === d.full && styles.dayChipActive]}
                      onPress={() => setSelectedDate(d.full)}>
                      <Text style={[styles.dayName, selectedDate === d.full && styles.dayChipActiveText]}>{d.day}</Text>
                      <Text style={[styles.dayNum, selectedDate === d.full && styles.dayChipActiveText]}>{d.date}</Text>
                      {d.isToday && <Text style={styles.todayLabel}>Today</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.sectionTitle}>Pick Time</Text>
              <View style={styles.timeGrid}>
                {TIME_SLOTS.map(slot => (
                  <TouchableOpacity key={slot} style={[styles.timeChip, selectedTime === slot && styles.timeChipActive]}
                    onPress={() => setSelectedTime(slot)}>
                    <Text style={[styles.timeText, selectedTime === slot && styles.timeTextActive]}>{slot}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 3: Checkout */}
          {step === 3 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>Checkout</Text>

              <View style={styles.summaryCard}>
                <Text style={styles.summarySection}>Lab</Text>
                <Text style={styles.summaryValue}>{lab.name}</Text>

                <View style={styles.summaryDivider} />
                <Text style={styles.summarySection}>Your request</Text>
                {attachments.length > 0 ? attachments.map(a => (
                  <View key={a.id} style={styles.attachRow}>
                    <Ionicons
                      name={a.kind === 'pdf' ? 'document-text-outline' : 'image-outline'}
                      size={15}
                      color={COLORS.primary}
                    />
                    <Text style={styles.attachName} numberOfLines={1}>{a.name}</Text>
                  </View>
                )) : (
                  <Text style={styles.summaryMeta}>No file attached</Text>
                )}
                {!!notes.trim() && <Text style={styles.notesPreview}>{notes.trim()}</Text>}

                <View style={styles.summaryDivider} />
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
                <View style={styles.summaryDivider} />
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
                <View style={[styles.summaryDivider, { marginVertical: 8 }]} />
                <View style={styles.summaryTotal}>
                  <Text style={styles.summaryTotalLabel}>Final amount</Text>
                  <Text style={styles.pendingValue}>After approval</Text>
                </View>
                <View style={[styles.summaryRow, { marginTop: 4 }]}>
                  <Text style={styles.summaryMeta}>Healio Wallet balance</Text>
                  <Text style={styles.summaryMeta}>₹{balance}</Text>
                </View>
                <View style={styles.noticeRow}>
                  <Ionicons name="information-circle-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.noticeText}>
                    Nothing is charged now. {lab.name} reviews your prescription and sends
                    an invoice with the final amount — your booking is confirmed and paid
                    from the wallet only once you accept it.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {step === 3 && (
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomTotalLabel}>Payable now</Text>
            <Text style={styles.bottomTotalValue}>₹0</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
          disabled={!canNext() || booking}
          onPress={handleNext}>
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
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  headerSub:   { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  stepBar: { flexDirection: 'row', paddingHorizontal: SPACING.m, paddingVertical: 14, gap: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  stepDotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNum: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  stepNumActive: { color: COLORS.primary },
  stepLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textSecondary, textAlign: 'center' },
  stepLabelActive: { color: COLORS.primary, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  collectionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: SPACING.m, backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, borderWidth: 1.5, borderColor: COLORS.border },
  collectionCardActive: { borderColor: COLORS.primary },
  collectionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  collectionInfo: { flex: 1 },
  collectionLabel: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  collectionDesc:  { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  collectionExtra: { fontSize: 13, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  addressInput: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.surface, textAlignVertical: 'top' },
  dayChip: { width: 56, paddingVertical: 10, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', gap: 2 },
  dayChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayChipActiveText: { color: COLORS.white },
  dayName: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  dayNum:  { fontSize: 16, fontWeight: '800', color: COLORS.text },
  todayLabel: { fontSize: 8, fontWeight: '700', color: COLORS.primary },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border },
  timeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  timeTextActive: { color: COLORS.white, fontWeight: '700' },
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  summarySection: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue:   { fontSize: 14, fontWeight: '700', color: COLORS.text },
  summaryDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRowLabel:{ fontSize: 13, color: COLORS.text, flex: 1 },
  summaryRowValue:{ fontSize: 13, fontWeight: '700', color: COLORS.text },
  pendingValue:   { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  summaryMeta:    { fontSize: 11, color: COLORS.textSecondary },
  changeLink: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  notesPreview: { fontSize: 12.5, color: COLORS.text, lineHeight: 18, marginTop: 4 },
  noticeRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  noticeText: { flex: 1, fontSize: 11, color: COLORS.textSecondary, lineHeight: 15.5 },
  summaryTotal:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTotalLabel:{ fontSize: 15, fontWeight: '800', color: COLORS.text },
  summaryTotalValue:{ fontSize: 18, fontWeight: '800', color: COLORS.primary },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.m, gap: 10 },
  bottomTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomTotalLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  bottomTotalValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14 },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
