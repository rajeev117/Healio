import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../constants/theme';
import { fetchDoctorAppointments, journeyStatus } from '../services/doctorData';
import { useLanguage } from '../../../context/LanguageContext';

// Values stay English (drive filtering); labels translate via TAB_KEYS.
const TABS = ['Today', 'Upcoming', 'Past'];
const TAB_KEYS = { Today: 'tab_today', Upcoming: 'tab_upcoming', Past: 'tab_past' };

export default function Appointments({ navigation }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('Today');
  const [appointments, setAppointments] = useState([]);

  const load = useCallback(async () => {
    setAppointments(await fetchDoctorAppointments());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = appointments.filter(a => {
    if (activeTab === 'Today') return a.isToday;
    if (activeTab === 'Upcoming') return !a.isToday && !a.isPast;
    return a.isPast;
  });

  const todayCount = appointments.filter(a => a.isToday).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('doc_appointments_title')}</Text>
        <Text style={styles.headerSub}>{t('doc_patients_today', { count: todayCount })}</Text>
        <View style={styles.tabs}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{t(TAB_KEYS[tab])}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>{t('doc_no_appointments')}</Text>
          </View>
        ) : (
          filtered.map(apt => (
            <TouchableOpacity
              key={apt.id}
              style={styles.card}
              onPress={() => navigation.navigate('AppointmentDetail', { appointment: apt })}
            >
              <View style={styles.cardTop}>
                <View style={styles.patientAvatar}>
                  <Text style={styles.avatarText}>
                    {apt.patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{apt.patientName}</Text>
                  <Text style={styles.cardMeta}>
                    {apt.patientAge}{apt.patientAge !== '—' ? ` ${t('yrs')}` : ''} · {apt.patientGender}
                  </Text>
                  <Text style={styles.cardReason}>{apt.reason}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Text style={styles.cardTime}>{apt.time}</Text>
                  <StatusBadge status={apt.rawStatus || apt.status} />
                </View>
              </View>
              <View style={styles.cardBottom}>
                <View style={styles.cardTag}>
                  <Ionicons
                    name={apt.type === 'Video' ? 'videocam-outline' : 'person-outline'}
                    size={12}
                    color={apt.type === 'Video' ? '#3182CE' : COLORS.primary}
                  />
                  <Text style={[styles.cardTagText, apt.type === 'Video' && { color: '#3182CE' }]}>
                    {apt.type === 'Video' ? t('type_video') : t('type_inperson')}
                  </Text>
                </View>
                <View style={styles.cardTag}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.cardTagText}>{apt.date}</Text>
                </View>
                {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigation.navigate('AppointmentDetail', { appointment: apt })}
                  >
                    <Text style={styles.actionBtnText}>{t('doc_manage')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Patient journey: Arrived → Checked In → Completed (see doctorData.journeyStatus).
const StatusBadge = ({ status }) => {
  const { t } = useLanguage();
  const c = journeyStatus(status);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{t(c.labelKey)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4, marginBottom: SPACING.m },
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  activeTab: { backgroundColor: COLORS.white },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  activeTabText: { color: COLORS.primary },
  list: { flex: 1, backgroundColor: COLORS.surface, padding: 16 },
  empty: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '500' },
  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  patientAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardTime: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10,
  },
  cardTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  cardTagText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  actionBtn: {
    marginLeft: 'auto', backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 10,
  },
  actionBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
});
