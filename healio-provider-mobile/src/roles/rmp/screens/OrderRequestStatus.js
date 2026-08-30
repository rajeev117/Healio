// ─────────────────────────────────────────────────────────────────────────────
// OrderRequestStatus — what the RMP sees after raising a lab or pharmacy order
// for a patient, and the screen a request opens into from the Bookings tab.
//
//   1. Request sent      — with the lab / pharmacy
//   2. Provider review   — a technician / pharmacist is pricing it
//   3. Invoice shared    — the amount is with the patient to accept
//   4. Confirmed         — the patient accepted and paid
//
// The RMP never pays: the patient accepts the final amount in their own app
// (screens/OrderApproval there), which is what confirms the order. Until the
// provider has priced it, the RMP can still withdraw the request.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { CustomButton } from '../components/CustomButton';
import {
  STATUS, getRequest, subscribe, cancelRequest, formatWhen,
} from '../../../lib/orderRequests';

const STEPS = ['Request sent', 'Provider review', 'Invoice shared', 'Confirmed'];

const STEP_OF = {
  [STATUS.AWAITING_REVIEW]: 1,
  [STATUS.QUOTED]: 2,
  [STATUS.CONFIRMED]: 3,
  [STATUS.DECLINED]: 2,
  [STATUS.CANCELLED]: 0,
};

export default function OrderRequestStatus({ navigation, route }) {
  const requestId = route?.params?.requestId;
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await getRequest(requestId);
      if (!alive) return;
      setRequest(r);
      setLoading(false);
    };
    load();
    // The provider prices it in the same app — re-read on every store change.
    const unsub = subscribe(load);
    return () => { alive = false; unsub(); };
  }, [requestId]);

  if (loading || !request) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Order Request" onBack={() => navigation.goBack()} />
        <Text style={styles.empty}>{loading ? 'Loading…' : 'This request is no longer available.'}</Text>
      </SafeAreaView>
    );
  }

  const isLab = request.kind === 'lab';
  const invoice = request.invoice;
  const current = STEP_OF[request.status] ?? 0;
  const closed = request.status === STATUS.CANCELLED || request.status === STATUS.DECLINED;

  const withdraw = () => {
    Alert.alert(
      'Withdraw this request?',
      `${request.providerName} will no longer see it. Nothing has been charged.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            await cancelRequest(request.id, 'Withdrawn by the Healthcare Consultant');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={isLab ? 'Lab Request' : 'Medicine Order'} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Banner */}
        <View style={[styles.banner, closed && styles.bannerClosed]}>
          <View style={[styles.bannerIcon, closed && styles.bannerIconClosed]}>
            <Ionicons
              name={closed ? 'close' : request.status === STATUS.CONFIRMED ? 'checkmark' : 'paper-plane'}
              size={22}
              color={COLORS.white}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>
              {request.status === STATUS.AWAITING_REVIEW && 'Request sent'}
              {request.status === STATUS.QUOTED && 'Invoice with the patient'}
              {request.status === STATUS.CONFIRMED && 'Order confirmed'}
              {request.status === STATUS.DECLINED && 'Patient declined the amount'}
              {request.status === STATUS.CANCELLED && (request.closeReason || 'Request cancelled')}
            </Text>
            <Text style={styles.bannerMeta}>
              {request.orderNumber} · {formatWhen(request.createdAt)}
            </Text>
          </View>
        </View>

        {/* Progress */}
        <View style={styles.card}>
          {STEPS.map((label, i) => {
            const done = !closed && i < current;
            const active = !closed && i === current;
            return (
              <View key={label} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View style={[styles.stepDot, (done || active) && styles.stepDotOn, active && styles.stepDotActive]}>
                    {done && <Ionicons name="checkmark" size={11} color={COLORS.white} />}
                  </View>
                  {i < STEPS.length - 1 && <View style={[styles.stepLine, done && styles.stepLineOn]} />}
                </View>
                <View style={styles.stepText}>
                  <Text style={[styles.stepLabel, (done || active) && styles.stepLabelOn]}>{label}</Text>
                  {active && (
                    <Text style={styles.stepHint}>
                      {i === 1 && `${request.providerName} is pricing the ${isLab ? 'tests' : 'medicines'}.`}
                      {i === 2 && `${request.patientName} accepts the amount in the Healio patient app.`}
                      {i === 0 && 'Waiting for the provider to open it.'}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Invoice, once the provider has priced it */}
        {!!invoice && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Invoice {invoice.number}</Text>
            {invoice.items.map((it, i) => (
              <View key={`${it.label}-${i}`} style={styles.row}>
                <Text style={styles.rowLabel} numberOfLines={2}>{it.label}</Text>
                <Text style={styles.rowValue}>₹{it.amount}</Text>
              </View>
            ))}
            {invoice.gst > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>GST</Text>
                <Text style={styles.rowValue}>₹{invoice.gst}</Text>
              </View>
            )}
            {!!invoice.fee && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{invoice.fee.label}</Text>
                <Text style={styles.rowValue}>₹{invoice.fee.amount}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.totalLabel}>Final amount</Text>
              <Text style={styles.totalValue}>₹{invoice.total}</Text>
            </View>
            <Text style={styles.note}>
              {request.status === STATUS.CONFIRMED
                ? 'Accepted and paid by the patient.'
                : 'The patient reviews and accepts this amount — the order is confirmed and paid only then.'}
            </Text>
          </View>
        )}

        {/* What was sent */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Patient</Text>
            <Text style={styles.rowValue}>{request.patientName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{isLab ? 'Lab' : 'Pharmacy'}</Text>
            <Text style={styles.rowValue}>{request.providerName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{isLab ? 'Collection' : 'Fulfilment'}</Text>
            <Text style={styles.rowValue}>{request.fulfilmentLabel}</Text>
          </View>
          {!!request.address && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Address</Text>
              <Text style={styles.rowValue} numberOfLines={3}>{request.address}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{isLab ? 'Appointment' : 'Slot'}</Text>
            <Text style={styles.rowValue}>{request.slot}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Attached</Text>
            <Text style={styles.rowValue}>
              {request.attachments?.length
                ? `${request.attachments.length} file${request.attachments.length > 1 ? 's' : ''}`
                : 'None'}
            </Text>
          </View>
          {!!request.notes && <Text style={styles.notes}>{request.notes}</Text>}
        </View>

        {request.status === STATUS.AWAITING_REVIEW && (
          <TouchableOpacity style={styles.withdrawBtn} onPress={withdraw}>
            <Text style={styles.withdrawText}>Withdraw request</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <CustomButton title="Done" onPress={() => navigation.popToTop()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  empty: { textAlign: 'center', marginTop: 60, color: COLORS.textSecondary },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.primarySoft, borderRadius: 16, padding: 16, marginTop: 20,
  },
  bannerClosed: { backgroundColor: COLORS.dangerSoft },
  bannerIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerIconClosed: { backgroundColor: COLORS.error },
  bannerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  bannerMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },

  card: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, padding: 16, marginTop: 14,
  },
  cardTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.text, marginBottom: 10 },

  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 20 },
  stepDot: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    borderColor: COLORS.border, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepDotActive: { backgroundColor: COLORS.white, borderColor: COLORS.primary },
  stepLine: { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 2 },
  stepLineOn: { backgroundColor: COLORS.primary },
  stepText: { flex: 1, paddingBottom: 16 },
  stepLabel: { fontSize: 13.5, fontWeight: '600', color: COLORS.textSecondary },
  stepLabelOn: { color: COLORS.text, fontWeight: '700' },
  stepHint: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3, lineHeight: 16 },

  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 5 },
  rowLabel: { fontSize: 12.5, color: COLORS.textSecondary, flex: 1 },
  rowValue: { fontSize: 12.5, fontWeight: '700', color: COLORS.text, flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalLabel: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
  totalValue: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  note: { fontSize: 11, color: COLORS.textSecondary, marginTop: 10, lineHeight: 16 },
  notes: { fontSize: 12.5, color: COLORS.text, lineHeight: 18, marginTop: 8 },

  withdrawBtn: { alignItems: 'center', paddingVertical: 16 },
  withdrawText: { fontSize: 13, fontWeight: '700', color: COLORS.error },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
