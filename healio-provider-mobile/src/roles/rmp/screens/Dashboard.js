import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { Avatar } from '../components/Avatar';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { fetchRmpStats, fetchRmpEarnings, fetchRmpBookings } from '../services/api';

// Morning until noon, afternoon until 5pm, evening after — same boundaries the
// doctor and patient dashboards use.
const getGreeting = (t) => {
  const h = new Date().getHours();
  if (h < 12) return t('rmp_good_morning');
  if (h < 17) return t('rmp_good_afternoon');
  return t('rmp_good_evening');
};

export default function Dashboard({ navigation }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const rmpName = user?.name || t('rmp_role');
  const rmpId = user?.userId;
  const initials = rmpName.split(' ').map(n => n[0]).slice(0, 2).join('');

  const [stats, setStats] = useState({ patients: 0, bookings: 0, pending: 0 });
  const [commission, setCommission] = useState({ thisMonth: 0, growthPct: 0, bookings: 0 });
  const [todayBookings, setTodayBookings] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!rmpId) return;
    setLoading(true);
    try {
      const [earningsData, statsData, allBookings] = await Promise.all([
        fetchRmpEarnings(rmpId),
        fetchRmpStats(rmpId),
        fetchRmpBookings(rmpId),
      ]);
      setStats(statsData);
      setCommission(earningsData.commission);
      setTodayBookings(allBookings.filter(b => b.isToday));
    } catch (e) {
      console.warn('Dashboard load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [rmpId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Avatar initials={initials} size={46} />
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{getGreeting(t)}</Text>
            <Text style={styles.rmpName}>{rmpName}, {t('rmp_role')}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('RmpQR')}>
            <Ionicons name="qr-code-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.notifBtn, { marginLeft: 8 }]}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Commission card */}
        <View style={styles.commissionCard}>
          <Text style={styles.commissionLabel}>{t('rmp_incentive_label')}</Text>
          <Text style={styles.commissionAmount}>₹{commission.thisMonth.toLocaleString('en-IN')}</Text>
          <Text style={styles.commissionMeta}>
            {commission.growthPct >= 0 ? '↑' : '↓'} {Math.abs(commission.growthPct)}% {t('rmp_vs_last_month')}  ·  {commission.bookings} {t('rmp_bookings_lc')}
          </Text>
          <View style={styles.commissionActions}>
            <TouchableOpacity style={styles.withdrawBtn} onPress={() => navigation.navigate('Earnings')}>
              <Text style={styles.withdrawText}>{t('rmp_withdraw')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('Earnings')}>
              <Text style={styles.historyText}>{t('rmp_history')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity style={[styles.quickCard, styles.quickCardPrimary]} onPress={() => navigation.navigate('LinkPatient')} activeOpacity={0.85}>
            <View style={[styles.quickIcon, styles.quickIconOnPrimary]}>
              <Ionicons name="add" size={20} color={COLORS.primary} />
            </View>
            <Text style={[styles.quickLabel, styles.quickLabelOnPrimary]}>{t('rmp_new_booking')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('NewPatient')} activeOpacity={0.85}>
            <View style={styles.quickIcon}>
              <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.quickLabel}>{t('rmp_add_patient')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('Services')} activeOpacity={0.85}>
            <View style={styles.quickIcon}>
              <Ionicons name="grid-outline" size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.quickLabel}>{t('rmp_services')}</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency — pinned above the stats so it is never scrolled to. */}
        <TouchableOpacity
          style={styles.emergencyBtn}
          onPress={() => navigation.navigate('LinkPatient', { service: 'emergency' })}
          activeOpacity={0.85}
        >
          <View style={styles.emergencyIcon}>
            <MaterialCommunityIcons name="alarm-light" size={20} color="#dc2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyTitle}>Emergency Admission</Text>
            <Text style={styles.emergencySub}>Alert a hospital now — they respond within 5 minutes</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#b91c1c" />
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Patients')}>
            <Text style={styles.statNum}>{stats.patients}</Text>
            <Text style={styles.statLabel}>{t('rmp_stat_patients')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Bookings')}>
            <Text style={styles.statNum}>{stats.bookings}</Text>
            <Text style={styles.statLabel}>{t('rmp_stat_bookings')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Bookings')}>
            <Text style={[styles.statNum, { color: COLORS.warning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>{t('status_pending')}</Text>
          </TouchableOpacity>
        </View>

        {/* Today's bookings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('rmp_today_bookings')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
            <Text style={styles.viewAll}>{t('rmp_view_all')}</Text>
          </TouchableOpacity>
        </View>

        {todayBookings.length === 0 ? (
          <Text style={styles.empty}>{t('rmp_no_bookings_today')}</Text>
        ) : todayBookings.map(booking => (
          <TouchableOpacity
            key={booking.id}
            style={styles.bookingCard}
            onPress={() => navigation.navigate('PatientJourney', { booking })}
            activeOpacity={0.8}
          >
            <Avatar name={booking.patientName} />
            <View style={styles.bookingInfo}>
              <Text style={styles.bookingName}>{booking.patientName}</Text>
              <Text style={styles.bookingMeta}>{booking.providerName} · {booking.time}</Text>
            </View>
            <StatusPill label={booking.status} />
          </TouchableOpacity>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  headerText: { flex: 1, marginLeft: 12 },
  greeting: { fontSize: 13, color: COLORS.textSecondary },
  rmpName: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  commissionCard: { backgroundColor: COLORS.primary, borderRadius: 18, padding: 20, marginTop: 16 },
  commissionLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
  commissionAmount: { fontSize: 34, fontWeight: '700', color: COLORS.white, marginTop: 4 },
  commissionMeta: { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  commissionActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  withdrawBtn: { backgroundColor: COLORS.white, borderRadius: 15, height: 30, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  withdrawText: { fontSize: 12.5, fontWeight: '600', color: COLORS.primary },
  historyBtn: { borderWidth: 1.2, borderColor: COLORS.white, borderRadius: 15, height: 30, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  historyText: { fontSize: 12.5, fontWeight: '600', color: COLORS.white },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  quickCard: { flex: 1, height: 80, borderRadius: 16, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickCardPrimary: { backgroundColor: COLORS.primary },
  quickIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  quickIconOnPrimary: { backgroundColor: COLORS.white },
  quickLabel: { fontSize: 12.5, fontWeight: '600', color: COLORS.primary, marginTop: 6 },
  quickLabelOnPrimary: { color: COLORS.white },
  emergencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff7f7', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 16, padding: 14, marginTop: 16,
  },
  emergencyIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center',
  },
  emergencyTitle: { fontSize: 14.5, fontWeight: '700', color: '#b91c1c' },
  emergencySub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: { flex: 1, height: 72, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  viewAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  bookingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginBottom: 12 },
  bookingInfo: { flex: 1, marginLeft: 12 },
  bookingName: { fontSize: 14.5, fontWeight: '600', color: COLORS.text },
  bookingMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 20, fontSize: 13.5 },
});
