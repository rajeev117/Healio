// ─────────────────────────────────────────────────────────────────────────────
// PharmacyOrder (RMP) — order medicines for a linked patient, on their behalf.
//   Step 1 — Prescription: attach an image/PDF and/or type the medicines needed
//   Step 2 — Fulfilment: home delivery or walk-in pickup, plus the slot
//   Step 3 — Checkout: review and send the request
//
// Same shape as the patient app's PharmacyOrder: no catalogue, nothing priced
// here. The request lands in the pharmacy's queue, a pharmacist prices it by
// hand, and the patient accepts that invoice before anything is charged.
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

const STEPS = ['Prescription', 'Fulfilment', 'Checkout'];

const DELIVERY_SLOTS = ['Within 2 hours', 'Today evening (5–8 PM)', 'Tomorrow morning (9 AM–12 PM)', 'Tomorrow afternoon (12–4 PM)'];
const PICKUP_SLOTS   = ['Within 1 hour', 'Today evening (5–8 PM)', 'Tomorrow morning (9 AM–12 PM)', 'Tomorrow afternoon (12–4 PM)'];

const DELIVERY_FEE = 20;

export default function PharmacyOrder({ navigation, route }) {
  const { patient, facility } = route.params;
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [notes, setNotes] = useState('');
  const [fulfilment, setFulfilment] = useState('delivery'); // 'delivery' | 'walkin'
  const [address, setAddress] = useState('');
  const [slot, setSlot] = useState('');
  const [placing, setPlacing] = useState(false);

  const isDelivery = fulfilment === 'delivery';
  const requestReady = hasRequest(attachments, notes);
  const deliveryFee = isDelivery ? DELIVERY_FEE : 0;
  const slots = isDelivery ? DELIVERY_SLOTS : PICKUP_SLOTS;

  // Slot wording differs between the two modes, so a switch clears the pick.
  const chooseFulfilment = (mode) => {
    if (mode === fulfilment) return;
    setFulfilment(mode);
    setSlot('');
  };

  const canNext = () => {
    if (step === 0) return requestReady;
    if (step === 1) return (!isDelivery || address.trim().length > 5) && !!slot;
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !requestReady) {
      Alert.alert(
        'Add the prescription or details',
        'Attach a prescription image/PDF, or type the medicines the patient needs, to continue.'
      );
      return;
    }
    if (step < 2) setStep(s => s + 1);
    else handlePlaceOrder();
  };

  // Placing only raises the request — the pharmacy prices it and the patient
  // accepts that amount before anything is charged. Nothing is written to
  // `pharmacy_orders`: its insert policy is `patient_id = auth.uid()`, which an
  // RMP ordering on someone's behalf can never satisfy.
  const handlePlaceOrder = async () => {
    setPlacing(true);
    try {
      const request = await createRequest({
        kind: 'pharmacy',
        providerId: facility.id,
        providerName: facility.name,
        // A hospital's pharmacy is a unit inside it — keep the org and unit so
        // the request can be routed to the right counter.
        organisationId: facility.organisationId || null,
        providerUnit: facility.unit || null,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone || null,
        // Present when the medicines are for a household member — patientId
        // stays the account, patientName is already the member's.
        familyMemberId: patient.familyMemberId || null,
        relation: patient.relation || null,
        rmpId: user?.userId || null,
        bookedBy: 'rmp',
        bookedByLabel: `${user?.name || 'Healthcare Consultant'} · Healthcare Consultant`,
        notes: notes.trim(),
        attachments: attachments.map(a => ({ name: a.name, kind: a.kind, size: a.size, uri: a.uri })),
        fulfilment,
        fulfilmentLabel: isDelivery ? 'Home delivery' : 'Walk-in pickup',
        address: isDelivery ? address.trim() : null,
        slot,
        fee: isDelivery ? { label: 'Delivery fee', amount: DELIVERY_FEE } : null,
      });
      navigation.replace('OrderRequestStatus', { requestId: request.id, patient });
    } catch (e) {
      Alert.alert('Could not send', e.message || 'Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader
        title="Order Medicines"
        step={`Step ${step + 1}/${STEPS.length}`}
        onBack={() => (step > 0 ? setStep(s => s - 1) : navigation.goBack())}
      />

      <View style={styles.contextBar}>
        <Ionicons name="medical-outline" size={15} color={COLORS.primary} />
        <Text style={styles.contextText} numberOfLines={2}>
          {facility.name} · for <Text style={styles.contextName}>{patient.name}</Text>
          {!!patient.accountName && <Text>{` (${patient.relation}) · account: ${patient.accountName}`}</Text>}
        </Text>
      </View>

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
          {/* Step 0: Prescription / medicine details */}
          {step === 0 && (
            <PrescriptionRequest
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              notes={notes}
              onNotesChange={setNotes}
              title="Upload prescription"
              subtitle="Attach a clear photo or PDF of the doctor’s prescription."
              notesLabel="Medicine details or message"
              notesPlaceholder="e.g. Dolo 650 — 1 strip, Pan 40 — 10 tablets. Add any instructions for the pharmacy…"
              helper="Attach a prescription, type the medicines needed, or both — at least one is needed to continue."
              rxNote="Prescription-only (Rx) medicines are dispensed only against a valid prescription."
            />
          )}

          {/* Step 1: Delivery or walk-in pickup */}
          {step === 1 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>How should the patient receive it?</Text>
              {[
                { id: 'delivery', icon: 'bicycle',    label: 'Home Delivery',  desc: 'Medicines delivered to the patient.',        extra: `+₹${DELIVERY_FEE}` },
                { id: 'walkin',   icon: 'storefront', label: 'Walk-in Pickup', desc: `Collect in person from ${facility.name}.`,   extra: 'Free' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionCard, fulfilment === opt.id && styles.optionCardActive]}
                  onPress={() => chooseFulfilment(opt.id)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.optionIcon, fulfilment === opt.id && styles.optionIconActive]}>
                    <Ionicons name={opt.icon} size={22} color={fulfilment === opt.id ? COLORS.primary : COLORS.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                    <Text style={styles.optionDesc}>{opt.desc}</Text>
                  </View>
                  <Text style={[styles.optionExtra, { color: opt.id === 'walkin' ? COLORS.success : COLORS.textSecondary }]}>
                    {opt.extra}
                  </Text>
                </TouchableOpacity>
              ))}

              {isDelivery ? (
                <View>
                  <Text style={styles.fieldLabel}>Delivery Address *</Text>
                  <TextInput
                    style={styles.addressInput}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Flat no., building, street, area, city…"
                    placeholderTextColor={COLORS.textSecondary}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              ) : (
                <View style={styles.pickupCard}>
                  <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.pickupText}>
                    Collect from {facility.name}. The patient should carry the prescription and a photo ID.
                  </Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>{isDelivery ? 'Delivery Slot' : 'Pickup Time'}</Text>
              {slots.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.slotCard, slot === s && styles.slotCardActive]}
                  onPress={() => setSlot(s)}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={slot === s ? 'checkmark-circle' : 'time-outline'}
                    size={20}
                    color={slot === s ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text style={[styles.slotText, slot === s && styles.slotTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 2: Checkout */}
          {step === 2 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>Review</Text>

              <View style={styles.summaryCard}>
                <Text style={styles.summarySection}>Patient</Text>
                <Text style={styles.summaryValue}>{patient.name}{patient.phone ? ` · ${patient.phone}` : ''}</Text>

                <View style={styles.divider} />
                <Text style={styles.summarySection}>Pharmacy</Text>
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
                  <Text style={styles.summarySection}>Fulfilment</Text>
                  <TouchableOpacity onPress={() => setStep(1)} hitSlop={8}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.summaryValue}>{isDelivery ? 'Home delivery' : 'Walk-in pickup'}</Text>
                <Text style={styles.summaryMeta}>{isDelivery ? address : `Collect from ${facility.name}`}</Text>

                <View style={styles.divider} />
                <Text style={styles.summarySection}>{isDelivery ? 'Delivery slot' : 'Pickup time'}</Text>
                <Text style={styles.summaryValue}>{slot}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summarySection}>Charges</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Medicines (as per prescription)</Text>
                  <Text style={styles.pendingValue}>On review</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>{isDelivery ? 'Delivery fee' : 'Walk-in pickup'}</Text>
                  <Text style={styles.summaryRowValue}>{deliveryFee > 0 ? `₹${deliveryFee}` : 'Free'}</Text>
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
                    an invoice with the final amount — the order is confirmed once
                    {' '}{patient.name} accepts it in the Healio patient app.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        {step === 2 && (
          <View style={styles.bottomTotal}>
            <Text style={styles.bottomTotalLabel}>Payable now</Text>
            <Text style={styles.bottomTotalValue}>₹0</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, (!canNext() || placing) && styles.nextBtnDisabled]}
          disabled={!canNext() || placing}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {placing ? 'Sending Request…' : step < 2 ? 'Continue' : 'Send Order Request'}
          </Text>
          {!placing && <Ionicons name={step < 2 ? 'arrow-forward' : 'bag-check'} size={18} color={COLORS.white} />}
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
  pickupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
    backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  pickupText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 17 },
  slotCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border,
  },
  slotCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  slotText: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  slotTextActive: { color: COLORS.primary, fontWeight: '700' },

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
