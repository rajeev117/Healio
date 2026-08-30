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
// PharmacyOrder — order medicines from a pharmacy against a prescription.
//   Step 1 — Prescription: attach an image/PDF and/or type the medicines needed
//   Step 2 — Fulfilment: home delivery or walk-in pickup, plus the slot
//   Step 3 — Checkout: review and send the request
//
// There is no catalogue to browse and nothing is charged here. The request goes
// to the pharmacy's queue, a pharmacist prices it by hand, and the patient pays
// only after accepting that invoice (screens/OrderApproval).
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ['Prescription', 'Fulfilment', 'Checkout'];

const DELIVERY_SLOTS = ['Within 2 hours', 'Today evening (5–8 PM)', 'Tomorrow morning (9 AM–12 PM)', 'Tomorrow afternoon (12–4 PM)'];
const PICKUP_SLOTS   = ['Within 1 hour', 'Today evening (5–8 PM)', 'Tomorrow morning (9 AM–12 PM)', 'Tomorrow afternoon (12–4 PM)'];

const DELIVERY_FEE = 20;

export default function PharmacyOrder({ navigation, route }) {
  const pharmacy = route?.params?.pharmacy || { name: 'City Pharmacy', rating: 4.3 };
  const { balance } = useWallet();
  const { profile } = useActiveProfile();

  const [step, setStep]               = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [notes, setNotes]             = useState('');
  const [fulfilment, setFulfilment]   = useState('delivery'); // 'delivery' | 'walkin'
  const [address, setAddress]         = useState('');
  const [slot, setSlot]               = useState('');
  const [placing, setPlacing]         = useState(false);

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
        'Add your prescription or details',
        'Attach a prescription image/PDF, or type the medicines you need, to continue.'
      );
      return;
    }
    if (step < 2) setStep((s) => s + 1);
    else handlePlaceOrder();
  };

  // Placing the order only sends the request — the pharmacy prices it and the
  // patient accepts that amount before anything is charged (see OrderApproval).
  const handlePlaceOrder = async () => {
    setPlacing(true);
    let user = null;
    try { ({ data: { user } } = await supabase.auth.getUser()); } catch (_) { /* offline */ }
    const request = await createRequest({
      kind: 'pharmacy',
      providerName: pharmacy.name,
      patientName: displayPatientName(profile, user),
      notes: notes.trim(),
      attachments: attachments.map(a => ({ name: a.name, kind: a.kind, size: a.size, uri: a.uri })),
      fulfilment,
      fulfilmentLabel: isDelivery ? 'Home delivery' : 'Walk-in pickup',
      address: isDelivery ? address.trim() : null,
      slot,
      fee: isDelivery ? { label: 'Delivery fee', amount: DELIVERY_FEE } : null,
    });
    try {
      if (user) {
        await supabase.from('pharmacy_orders').insert({
          patient_id: user.id,
          // One request line rather than catalogue items — `name` keeps the
          // order-tracking list readable.
          items: [{
            type: 'prescription_request',
            name: attachments.length > 0
              ? `Prescription — ${attachments.length} file${attachments.length > 1 ? 's' : ''}`
              : 'Medicine list',
            fulfilment,
            notes: notes.trim(),
            attachments: attachments.map(a => ({ name: a.name, kind: a.kind, size: a.size, uri: a.uri })),
          }],
          delivery_address: isDelivery ? address : null,
          delivery_slot: slot,
          delivery_fee: deliveryFee,
          total: 0,
          status: 'pending',
          is_test: true,
        });
      }
    } catch (dbErr) {
      console.warn('pharmacy_orders insert:', dbErr);
    }
    setPlacing(false);
    navigation.replace('OrderApproval', { requestId: request.id });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Order Medicines</Text>
          <Text style={styles.headerSub}>{pharmacy.name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Step bar */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
              {i < step ? <Ionicons name="checkmark" size={12} color={COLORS.white} />
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
          contentContainerStyle={{ padding: SPACING.m, paddingBottom: 130 }}
        >

          {/* Step 0: Prescription / medicine details */}
          {step === 0 && (
            <PrescriptionRequest
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              notes={notes}
              onNotesChange={setNotes}
              title="Upload prescription"
              subtitle="Attach a clear photo or PDF of your doctor’s prescription."
              notesLabel="Medicine details or message"
              notesPlaceholder="e.g. Dolo 650 — 1 strip, Pan 40 — 10 tablets. Add any instructions for the pharmacy…"
              helper="Attach a prescription, type the medicines you need, or both — at least one is needed to continue."
              rxNote="Prescription-only (Rx) medicines are dispensed only against a valid prescription."
            />
          )}

          {/* Step 1: Delivery or walk-in pickup */}
          {step === 1 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>How would you like to receive it?</Text>
              {[
                { id: 'delivery', icon: 'bicycle', label: 'Home Delivery', desc: 'Medicines delivered to your address.', extra: `+₹${DELIVERY_FEE}` },
                { id: 'walkin',   icon: 'storefront', label: 'Walk-in Pickup', desc: `Collect in person from ${pharmacy.name}.`, extra: 'Free' },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.modeCard, fulfilment === opt.id && styles.modeCardActive]}
                  onPress={() => chooseFulfilment(opt.id)}
                >
                  <View style={[styles.modeIcon, { backgroundColor: fulfilment === opt.id ? COLORS.primarySoft : COLORS.background }]}>
                    <Ionicons name={opt.icon} size={24} color={fulfilment === opt.id ? COLORS.primary : COLORS.textSecondary} />
                  </View>
                  <View style={styles.modeInfo}>
                    <Text style={styles.modeLabel}>{opt.label}</Text>
                    <Text style={styles.modeDesc}>{opt.desc}</Text>
                  </View>
                  <Text style={[styles.modeExtra, { color: opt.id === 'walkin' ? COLORS.success : COLORS.textSecondary }]}>
                    {opt.extra}
                  </Text>
                </TouchableOpacity>
              ))}

              {isDelivery ? (
                <>
                  <Text style={styles.sectionTitle}>Delivery Address</Text>
                  <TextInput style={styles.addressInput} value={address} onChangeText={setAddress}
                    placeholder="Flat no., building, street, area, city…"
                    placeholderTextColor={COLORS.textSecondary} multiline numberOfLines={3} />
                </>
              ) : (
                <View style={styles.pickupCard}>
                  <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.pickupText}>
                    Collect from {pharmacy.name}. Carry your prescription and a photo ID.
                  </Text>
                </View>
              )}

              <Text style={styles.sectionTitle}>{isDelivery ? 'Delivery Slot' : 'Pickup Time'}</Text>
              {slots.map(s => (
                <TouchableOpacity key={s} style={[styles.slotCard, slot === s && styles.slotCardActive]} onPress={() => setSlot(s)}>
                  <Ionicons name={slot === s ? 'checkmark-circle' : 'time-outline'} size={20} color={slot === s ? COLORS.primary : COLORS.textSecondary} />
                  <Text style={[styles.slotText, slot === s && styles.slotTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Step 2: Checkout */}
          {step === 2 && (
            <View style={{ gap: 14 }}>
              <Text style={styles.sectionTitle}>Checkout</Text>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Pharmacy</Text>
                <Text style={styles.summaryValue}>{pharmacy.name}</Text>

                <View style={styles.divider} />
                <Text style={styles.summaryLabel}>Your request</Text>
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

                <View style={styles.divider} />
                <Text style={styles.summaryLabel}>Fulfilment</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryValue}>
                    {isDelivery ? 'Home delivery' : 'Walk-in pickup'}
                  </Text>
                  <TouchableOpacity onPress={() => setStep(1)} hitSlop={8}>
                    <Text style={styles.changeLink}>Change</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.summaryMeta}>
                  {isDelivery ? address : `Collect from ${pharmacy.name}`}
                </Text>
                <View style={styles.divider} />
                <Text style={styles.summaryLabel}>{isDelivery ? 'Delivery slot' : 'Pickup time'}</Text>
                <Text style={styles.summaryValue}>{slot}</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Charges</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>Medicines (as per prescription)</Text>
                  <Text style={styles.pendingValue}>On review</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryRowLabel}>
                    {isDelivery ? 'Delivery fee' : 'Walk-in pickup'}
                  </Text>
                  <Text style={styles.summaryRowVal}>
                    {deliveryFee > 0 ? `₹${deliveryFee}` : 'Free'}
                  </Text>
                </View>
                <View style={[styles.divider, { marginVertical: 8 }]} />
                <View style={styles.summaryRow}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.text }}>Final amount</Text>
                  <Text style={styles.pendingValue}>After approval</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryMeta}>Healio Wallet balance</Text>
                  <Text style={styles.summaryMeta}>₹{balance}</Text>
                </View>
                <View style={styles.noticeRow}>
                  <Ionicons name="information-circle-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.noticeText}>
                    Nothing is charged now. {pharmacy.name} reviews your prescription and
                    sends an invoice with the final amount — your order is confirmed and
                    paid from the wallet only once you accept it.
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        {step === 2 && (
          <View style={styles.bottomSummary}>
            <Text style={styles.bottomLabel}>Payable now</Text>
            <Text style={styles.bottomValue}>₹0</Text>
          </View>
        )}
        <TouchableOpacity style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
          disabled={!canNext() || placing}
          onPress={handleNext}>
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
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.m, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  headerSub: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  stepBar: { flexDirection: 'row', paddingHorizontal: SPACING.m, paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  stepDotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNum: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  stepNumActive: { color: COLORS.primary },
  stepLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textSecondary },
  stepLabelActive: { color: COLORS.primary, fontWeight: '800' },
  addressInput: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.surface, textAlignVertical: 'top' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: SPACING.m, backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, borderWidth: 1.5, borderColor: COLORS.border },
  modeCardActive: { borderColor: COLORS.primary },
  modeIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modeInfo: { flex: 1 },
  modeLabel: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  modeDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  modeExtra: { fontSize: 13, fontWeight: '700' },
  pickupCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: SPACING.m, backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, borderWidth: 1, borderColor: COLORS.border },
  pickupText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 17 },
  changeLink: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  slotCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.m, backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, borderWidth: 1.5, borderColor: COLORS.border },
  slotCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  slotText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  slotTextActive: { color: COLORS.primary, fontWeight: '700' },
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryRowLabel: { fontSize: 13, color: COLORS.text, flex: 1 },
  summaryRowVal: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  pendingValue: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  summaryMeta: { fontSize: 11, color: COLORS.textSecondary },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  notesPreview: { fontSize: 12.5, color: COLORS.text, lineHeight: 18, marginTop: 4 },
  noticeRow: { flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  noticeText: { flex: 1, fontSize: 11, color: COLORS.textSecondary, lineHeight: 15.5 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.m, gap: 10 },
  bottomSummary: { flexDirection: 'row', justifyContent: 'space-between' },
  bottomLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  bottomValue: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14 },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
