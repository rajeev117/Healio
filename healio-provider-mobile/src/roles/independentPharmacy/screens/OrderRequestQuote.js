// Price a patient's prescription and send the quote.
//
// Reached from a walk-in scan or a check-in card on Home. Writes one
// pharmacy_orders row — items[] and total — which the patient's Order Tracking
// then reads.
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import AppBar from '../components/AppBar';
import RxPreview from '../components/RxPreview';
import QtyStepper from '../components/QtyStepper';
import { saveQuote, markCheckinHandled, saveDraft, quoteTotals, calcAge } from '../services/api';
import { listStock, toOrderLine, isOut, isLow } from '../services/inventory';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const DELIVERY_FEE = 40;
const SLOTS = ['Within 30 min', 'Today 6–8 pm', 'Tomorrow morning'];

export default function OrderRequestQuote({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hospitalId: orgId } = user || {};
  // A check-in card passes `patientAge`; a QR scan passes `dateOfBirth` instead.
  const { patientId, patientName, gender, phone, dateOfBirth, checkinId } = route.params || {};
  const patientAge = route.params?.patientAge ?? calcAge(dateOfBirth);

  const [lines, setLines]   = useState([]);
  const [stock, setStock]   = useState([]);
  const [picker, setPicker] = useState(false);
  const [query, setQuery]   = useState('');
  const [delivery, setDelivery] = useState(true);
  const [address, setAddress]   = useState('');
  const [slot, setSlot]         = useState(SLOTS[0]);
  const [saving, setSaving]     = useState(false);
  const [denied, setDenied]     = useState(false);

  useEffect(() => { listStock().then(setStock).catch(() => setStock([])); }, []);

  const totals = useMemo(
    () => quoteTotals(lines, delivery ? DELIVERY_FEE : 0),
    [lines, delivery],
  );

  const addItem = useCallback((item) => {
    setLines((prev) => {
      const at = prev.findIndex((l) => l.sku === item.sku && l.name === item.name);
      if (at >= 0) {
        const next = [...prev];
        next[at] = { ...next[at], quantity: next[at].quantity + 1 };
        return next;
      }
      // Out of stock → carry the substitution note the counter has to resolve.
      const line = toOrderLine(item, 1);
      return [...prev, isOut(item) ? { ...line, substituted_for: item.name, outOfStock: true } : line];
    });
  }, []);

  const setQty = (i, q) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, quantity: q } : l)));
  const removeLine = (i) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const send = useCallback(async () => {
    if (lines.length === 0) {
      Alert.alert('Nothing to quote', 'Add at least one medicine before sending the quote.');
      return;
    }
    if (delivery && !address.trim()) {
      Alert.alert('Address needed', 'Delivery needs the address to send the order to.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        orgId,
        patientId,
        items: lines.map(({ outOfStock, ...l }) => l),
        total: totals.total,
        delivery,
        deliveryAddress: address.trim() || null,
        deliverySlot: delivery ? slot : 'Counter pickup',
        deliveryFee: delivery ? DELIVERY_FEE : 0,
      };
      const res = await saveQuote(payload);

      if (res.denied) {
        setDenied(true);
        await saveDraft({ ...payload, patientName, kind: 'quote' });
        Alert.alert(
          'Saved on this device',
          "The quote couldn't be written to the server yet — the database still needs migration-050 applied. It is safe here and can be re-sent afterwards.",
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
        return;
      }

      if (checkinId) { try { await markCheckinHandled(checkinId); } catch (_) {} }
      navigation.replace('Fulfilment', { orderId: res.data.id });
    } catch (e) {
      Alert.alert('Could not send quote', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [lines, delivery, address, slot, totals, orgId, patientId, patientName, checkinId, navigation]);

  const results = stock.filter((i) => {
    const q = query.trim().toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || String(i.sku || '').toLowerCase().includes(q);
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar
        title="Order request"
        subtitle={[patientName, patientAge ? `${patientAge} yrs` : null, gender].filter(Boolean).join(' · ')}
        actionLabel="Decline"
        onAction={() => navigation.goBack()}
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
          {denied && (
            <View style={styles.banner}>
              <Ionicons name="cloud-offline-outline" size={16} color="#7c4a03" />
              <Text style={styles.bannerText}>Saved on this device — sync pending</Text>
            </View>
          )}

          <View style={styles.patientCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(patientName)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{patientName || 'Walk-in patient'}</Text>
              <Text style={styles.patientMeta}>
                {[patientAge ? `${patientAge} yrs` : null, gender, phone].filter(Boolean).join(' · ') || 'Identity from QR scan'}
              </Text>
            </View>
          </View>

          <Text style={styles.caption}>PRESCRIPTION</Text>
          <RxPreview patientId={patientId} />

          <View style={styles.captionRow}>
            <Text style={styles.caption}>PRICE THE MEDICINES</Text>
            <TouchableOpacity onPress={() => setPicker(true)}>
              <Text style={styles.link}>From my stock</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {lines.length === 0 ? (
              <Text style={styles.emptyLine}>No medicines added yet.</Text>
            ) : lines.map((l, i) => (
              <View key={`${l.sku || l.name}-${i}`} style={[styles.lineWrap, i > 0 && styles.lineDivider]}>
                <View style={styles.line}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.lineName} numberOfLines={1}>{l.name}</Text>
                      <View style={[styles.stockPill, l.outOfStock ? styles.stockPillWarn : styles.stockPillOk]}>
                        <Text style={[styles.stockPillText, { color: l.outOfStock ? '#b45309' : COLORS.success }]}>
                          {l.outOfStock ? 'SWAP' : 'IN STOCK'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.lineMeta}>
                      {[l.brand, l.pack].filter(Boolean).join(' · ')} · {inr(l.unit_price)} each
                    </Text>
                  </View>
                  <QtyStepper value={l.quantity} onChange={(q) => setQty(i, q)} />
                  <Text style={styles.linePrice}>{inr((l.unit_price || 0) * (l.quantity || 0))}</Text>
                  <TouchableOpacity onPress={() => removeLine(i)} hitSlop={8}>
                    <Ionicons name="close" size={16} color={COLORS.borderStrong} />
                  </TouchableOpacity>
                </View>

                {l.outOfStock && (
                  <View style={styles.subRow}>
                    <Text style={styles.subText}>Out of stock — confirm a substitute with the patient</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={() => setPicker(true)}>
            <Ionicons name="add" size={16} color={COLORS.primary} />
            <Text style={styles.addBtnText}>Add an over-the-counter item</Text>
          </TouchableOpacity>

          {/* Delivery vs pickup */}
          <Text style={[styles.caption, { marginTop: SPACING.l }]}>HOW THE PATIENT GETS IT</Text>
          <View style={styles.segments}>
            <TouchableOpacity style={[styles.segment, delivery && styles.segmentOn]} onPress={() => setDelivery(true)}>
              <Text style={[styles.segmentText, delivery && styles.segmentTextOn]}>Deliver · {inr(DELIVERY_FEE)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.segment, !delivery && styles.segmentOn]} onPress={() => setDelivery(false)}>
              <Text style={[styles.segmentText, !delivery && styles.segmentTextOn]}>Pickup at counter</Text>
            </TouchableOpacity>
          </View>

          {delivery && (
            <View style={[styles.card, { padding: 14, gap: 10, marginTop: 10 }]}>
              <TextInput
                style={styles.addressInput}
                value={address}
                onChangeText={setAddress}
                placeholder="Delivery address"
                placeholderTextColor={COLORS.borderStrong}
                multiline
              />
              <View style={styles.slotRow}>
                {SLOTS.map(s => (
                  <TouchableOpacity key={s} style={[styles.slot, slot === s && styles.slotOn]} onPress={() => setSlot(s)}>
                    <Text style={[styles.slotText, slot === s && styles.slotTextOn]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Totals */}
          <View style={[styles.card, { marginTop: SPACING.l, padding: 16 }]}>
            <SummaryRow label={`Medicines (${lines.length})`} value={inr(totals.subtotal)} />
            <SummaryRow label="GST (5%)" value={inr(totals.gst)} />
            {delivery && <SummaryRow label="Delivery" value={inr(totals.deliveryFee)} />}
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Patient pays</Text>
              <Text style={styles.totalValue}>{inr(totals.total)}</Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity
            style={[styles.cta, (saving || lines.length === 0) && styles.ctaDisabled]}
            onPress={send}
            disabled={saving || lines.length === 0}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.ctaText}>Send quote · {inr(totals.total)}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Stock picker */}
      <Modal visible={picker} animationType="slide" transparent onRequestClose={() => setPicker(false)}>
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add from stock</Text>
            <View style={styles.search}>
              <Ionicons name="search" size={16} color={COLORS.textSecondary} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search medicine or SKU"
                placeholderTextColor={COLORS.borderStrong}
              />
            </View>
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {results.map(item => (
                <TouchableOpacity key={item.id} style={styles.sheetRow} onPress={() => addItem(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetName}>{item.name}</Text>
                    <Text style={styles.sheetMeta}>
                      {[item.brand, item.pack].filter(Boolean).join(' · ')}
                      {isOut(item) ? ' · out of stock' : isLow(item) ? ` · only ${item.stock_qty} left` : ''}
                    </Text>
                  </View>
                  <Text style={styles.sheetPrice}>{inr(item.mrp)}</Text>
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
              {results.length === 0 && <Text style={styles.sheetEmpty}>Nothing matches "{query}"</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.sheetDone} onPress={() => setPicker(false)}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const initials = (n) => String(n || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

const SummaryRow = ({ label, value }) => (
  <View style={styles.sumRow}>
    <Text style={styles.sumLabel}>{label}</Text>
    <Text style={styles.sumValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: COLORS.surface },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fffcf2', borderWidth: 1, borderColor: '#f0e2bd',
    borderRadius: 12, padding: 11, marginBottom: 14,
  },
  bannerText: { fontSize: 11.5, fontWeight: '700', color: '#7c4a03' },

  patientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.l,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  patientName: { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  patientMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },

  caption: { fontSize: 9.5, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1.4, marginBottom: 10 },
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.l },
  link: { fontSize: 11.5, fontWeight: '700', color: COLORS.primary, marginBottom: 10 },

  card: { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, borderWidth: 1, borderColor: COLORS.border },
  emptyLine: { fontSize: 12.5, color: COLORS.textSecondary, padding: 16 },
  lineWrap: { padding: 13, gap: 9 },
  lineDivider: { borderTopWidth: 1, borderTopColor: '#f4ebe8' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  lineName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, flexShrink: 1 },
  lineMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  linePrice: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary, minWidth: 56, textAlign: 'right' },
  stockPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  stockPillOk: { backgroundColor: COLORS.successSoft },
  stockPillWarn: { backgroundColor: COLORS.warningSoft },
  stockPillText: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.4 },
  subRow: { backgroundColor: '#fffcf2', borderWidth: 1, borderColor: '#f0e2bd', borderRadius: 11, padding: 9 },
  subText: { fontSize: 10.5, fontWeight: '600', color: '#7c4a03' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.4, borderColor: COLORS.borderStrong, borderStyle: 'dashed',
    borderRadius: 16, paddingVertical: 14, marginTop: 10,
  },
  addBtnText: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },

  segments: { flexDirection: 'row', backgroundColor: '#f1eae8', borderRadius: 14, padding: 4 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  segmentOn: { backgroundColor: COLORS.white },
  segmentText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  segmentTextOn: { color: COLORS.primary },

  addressInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 12, fontSize: 13, color: COLORS.text, minHeight: 60, textAlignVertical: 'top',
  },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8 },
  slotOn: { backgroundColor: COLORS.primarySoft, borderColor: '#e8c8c0' },
  slotText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  slotTextOn: { color: COLORS.primary },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  sumLabel: { fontSize: 12.5, color: COLORS.textSecondary },
  sumValue: { fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  totalDivider: { height: 1, backgroundColor: '#f4ebe8', marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  totalValue: { fontSize: 20, fontWeight: '900', color: COLORS.primary, letterSpacing: -0.5 },

  footer: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 20, paddingTop: 14,
  },
  cta: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '85%' },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10,
    backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 11 : 3,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f4ebe8' },
  sheetName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  sheetMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  sheetPrice: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary },
  sheetEmpty: { fontSize: 12.5, color: COLORS.textSecondary, paddingVertical: 20, textAlign: 'center' },
  sheetDone: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: SPACING.m },
  sheetDoneText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
