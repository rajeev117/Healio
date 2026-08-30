import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { StatusPill } from '../components/StatusPill';
import { getJourney, buildLiveJourney, docMeta } from '../services/journey';
import { fetchPatientJourney } from '../services/api';
import { useLanguage } from '../../../context/LanguageContext';

// Journey step status → translation key.
const STATUS_LABEL_KEYS = {
  done: 'status_completed',
  current: 'rmp_in_progress',
  pending: 'status_pending',
  cancelled: 'status_cancelled',
};

const fmtWhen = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

export default function PatientJourney({ navigation, route }) {
  const { booking } = route.params;
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchPatientJourney(booking.id);
      setData(res);
    } catch (e) {
      // RPC missing / not authorised → fall back to the local booking view so
      // the screen still renders instead of erroring out.
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [booking.id]);

  // Refresh on focus, then poll while focused so a patient scanning at the
  // hospital flips this to "Arrived" / "Checked In" without any manual action.
  // (Realtime can't be used: RLS blocks an RMP from reading qr_checkins.)
  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]));

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, [load]);

  // Live timeline when the RPC answered; otherwise the local best-effort view.
  const journey = data ? buildLiveJourney(data) : getJourney(booking);
  const documents = data?.documents || [];
  const statusLabel = data
    ? ({ scheduled: 'Pending', in_progress: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' }[data.status] || booking.status)
    : booking.status;

  const openDoc = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert(t('rmp_doc_open_fail_title'), t('rmp_doc_open_fail_msg')));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={t('rmp_journey_title')} onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >

        {/* Patient summary */}
        <View style={styles.summaryCard}>
          <Avatar name={booking.patientName} size={46} />
          <View style={styles.summaryInfo}>
            <Text style={styles.summaryName}>{booking.patientName}</Text>
            <Text style={styles.summaryMeta}>{booking.providerName} · {booking.time}</Text>
            <Text style={styles.summarySub}>{booking.date}</Text>
          </View>
          <StatusPill label={statusLabel} />
        </View>

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>{t('rmp_visit_progress')}</Text>
          {loading && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>

        {/* Timeline */}
        <View style={styles.timeline}>
          {journey.map((step, i) => {
            const isLast = i === journey.length - 1;
            return (
              <View key={step.key} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.circle, circleStyle[step.status]]}>
                    <Ionicons
                      name={step.status === 'done' ? 'checkmark' : step.icon}
                      size={16}
                      color={iconColor[step.status]}
                    />
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.line,
                        { backgroundColor: step.status === 'done' ? COLORS.primary : COLORS.border },
                      ]}
                    />
                  )}
                </View>

                <View style={[styles.content, !isLast && styles.contentGap]}>
                  <Text style={styles.stepTitle}>{step.titleKey ? t(step.titleKey) : step.title}</Text>
                  {(step.placeKey || step.place) ? (
                    <Text style={styles.stepPlace}>{step.placeKey ? t(step.placeKey) : step.place}</Text>
                  ) : null}
                  {step.time && step.status === 'done' ? (
                    <Text style={styles.stepTime}>{fmtWhen(step.time)}</Text>
                  ) : (
                    <Text style={[styles.stepStatus, { color: statusColor[step.status] }]}>
                      {t(STATUS_LABEL_KEYS[step.status])}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Documents */}
        <Text style={styles.sectionTitle}>{t('rmp_documents')}</Text>
        {documents.length === 0 ? (
          <View style={styles.emptyDocs}>
            <Ionicons name="document-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.emptyDocsText}>
              {t('rmp_no_documents')}
            </Text>
          </View>
        ) : (
          documents.map((doc, i) => {
            const meta = docMeta(doc.kind);
            const label = t(meta.labelKey);
            return (
              <TouchableOpacity key={`${doc.url}-${i}`} style={styles.docCard} onPress={() => openDoc(doc.url)} activeOpacity={0.7}>
                <View style={styles.docIcon}>
                  <Ionicons name={meta.icon} size={20} color={COLORS.primary} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>{doc.title || label}</Text>
                  <Text style={styles.docMeta}>{label} · {fmtWhen(doc.date)}</Text>
                </View>
                <View style={styles.docView}>
                  <Ionicons name="eye-outline" size={15} color={COLORS.primary} />
                  <Text style={styles.docViewText}>{t('rmp_view')}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const circleStyle = {
  done: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  current: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary, borderWidth: 2 },
  pending: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  cancelled: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.dangerSoft },
};

const iconColor = {
  done: COLORS.white,
  current: COLORS.primary,
  pending: COLORS.textSecondary,
  cancelled: COLORS.error,
};

const statusColor = {
  done: COLORS.success,
  current: COLORS.primary,
  pending: COLORS.textSecondary,
  cancelled: COLORS.error,
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
  },
  summaryInfo: { flex: 1, marginLeft: 12 },
  summaryName: { fontSize: 15.5, fontWeight: '700', color: COLORS.text },
  summaryMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  summarySub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 26, marginBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 26, marginBottom: 6 },
  timeline: { marginTop: 8 },
  step: { flexDirection: 'row' },
  rail: { width: 36, alignItems: 'center' },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 2, flex: 1, marginVertical: 4, minHeight: 24 },
  content: { flex: 1, marginLeft: 14, paddingTop: 5 },
  contentGap: { paddingBottom: 22 },
  stepTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  stepPlace: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  stepStatus: { fontSize: 12, fontWeight: '600', marginTop: 5 },
  stepTime: { fontSize: 12, fontWeight: '700', color: COLORS.success, marginTop: 5 },

  emptyDocs: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, marginTop: 4,
  },
  emptyDocsText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 18 },
  docCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginTop: 10,
  },
  docIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  docMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  docView: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7,
  },
  docViewText: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
});
