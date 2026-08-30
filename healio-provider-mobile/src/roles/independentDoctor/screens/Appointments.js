import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';
import { fetchDoctorAppointments, setAppointmentStatus } from '../services/doctorData';

// A solo doctor has no front desk, so 'Requests' leads: those are the bookings
// waiting on them personally to accept. The hospital module has no such tab —
// there the front desk confirms before the doctor ever sees the appointment.
const TABS = ['requests', 'today', 'upcoming', 'past'];

const TAB_LABEL_KEY = {
  requests: 'idoc_tab_requests',
  today:    'idoc_tab_today',
  upcoming: 'idoc_tab_upcoming',
  past:     'idoc_tab_past',
};

export default function Appointments({ navigation }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('requests');
  const [appointments, setAppointments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      setAppointments(await fetchDoctorAppointments());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pendingList = appointments.filter(a => a.status === 'pending' && !a.isPast);

  const filtered = appointments.filter(a => {
    if (activeTab === 'requests') return a.status === 'pending' && !a.isPast;
    if (activeTab === 'today')    return a.isToday && a.status !== 'pending';
    if (activeTab === 'upcoming') return !a.isToday && !a.isPast && a.status !== 'pending';
    return a.isPast;
  });

  const accept = async (apt) => {
    setBusyId(apt.id);
    const ok = await setAppointmentStatus(apt.id, 'confirmed');
    setBusyId(null);
    if (ok) load();
    else Alert.alert(t('idoc_update_failed'), t('idoc_update_failed_msg'));
  };

  const decline = (apt) => {
    Alert.alert(t('idoc_decline_title'), t('idoc_decline_msg', { name: apt.patientName }), [
      { text: t('idoc_no'), style: 'cancel' },
      {
        text: t('idoc_decline'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(apt.id);
          const ok = await setAppointmentStatus(apt.id, 'cancelled');
          setBusyId(null);
          if (ok) load();
          else Alert.alert(t('idoc_update_failed'), t('idoc_update_failed_msg'));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.ring} pointerEvents="none" />
        <Text style={styles.headerTitle}>{t('idoc_appointments')}</Text>
        <Text style={styles.headerSub}>
          {pendingList.length > 0
            ? t('idoc_awaiting_you', { n: pendingList.length })
            : t('idoc_patients_today', { n: appointments.filter(a => a.isToday).length })}
        </Text>
        <View style={styles.tabs}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]} numberOfLines={1}>
                {t(TAB_LABEL_KEY[tab])}
              </Text>
              {tab === 'requests' && pendingList.length > 0 && (
                <View style={styles.tabDot} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={44} color={COLORS.borderStrong} />
            <Text style={styles.emptyText}>
              {activeTab === 'requests' ? t('idoc_no_requests') : t('idoc_no_appointments')}
            </Text>
          </View>
        ) : filtered.map(apt => (
          <View key={apt.id} style={[styles.card, { borderLeftColor: railFor(apt.status) }]}>
            <TouchableOpacity
              style={styles.cardTop}
              onPress={() => navigation.navigate('AppointmentDetail', { appointment: apt })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(apt.patientName || '?').split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{apt.patientName}</Text>
                <Text style={styles.cardMeta}>
                  {apt.patientAge}{apt.patientAge !== '—' ? ` ${t('idoc_yrs')}` : ''} · {apt.patientGender}
                </Text>
                <Text style={styles.cardReason}>{apt.reason}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.cardTime}>{apt.time}</Text>
                <StatusBadge status={apt.status} t={t} />
              </View>
            </TouchableOpacity>

            <View style={styles.cardBottom}>
              <View style={styles.tag}>
                <Ionicons
                  name={apt.type === 'Video' ? 'videocam-outline' : 'person-outline'}
                  size={12}
                  color={apt.type === 'Video' ? COLORS.tintBlueInk : COLORS.primary}
                />
                <Text style={[styles.tagText, apt.type === 'Video' && { color: COLORS.tintBlueInk }]}>
                  {apt.type === 'Video' ? t('idoc_video') : t('idoc_in_person')}
                </Text>
              </View>
              <View style={styles.tag}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
                <Text style={styles.tagText}>{apt.date}</Text>
              </View>

              {apt.status === 'pending' ? (
                <View style={styles.decideRow}>
                  <TouchableOpacity
                    style={[styles.declineBtn, busyId === apt.id && { opacity: 0.5 }]}
                    onPress={() => decline(apt)}
                    disabled={busyId === apt.id}
                  >
                    <Text style={styles.declineText}>{t('idoc_decline')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptBtn, busyId === apt.id && { opacity: 0.5 }]}
                    onPress={() => accept(apt)}
                    disabled={busyId === apt.id}
                  >
                    <Text style={styles.acceptText}>{t('idoc_accept')}</Text>
                  </TouchableOpacity>
                </View>
              ) : apt.status !== 'completed' && apt.status !== 'cancelled' ? (
                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={() => navigation.navigate('AppointmentDetail', { appointment: apt })}
                >
                  <Text style={styles.manageText}>{t('idoc_manage')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const railFor = (status) => (
  status === 'completed' ? COLORS.success
    : status === 'cancelled' ? COLORS.error
      : status === 'pending' ? COLORS.warning
        : COLORS.tintBlueInk
);

const StatusBadge = ({ status, t }) => {
  const config = {
    pending:   { bg: COLORS.warningSoft, color: '#b45309',            key: 'idoc_status_pending' },
    confirmed: { bg: COLORS.successSoft, color: COLORS.success,       key: 'idoc_status_confirmed' },
    completed: { bg: COLORS.mutedSoft,   color: COLORS.textSecondary, key: 'idoc_status_completed' },
    cancelled: { bg: COLORS.dangerSoft,  color: COLORS.error,         key: 'idoc_status_cancelled' },
  };
  const c = config[status] || config.confirmed;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{t(c.key)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.headerRadiusLeft,
    borderBottomRightRadius: SIZES.headerRadiusRight,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute', top: -84, right: -56,
    width: 178, height: 178, borderRadius: 89,
    borderWidth: 28, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { fontSize: 25, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  headerSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginBottom: SPACING.m },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  activeTab: { backgroundColor: COLORS.white },
  tabText: { fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.72)' },
  activeTabText: { color: COLORS.primary },
  tabDot: {
    position: 'absolute', top: 5, right: 8,
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffb020',
  },

  list: { flex: 1, backgroundColor: COLORS.surface, padding: 16 },
  empty: { alignItems: 'center', marginTop: 70, gap: 12 },
  emptyText: { fontSize: 14.5, color: COLORS.textSecondary, fontWeight: '500' },

  card: {
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 15, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary },
  cardName: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
  cardMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  cardReason: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
  cardTime: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 10.5, fontWeight: '800' },

  cardBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10,
  },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surface, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
  },
  tagText: { fontSize: 10.5, fontWeight: '700', color: COLORS.textSecondary },

  decideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  declineBtn: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 10,
    backgroundColor: COLORS.dangerSoft, borderWidth: 1, borderColor: '#f3c9c9',
  },
  declineText: { fontSize: 11.5, fontWeight: '800', color: COLORS.error },
  acceptBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10, backgroundColor: COLORS.success },
  acceptText: { fontSize: 11.5, fontWeight: '800', color: COLORS.white },

  manageBtn: {
    marginLeft: 'auto', backgroundColor: COLORS.primary,
    paddingHorizontal: 15, paddingVertical: 7, borderRadius: 10,
  },
  manageText: { color: COLORS.white, fontSize: 11.5, fontWeight: '800' },
});
