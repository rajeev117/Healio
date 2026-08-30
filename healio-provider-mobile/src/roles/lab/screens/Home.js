import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES, ELEVATION } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { fetchLabPatients, fetchLabEarnings, fetchOrgInfo } from '../services/api';
import { STATUS, listRequests, subscribe } from '../../../lib/orderRequests';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function Home({ navigation }) {
  const { user } = useAuth();
  const { hospitalId, hospitalName, name: staffName, staffId } = user || {};
  const [patients, setPatients]   = useState([]);
  const [earnings, setEarnings]   = useState(null);
  const [org, setOrg]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [pts, earn, orgInfo] = await Promise.all([
        fetchLabPatients(hospitalId),
        fetchLabEarnings(hospitalId),
        fetchOrgInfo(hospitalId),
      ]);
      setPatients(pts);
      setEarnings(earn);
      setOrg(orgInfo);
    } catch (e) {
      console.warn('Lab Home load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hospitalId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Patient test requests waiting for the lab to price them.
  const [toPrice, setToPrice] = useState(0);
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const rs = await listRequests('lab');
      if (alive) setToPrice(rs.filter(r => r.status === STATUS.AWAITING_REVIEW).length);
    };
    sync();
    const unsub = subscribe(sync);
    return () => { alive = false; unsub(); };
  }, []);

  const pending = patients.filter(p => p.orders.some(o => o.status === 'pending'));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.avatar}>
                <Ionicons name="flask" size={20} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>{greeting()}</Text>
                <Text style={styles.roleLine}>Lab technician</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Prescriptions')}>
              <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
              {pending.length > 0 && <View style={styles.notifDot} />}
            </TouchableOpacity>
          </View>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle} numberOfLines={1}>{org?.name || hospitalName}</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{staffName}{staffId ? ` · ${staffId}` : ''}</Text>
          </View>
          <View style={styles.progressCard}>
            <View style={styles.progressCol}>
              <Text style={[styles.progressNum, { color: '#FFD27D' }]}>{pending.length}</Text>
              <Text style={styles.progressLabel} numberOfLines={1}>Pending</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressCol}>
              <Text style={styles.progressNum}>{patients.length}</Text>
              <Text style={styles.progressLabel} numberOfLines={1}>Patients</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressCol}>
              <Text style={styles.progressNum}>{patients.reduce((s, p) => s + p.orders.length, 0)}</Text>
              <Text style={styles.progressLabel} numberOfLines={1}>Orders</Text>
            </View>
          </View>
        </View>

        {/* Earnings strip */}
        <View style={styles.quickSection}>
          <TouchableOpacity style={styles.earningsCard} onPress={() => navigation.navigate('Earnings')}>
            <View style={styles.earningsIcon}>
              <Ionicons name="wallet" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earningsLabel}>Today's earnings</Text>
              <Text style={styles.earningsValue}>{inr(earnings?.today)}</Text>
            </View>
            <View style={styles.payoutRight}>
              <Text style={styles.payoutAmount} numberOfLines={1}>{inr(earnings?.pendingPayout)}</Text>
              <Text style={styles.payoutCaption}>pending payout</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.borderStrong} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.requestsCard, toPrice > 0 && styles.requestsCardAlert]}
            onPress={() => navigation.navigate('OrderRequests')}
          >
            <View style={[styles.requestsIcon, toPrice > 0 && { backgroundColor: '#FDECC8' }]}>
              <Ionicons name="receipt-outline" size={20} color={toPrice > 0 ? '#92400e' : COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.requestsLabel}>Test requests</Text>
              <Text style={styles.requestsValue}>
                {toPrice > 0
                  ? `${toPrice} prescription${toPrice > 1 ? 's' : ''} to price`
                  : 'No prescriptions waiting'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.quickGrid}>
            <QuickAction icon="document-text" label="Lab orders"  bg={COLORS.tintTeal} color={COLORS.tintTealInk} onPress={() => navigation.navigate('Prescriptions')} />
            <QuickAction icon="wallet"         label="Earnings"   bg={COLORS.tintBlue} color={COLORS.tintBlueInk} onPress={() => navigation.navigate('Earnings')} />
            <QuickAction icon="qr-code"        label="My QR"      bg={COLORS.tintGold} color={COLORS.tintGoldInk} onPress={() => navigation.navigate('LabQR')} />
            <QuickAction icon="scan"           label="Scan"       bg={COLORS.tintViolet} color={COLORS.tintVioletInk} onPress={() => navigation.navigate('ScanPatient')} />
          </View>
        </View>

        {/* Recent patients */}
        <View style={[styles.section, { marginBottom: SPACING.xl * 2 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent patients</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Prescriptions')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {patients.slice(0, 5).map(p => (
            <TouchableOpacity
              key={p.id}
              style={styles.rxRow}
              onPress={() => navigation.navigate('PatientPrescriptions', { patient: p })}
            >
              <View style={styles.rxAvatar}>
                <Text style={styles.rxAvatarText}>{(p.name || 'P').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.rxInfo}>
                <Text style={styles.rxName}>{p.name}</Text>
                <Text style={styles.rxReason}>{p.age ? `${p.age} yrs · ` : ''}{p.gender || ''}</Text>
              </View>
              <View style={styles.rxRight}>
                <Text style={styles.rxItems}>{p.orders.length} orders</Text>
                {p.orders.some(o => o.status === 'pending') && (
                  <Text style={styles.rxPending}>pending</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
          {patients.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="flask-outline" size={36} color={COLORS.borderStrong} />
              <Text style={styles.emptyText}>No lab orders yet</Text>
              <Text style={styles.emptyHint}>Scan a patient to start one</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const QuickAction = ({ icon, label, bg, color, onPress }) => (
  <TouchableOpacity style={styles.quickCard} onPress={onPress}>
    <View style={[styles.quickIcon, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.primary, borderBottomLeftRadius: SIZES.header, borderBottomRightRadius: SIZES.header,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.l },
  avatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
  roleLine: { color: COLORS.white, fontSize: 14, fontWeight: '700', marginTop: 2 },
  notifBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
  },
  notifDot: { position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFD27D' },
  headerBody: { marginBottom: SPACING.l },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white, letterSpacing: -0.4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  progressCard: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', padding: SPACING.m,
  },
  progressCol: { flex: 1, alignItems: 'center' },
  progressNum: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  progressLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: '500' },
  progressDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  quickSection: { paddingHorizontal: 20, marginTop: -26, marginBottom: SPACING.m },
  requestsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10,
    backgroundColor: COLORS.white, borderRadius: 20, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  requestsCardAlert: { borderColor: '#E9B949', backgroundColor: '#FFFCF2' },
  requestsIcon: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  requestsLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  requestsValue: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  earningsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    ...ELEVATION.raised,
  },
  earningsIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  earningsLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  earningsValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 2 },
  payoutRight: { alignItems: 'flex-end' },
  payoutAmount: { fontSize: 13, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.2 },
  payoutCaption: { fontSize: 10, fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },
  section: { paddingHorizontal: 20, marginTop: SPACING.m },
  quickGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusXl, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  quickCard: { flex: 1, alignItems: 'center' },
  quickIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 11, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, letterSpacing: -0.1 },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  rxRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusMd, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rxAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  rxAvatarText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  rxInfo: { flex: 1, paddingHorizontal: 12 },
  rxName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rxReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  rxRight: { alignItems: 'flex-end' },
  rxItems: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  rxPending: { fontSize: 10, color: '#c05621', fontWeight: '600', marginTop: 2 },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  emptyHint: { fontSize: 12, color: COLORS.borderStrong },
});
