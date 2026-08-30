// Price a patient's tests and send them the quote.
//
// Reached two ways: from a walk-in scan (ScanWalkIn passes the patient's
// identity) or from a check-in card on Home. Writes one lab_orders row —
// tests[] and total — which is what the patient's Order Tracking then reads.
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
import { saveQuote, markCheckinHandled, saveDraft, calcAge } from '../services/api';
import { listTests, toOrderLine } from '../services/catalog';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const HOME_FEE = 150;
const SLOTS = ['Walk-in now', 'Today 4–6 pm', 'Tomorrow 8–10 am'];

export default function TestRequestQuote({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hospitalId: orgId } = user || {};
  // A check-in card passes `patientAge`; a QR scan passes `dateOfBirth` instead.
  const { patientId, patientName, gender, phone, dateOfBirth, checkinId } = route.params || {};
  const patientAge = route.params?.patientAge ?? calcAge(dateOfBirth);

  const [lines, setLines]     = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [picker, setPicker]   = useState(false);
  const [homeCollection, setHome] = useState(false);
  const [address, setAddress] = useState('');
  const [slot, setSlot]       = useState(SLOTS[0]);
  const [saving, setSaving]   = useState(false);
  const [denied, setDenied]   = useState(false);

  useEffect(() => { listTests().then(setCatalog).catch(() => setCatalog([])); }, []);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.price) || 0), 0),
    [lines],
  );
  const fee = homeCollection ? HOME_FEE : 0;
  const total = subtotal + fee;

  const addTest = useCallback((t) => {
    setLines((prev) => prev.some((l) => l.code === t.code && l.name === t.name)
      ? prev
      : [...prev, toOrderLine(t)]);
  }, []);

  const removeLine = (i) => setLines((prev) => prev.filter((_, idx) => idx !== i));

  const setPrice = (i, value) => setLines((prev) =>
    prev.map((l, idx) => (idx === i ? { ...l, price: value.replace(/[^0-9]/g, '') } : l)));

  const send = useCallback(async () => {
    if (lines.length === 0) {
      Alert.alert('Nothing to quote', 'Add at least one test before sending the quote.');
      return;
    }
    if (homeCollection && !address.trim()) {
      Alert.alert('Address needed', 'Home collection needs the address to send the phlebotomist to.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        orgId,
        patientId,
        tests: lines.map((l) => ({ ...l, price: Number(l.price) || 0 })),
        total,
        homeCollection,
        collectionAddress: address.trim() || null,
        slotLabel: homeCollection ? slot : 'Walk-in',
        homeVisitFee: fee,
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
      navigation.replace('SampleReport', { orderId: res.data.id });
    } catch (e) {
      Alert.alert('Could not send quote', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [lines, homeCollection, address, slot, total, fee, orgId, patientId, patientName, checkinId, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar
        title="Test request"
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

          {/* Patient */}
          <View style={styles.patientCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(patientName)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{patientName || 'Walk-in patient'}</Text>
              <Text style={styles.patientMeta}>
                {[patientAge ? `${patientAge} yrs` : null, gender, phone].filter(Boolean).join(' · ') || 'Identity from QR scan'}
              </Text>
            </View>
          </View>

          <Text style={styles.caption}>PRESCRIPTION</Text>
          <RxPreview patientId={patientId} />

          {/* Tests */}
          <View style={styles.captionRow}>
            <Text style={styles.caption}>PRICE THE TESTS</Text>
            <TouchableOpacity onPress={() => setPicker(true)}>
              <Text style={styles.link}>From my catalog</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            {lines.length === 0 ? (
              <Text style={styles.emptyLine}>No tests added yet.</Text>
            ) : lines.map((l, i) => (
              <View key={`${l.code || l.name}-${i}`} style={[styles.line, i > 0 && styles.lineDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{l.name}</Text>
                  {!!l.turnaround && <Text style={styles.lineMeta}>Report in {l.turnaround}</Text>}
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.rupee}>₹</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={String(l.price ?? '')}
                    onChangeText={(v) => setPrice(i, v)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={COLORS.borderStrong}
                  />
                </View>
                <TouchableOpacity onPress={() => removeLine(i)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={COLORS.borderStrong} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.addBtn} onPress={() => setPicker(true)}>
            <Ionicons name="add" size={16} color={COLORS.primary} />
            <Text style={styles.addBtnText}>Add another test</Text>
          </TouchableOpacity>

          {/* Home collection */}
          <Text style={[styles.caption, { marginTop: SPACING.l }]}>HOW THE SAMPLE IS COLLECTED</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.toggleRow} onPress={() => setHome(v => !v)} activeOpacity={0.7}>
              <View style={styles.toggleIcon}><Ionicons name="home-outline" size={18} color={COLORS.tintTealInk} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Home sample collection</Text>
                <Text style={styles.toggleSub}>{inr(HOME_FEE)} · a phlebotomist goes to them</Text>
              </View>
              <View style={[styles.track, homeCollection && styles.trackOn]}>
                <View style={[styles.knob, homeCollection ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
              </View>
            </TouchableOpacity>

            {homeCollection && (
              <View style={styles.homeExtra}>
                <TextInput
                  style={styles.addressInput}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Collection address"
                  placeholderTextColor={COLORS.borderStrong}
                  multiline
                />
                <View style={styles.slotRow}>
                  {SLOTS.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.slot, slot === s && styles.slotOn]}
                      onPress={() => setSlot(s)}
                    >
                      <Text style={[styles.slotText, slot === s && styles.slotTextOn]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Totals */}
          <View style={[styles.card, { marginTop: SPACING.l, padding: 16 }]}>
            <SummaryRow label={`Tests (${lines.length})`} value={inr(subtotal)} />
            {homeCollection && <SummaryRow label="Home collection" value={inr(fee)} />}
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Patient pays</Text>
              <Text style={styles.totalValue}>{inr(total)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity
            style={[styles.cta, (saving || lines.length === 0) && styles.ctaDisabled]}
            onPress={send}
            disabled={saving || lines.length === 0}
          >
            {saving
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.ctaText}>Send quote · {inr(total)}</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Catalog picker */}
      <Modal visible={picker} animationType="slide" transparent onRequestClose={() => setPicker(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add from catalog</Text>
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {catalog.filter(t => t.is_live).map(t => {
                const added = lines.some(l => l.name === t.name);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={styles.sheetRow}
                    onPress={() => addTest(t)}
                    disabled={added}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetName, added && { color: COLORS.borderStrong }]}>{t.name}</Text>
                      <Text style={styles.sheetMeta}>{t.code} · {t.turnaround_hours} hrs</Text>
                    </View>
                    <Text style={[styles.sheetPrice, added && { color: COLORS.borderStrong }]}>{inr(t.price)}</Text>
                    <Ionicons
                      name={added ? 'checkmark-circle' : 'add-circle-outline'}
                      size={20}
                      color={added ? COLORS.success : COLORS.primary}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.sheetDone} onPress={() => setPicker(false)}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  lineDivider: { borderTopWidth: 1, borderTopColor: '#f4ebe8' },
  lineName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  lineMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  priceBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.2, borderColor: COLORS.borderStrong, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 8 : 2, minWidth: 82,
  },
  rupee: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  priceInput: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.primary, paddingVertical: 0, textAlign: 'right' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.4, borderColor: COLORS.borderStrong, borderStyle: 'dashed',
    borderRadius: 16, paddingVertical: 14, marginTop: 10,
  },
  addBtnText: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  toggleIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.tintTeal, justifyContent: 'center', alignItems: 'center' },
  toggleTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  toggleSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center', backgroundColor: '#dcdce2' },
  trackOn: { backgroundColor: COLORS.success },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white },

  homeExtra: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
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
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f4ebe8' },
  sheetName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  sheetMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  sheetPrice: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary },
  sheetDone: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: SPACING.m },
  sheetDoneText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
