// One order, from paid to handed over.
//
// The stepper's coarse position comes from pharmacy_orders.status; the one step
// order_status can't express ("priced, waiting on the patient" is still
// `pending`) comes from services/stages.js.
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import AppBar from '../components/AppBar';
import StatusStepper from '../components/StatusStepper';
import { fetchOrder, getStages, resolveStage, advanceStage } from '../services/api';
import { listStock, adjustStock } from '../services/inventory';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const FLOW = ['quoted', 'accepted', 'packing', 'out', 'handed_over', 'closed'];

const STEP_LABEL = {
  quoted: 'Quote sent',
  accepted: 'Patient paid',
  packing: 'Packing at counter',
  out: 'Out for delivery',
  handed_over: 'Handed over',
  closed: 'Order closed',
};

const NEXT = {
  to_quote:    { stage: 'quoted',      label: 'Mark quote sent' },
  quoted:      { stage: 'accepted',    label: 'Mark as paid' },
  accepted:    { stage: 'packing',     label: 'Start packing' },
  packing:     { stage: 'out',         label: 'Send out for delivery' },
  out:         { stage: 'handed_over', label: 'Confirm handover' },
  handed_over: { stage: 'closed',      label: 'Close order' },
};

// The handover code lives in component state only — there is no column for it.
// It is regenerated whenever this screen mounts; see the deferred list in the
// implementation plan for the durable version (order_handovers).
const makeOtp = () => String(Math.floor(1000 + Math.random() * 9000));

export default function Fulfilment({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { orderId } = route.params || {};
  const [order, setOrder] = useState(null);
  const [stage, setStage] = useState('to_quote');
  const [packed, setPacked] = useState({});
  const [stock, setStock] = useState([]);
  const [partner, setPartner] = useState('');
  const [otp] = useState(makeOtp);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [o, stages, inv] = await Promise.all([fetchOrder(orderId), getStages(), listStock()]);
      setOrder(o);
      setStage(resolveStage(o, stages[o.id]));
      setStock(inv);
      if (o.delivery_partner) setPartner(o.delivery_partner);
    } catch (e) {
      Alert.alert('Could not load order', e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const items = Array.isArray(order?.items) ? order.items : [];
  const isDelivery = !!order?.delivery_address;
  const packedCount = items.filter((_, i) => packed[i]).length;

  const batchFor = (line) => stock.find(s => s.sku === line.sku || s.name === line.name);

  const advance = async () => {
    const next = NEXT[stage];
    if (!next) return;

    if (next.stage === 'out' && packedCount < items.length) {
      Alert.alert('Not fully packed', `${items.length - packedCount} item(s) still unchecked. Pack everything before it leaves the counter.`);
      return;
    }

    setBusy(true);
    try {
      const res = await advanceStage({
        orderId,
        stage: next.stage,
        deliveryPartner: next.stage === 'out' ? (partner.trim() || null) : null,
      });
      if (res.denied) {
        Alert.alert(
          'Not saved to the server',
          'The database still needs migration-050 applied before this pharmacy can write orders. Nothing was lost — try again once it is.',
        );
        return;
      }
      // Packing is when stock actually leaves the shelf.
      if (next.stage === 'out') {
        for (const line of items) {
          const item = batchFor(line);
          if (item) await adjustStock(item.id, -(Number(line.quantity) || 0));
        }
      }
      await load();
    } catch (e) {
      Alert.alert('Could not update', e.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const doneIdx = FLOW.indexOf(stage);
  const steps = FLOW.map((key, i) => ({
    label: STEP_LABEL[key],
    meta: i === doneIdx ? 'In progress now' : i < doneIdx ? 'Done' : 'Pending',
    state: i < doneIdx ? 'done' : i === doneIdx ? 'now' : 'next',
  }));

  const next = NEXT[stage];
  const showPack = ['accepted', 'packing'].includes(stage);
  const showOtp = ['packing', 'out'].includes(stage);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar
        title={order?.order_id || 'Order'}
        subtitle={`${order?.patientName || '—'} · ${inr(order?.total)}`}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.caption}>ORDER JOURNEY</Text>
          <View style={styles.card}><StatusStepper steps={steps} /></View>

          <View style={styles.captionRow}>
            <Text style={styles.caption}>
              PACK CHECKLIST · {packedCount} OF {items.length}
            </Text>
          </View>
          <View style={styles.card}>
            {items.length === 0 ? (
              <Text style={styles.emptyLine}>No items on this order.</Text>
            ) : items.map((l, i) => {
              const item = batchFor(l);
              const on = !!packed[i];
              return (
                <TouchableOpacity
                  key={`${l.name}-${i}`}
                  style={[styles.packRow, i > 0 && styles.divider]}
                  onPress={() => showPack && setPacked(p => ({ ...p, [i]: !p[i] }))}
                  disabled={!showPack}
                  activeOpacity={0.7}
                >
                  <View style={[styles.box, on && styles.boxOn]}>
                    {on && <Ionicons name="checkmark" size={12} color={COLORS.white} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.packName, !on && !showPack && { color: COLORS.textSecondary }]}>
                      {l.name} × {l.quantity}
                    </Text>
                    <Text style={styles.packMeta}>
                      {item?.batch_no && item.batch_no !== '—'
                        ? `Batch ${item.batch_no} · exp ${item.expiry}`
                        : l.substituted_for ? 'Substituted — confirm with patient' : [l.brand, l.pack].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={styles.packPrice}>{inr((l.unit_price || 0) * (l.quantity || 0))}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {showOtp && (
            <>
              <Text style={[styles.caption, { marginTop: SPACING.l }]}>HANDOVER CODE</Text>
              <View style={styles.otpCard}>
                <Text style={styles.otpTitle}>Ask the patient to read this out</Text>
                <View style={styles.otpRow}>
                  {otp.split('').map((d, i) => (
                    <View key={i} style={styles.otpBox}><Text style={styles.otpDigit}>{d}</Text></View>
                  ))}
                </View>
                <Text style={styles.otpNote}>
                  Generated for this session only — it changes if you leave and come back.
                </Text>
              </View>
            </>
          )}

          <Text style={[styles.caption, { marginTop: SPACING.l }]}>
            {isDelivery ? 'DELIVERY' : 'COLLECTION'}
          </Text>
          <View style={[styles.card, { padding: 14, gap: 12 }]}>
            <View style={styles.deliveryRow}>
              <View style={styles.deliveryIcon}>
                <Ionicons name={isDelivery ? 'bicycle-outline' : 'storefront-outline'} size={18} color={COLORS.tintVioletInk} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.deliveryTitle}>{isDelivery ? 'Home delivery' : 'Counter pickup'}</Text>
                <Text style={styles.deliveryMeta} numberOfLines={2}>
                  {isDelivery ? `${order.delivery_address} · ${order.delivery_slot || ''}` : 'Patient collects at the counter'}
                </Text>
              </View>
            </View>

            {isDelivery && (
              <TextInput
                style={styles.partnerInput}
                value={partner}
                onChangeText={setPartner}
                placeholder="Who is delivering? (name or agency)"
                placeholderTextColor={COLORS.borderStrong}
              />
            )}
          </View>
        </ScrollView>

        {!!next && (
          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <TouchableOpacity style={[styles.cta, busy && styles.ctaDisabled]} onPress={advance} disabled={busy}>
              {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.ctaText}>{next.label}</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: COLORS.surface },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  caption: { fontSize: 9.5, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1.4, marginBottom: 10 },
  captionRow: { marginTop: SPACING.l },
  card: { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  emptyLine: { fontSize: 12.5, color: COLORS.textSecondary },
  divider: { borderTopWidth: 1, borderTopColor: '#f4ebe8' },

  packRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  box: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.6, borderColor: '#d8ccc8', justifyContent: 'center', alignItems: 'center' },
  boxOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  packName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  packMeta: { fontSize: 10.5, color: COLORS.textSecondary, marginTop: 3 },
  packPrice: { fontSize: 13, fontWeight: '800', color: COLORS.primary },

  otpCard: {
    backgroundColor: COLORS.primarySoft, borderRadius: SIZES.radiusLg,
    borderWidth: 1, borderColor: '#f0dcd7', padding: 18, alignItems: 'center', gap: 12,
  },
  otpTitle: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  otpRow: { flexDirection: 'row', gap: 10 },
  otpBox: {
    width: 56, height: 62, borderRadius: 13, backgroundColor: COLORS.white,
    borderWidth: 1.2, borderColor: '#e8c8c0', justifyContent: 'center', alignItems: 'center',
  },
  otpDigit: { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  otpNote: { fontSize: 10.5, color: '#a1736a', textAlign: 'center' },

  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deliveryIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.tintViolet, justifyContent: 'center', alignItems: 'center' },
  deliveryTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  deliveryMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  partnerInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 13, color: COLORS.text,
  },

  footer: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 20, paddingTop: 14,
  },
  cta: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
