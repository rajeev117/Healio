// One order, from accepted quote to published report.
//
// The stepper's coarse position comes from lab_orders.status; the finer steps
// order_status can't express ("sample collected" is still `processing`) come
// from services/stages.js. See that file for why.
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { uploadRecordImage } from '../../../lib/uploads';
import AppBar from '../components/AppBar';
import StatusStepper from '../components/StatusStepper';
import { fetchOrder, getStages, resolveStage, advanceStage, publishReport } from '../services/api';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const when = (ts) => (ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

const FLOW = ['quoted', 'accepted', 'collected', 'processing', 'ready', 'shared'];

const NEXT = {
  to_price:   { stage: 'quoted',     label: 'Mark quote sent' },
  quoted:     { stage: 'accepted',   label: 'Mark quote accepted' },
  accepted:   { stage: 'collected',  label: 'Sample collected' },
  collected:  { stage: 'processing', label: 'Start processing' },
  processing: { stage: 'ready',      label: 'Report ready' },
  ready:      { stage: 'shared',     label: 'Publish report' },
};

const STEP_META = {
  quoted:     'Quote sent to the patient',
  accepted:   'Patient accepted the amount',
  collected:  'Sample taken at the counter',
  processing: 'Running in the lab',
  ready:      'Report signed and ready',
  shared:     'Sent to the patient’s records',
};

const STEP_LABEL = {
  quoted: 'Quote sent',
  accepted: 'Quote accepted',
  collected: 'Sample collected',
  processing: 'Processing in lab',
  ready: 'Report ready',
  shared: 'Shared with patient',
};

export default function SampleReport({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { orderId } = route.params || {};
  const [order, setOrder]   = useState(null);
  const [stage, setStage]   = useState('to_price');
  const [report, setReport] = useState(null);   // freshly picked file, pre-upload
  const [busy, setBusy]     = useState(false);
  const [loading, setLoading] = useState(true);
  const [shareWithPatient, setShare] = useState(true);

  const load = useCallback(async () => {
    try {
      const [o, stages] = await Promise.all([fetchOrder(orderId), getStages()]);
      setOrder(o);
      setStage(resolveStage(o, stages[o.id]));
    } catch (e) {
      Alert.alert('Could not load order', e.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickReport = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow photo access to attach the report.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!res.canceled && res.assets?.length) setReport(res.assets[0]);
  };

  const advance = async () => {
    const next = NEXT[stage];
    if (!next) return;

    if (next.stage === 'shared' && !report && !order?.report_url) {
      Alert.alert('Report needed', 'Attach the signed report before publishing it.');
      return;
    }

    setBusy(true);
    try {
      if (next.stage === 'shared') {
        let url = order?.report_url || null;
        if (report) url = await uploadRecordImage(report.uri, order.patient_id);
        const res = await publishReport({ orderId, reportUrl: url, shareWithPatient });
        if (res.denied) return denied();
        Alert.alert('Report published', shareWithPatient
          ? 'The patient can see it in their records now.'
          : 'Saved on the order.');
      } else {
        const res = await advanceStage({ orderId, stage: next.stage });
        if (res.denied) return denied();
      }
      setReport(null);
      await load();
    } catch (e) {
      Alert.alert('Could not update', e.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const denied = () => {
    Alert.alert(
      'Not saved to the server',
      'The database still needs migration-050 applied before this lab can write orders. Nothing was lost — try again once it is.',
    );
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
    meta: i === doneIdx ? STEP_META[key] : i < doneIdx ? STEP_META[key] : `Pending`,
    state: i < doneIdx ? 'done' : i === doneIdx ? 'now' : 'next',
  }));

  const next = NEXT[stage];
  const tests = Array.isArray(order?.tests) ? order.tests : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar
        title={order?.order_id || 'Lab order'}
        subtitle={`${order?.patientName || '—'} · ${inr(order?.total)}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.caption}>SAMPLE JOURNEY</Text>
        <View style={styles.card}>
          <StatusStepper steps={steps} />
        </View>

        <Text style={[styles.caption, { marginTop: SPACING.l }]}>TESTS IN THIS ORDER</Text>
        <View style={styles.card}>
          {tests.length === 0 ? (
            <Text style={styles.emptyLine}>No tests priced on this order.</Text>
          ) : tests.map((t, i) => (
            <View key={`${t.name}-${i}`} style={[styles.testRow, i > 0 && styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.testName}>{t.name}</Text>
                {!!t.turnaround && <Text style={styles.testMeta}>Report in {t.turnaround}</Text>}
              </View>
              <Text style={styles.testPrice}>{inr(t.price)}</Text>
            </View>
          ))}
          {order?.collection_type === 'home' && (
            <View style={[styles.testRow, styles.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.testName}>Home collection</Text>
                <Text style={styles.testMeta} numberOfLines={2}>
                  {order.collection_address || '—'} · {order.scheduled_time}
                </Text>
              </View>
              <Text style={styles.testPrice}>{inr(order.home_visit_fee)}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.caption, { marginTop: SPACING.l }]}>REPORT</Text>
        {order?.report_url ? (
          <TouchableOpacity style={styles.attached} onPress={() => Linking.openURL(order.report_url)}>
            <View style={styles.attachedIcon}><Ionicons name="document-text" size={18} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attachedName}>Report attached</Text>
              <Text style={styles.attachedMeta}>Tap to open · uploaded {when(order.updated_at)}</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ) : report ? (
          <View style={styles.attached}>
            <View style={styles.attachedIcon}><Ionicons name="image" size={18} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.attachedName} numberOfLines={1}>{report.fileName || 'Report image'}</Text>
              <Text style={styles.attachedMeta}>Ready to publish</Text>
            </View>
            <TouchableOpacity onPress={() => setReport(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={COLORS.borderStrong} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.upload} onPress={pickReport}>
            <Ionicons name="cloud-upload-outline" size={22} color={COLORS.primary} />
            <Text style={styles.uploadTitle}>Upload signed report</Text>
            <Text style={styles.uploadSub}>Goes straight into the patient's records</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.shareRow} onPress={() => setShare(v => !v)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={styles.shareTitle}>Send to the patient's app</Text>
            <Text style={styles.shareSub}>They get it in Records the moment you publish</Text>
          </View>
          <View style={[styles.track, shareWithPatient && styles.trackOn]}>
            <View style={[styles.knob, shareWithPatient ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
          </View>
        </TouchableOpacity>
      </ScrollView>

      {!!next && (
        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity style={[styles.cta, busy && styles.ctaDisabled]} onPress={advance} disabled={busy}>
            {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.ctaText}>{next.label}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: COLORS.surface },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  caption: { fontSize: 9.5, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1.4, marginBottom: 10 },
  card: { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  emptyLine: { fontSize: 12.5, color: COLORS.textSecondary },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  divider: { borderTopWidth: 1, borderTopColor: '#f4ebe8' },
  testName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  testMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  testPrice: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary },

  upload: {
    alignItems: 'center', gap: 6, paddingVertical: 22, paddingHorizontal: 16,
    borderWidth: 1.4, borderColor: COLORS.borderStrong, borderStyle: 'dashed', borderRadius: 18,
  },
  uploadTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
  uploadSub: { fontSize: 11, color: COLORS.textSecondary },
  attached: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12,
  },
  attachedIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  attachedName: { fontSize: 12.5, fontWeight: '700', color: COLORS.text },
  attachedMeta: { fontSize: 10.5, color: COLORS.textSecondary, marginTop: 2 },

  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12,
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, borderWidth: 1, borderColor: COLORS.border, padding: 14,
  },
  shareTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  shareSub: { fontSize: 10.5, color: COLORS.textSecondary, marginTop: 3 },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center', backgroundColor: '#dcdce2' },
  trackOn: { backgroundColor: COLORS.success },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white },

  footer: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 20, paddingTop: 14,
  },
  cta: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
