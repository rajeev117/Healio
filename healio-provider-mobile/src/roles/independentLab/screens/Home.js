import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { STATUS, listRequests, subscribe } from '../../../lib/orderRequests';
import ShutterToggle from '../components/ShutterToggle';
import {
  fetchOrgInfo, fetchOrders, fetchEarnings, fetchCheckins, subscribeCheckins,
  getStages, resolveStage, stageCounts,
} from '../services/api';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const STAGE_PILL = {
  to_price:   { label: 'TO PRICE',   bg: COLORS.mutedSoft,   fg: COLORS.textSecondary, rail: '#c9c9d1' },
  quoted:     { label: 'QUOTED',     bg: COLORS.warningSoft, fg: '#b45309',            rail: COLORS.warning },
  accepted:   { label: 'ACCEPTED',   bg: COLORS.infoSoft,    fg: COLORS.tintBlueInk,   rail: COLORS.tintBlueInk },
  collected:  { label: 'COLLECTED',  bg: COLORS.infoSoft,    fg: COLORS.tintBlueInk,   rail: COLORS.tintBlueInk },
  processing: { label: 'PROCESSING', bg: COLORS.warningSoft, fg: '#b45309',            rail: COLORS.warning },
  ready:      { label: 'READY',      bg: COLORS.successSoft, fg: COLORS.success,       rail: COLORS.success },
  shared:     { label: 'SHARED',     bg: COLORS.successSoft, fg: COLORS.success,       rail: COLORS.success },
  cancelled:  { label: 'CANCELLED',  bg: COLORS.dangerSoft,  fg: COLORS.error,         rail: COLORS.error },
};

export default function Home({ navigation }) {
  const { user } = useAuth();
  const { hospitalId: orgId, hospitalName } = user || {};

  const [org, setOrg]           = useState(null);
  const [orders, setOrders]     = useState([]);
  const [stageMap, setStageMap] = useState({});
  const [earnings, setEarnings] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [toPrice, setToPrice]   = useState(0);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [o, ord, earn, stages, chk] = await Promise.all([
        fetchOrgInfo(orgId).catch(() => null),
        fetchOrders(orgId).catch(() => []),
        fetchEarnings(orgId).catch(() => null),
        getStages(),
        fetchCheckins(orgId).catch(() => []),
      ]);
      setOrg(o); setOrders(ord); setEarnings(earn); setStageMap(stages); setCheckins(chk);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Patient-raised test requests waiting to be priced (local store).
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

  // A patient scanning this lab's QR should appear without a pull-to-refresh.
  useEffect(() => subscribeCheckins(orgId, () => load(true)), [orgId, load]);

  const counts = stageCounts(orders, stageMap);
  const name = org?.name || hospitalName || 'My Lab';
  const waiting = checkins.filter(c => c.status === 'new');

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
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
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.ring} pointerEvents="none" />

          <View style={styles.idRow}>
            <TouchableOpacity style={styles.idLeft} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.avatar}><Ionicons name="flask" size={20} color={COLORS.white} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>{greeting()}</Text>
                <Text style={styles.roleLine}>Independent lab</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.idRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('LabQR')}>
                <Ionicons name="qr-code-outline" size={20} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Requests')}>
                <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
                {(toPrice > 0 || waiting.length > 0) && <View style={styles.notifDot} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.heroTitle} numberOfLines={1}>{name}</Text>
            {!!org?.city && <Text style={styles.heroSub} numberOfLines={1}>{org.city}</Text>}
          </View>

          <View style={styles.strip}>
            <Stat value={counts.toPrice}    label="To price"   tint="#ffd27d" />
            <View style={styles.stripDiv} />
            <Stat value={counts.processing} label="Processing" tint={COLORS.white} />
            <View style={styles.stripDiv} />
            <Stat value={counts.ready}      label="Ready"      tint="#9ae6b4" />
          </View>
        </View>

        {/* Shutter + scan, lifted over the header seam. Deliberately in normal
            flow: an absolutely-positioned card cannot know its own height, and
            buried the stat strip above it whenever its content grew. */}
        <View style={styles.counterCard}>
          <ShutterToggle
            storageKey="@healio_indie_lab_shutter"
            openLabel="Open · collecting samples"
            closedLabel="Closed · not collecting"
          />
          <View style={styles.cardDivider} />
          <TouchableOpacity style={styles.scanRow} onPress={() => navigation.navigate('ScanWalkIn')}>
            <View style={styles.scanIcon}><Ionicons name="scan-outline" size={22} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scanTitle}>Scan a walk-in patient</Text>
              <Text style={styles.scanSub}>Pull their prescription in one tap</Text>
            </View>
            <View style={styles.scanCta}><Text style={styles.scanCtaText}>Scan</Text></View>
          </TouchableOpacity>
        </View>

        {/* ── Quick actions ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.quickGrid}>
            <Quick icon="list-outline"          label="Orders"   bg={COLORS.tintTeal}   fg={COLORS.tintTealInk}   onPress={() => navigation.navigate('Requests')} />
            <Quick icon="document-text-outline" label="Requests" bg={COLORS.tintViolet} fg={COLORS.tintVioletInk} onPress={() => navigation.navigate('OrderRequests')} />
            <Quick icon="flask-outline"         label="Catalog"  bg={COLORS.tintBlue}   fg={COLORS.tintBlueInk}   onPress={() => navigation.navigate('TestCatalog')} />
            <Quick icon="wallet-outline"        label="Payouts"  bg={COLORS.tintGold}   fg={COLORS.tintGoldInk}   onPress={() => navigation.navigate('Earnings')} />
          </View>
        </View>

        {/* ── Today's money ────────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.earnCard} onPress={() => navigation.navigate('Earnings')}>
            <View style={styles.earnIcon}><Ionicons name="cash-outline" size={22} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.earnLabel}>Today's collection</Text>
              <Text style={styles.earnValue} numberOfLines={1}>{inr(earnings?.today)}</Text>
            </View>
            <View style={styles.earnRight}>
              <Text style={styles.earnAmount} numberOfLines={1}>{inr(earnings?.pendingPayout)}</Text>
              <Text style={styles.earnCaption}>pending payout</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.borderStrong} />
          </TouchableOpacity>
        </View>

        {/* ── Waiting to be priced ─────────────────────────────────────── */}
        {toPrice > 0 && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.alertCard} onPress={() => navigation.navigate('OrderRequests')}>
              <View style={styles.alertIcon}><Ionicons name="receipt-outline" size={20} color="#92400e" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>
                  {toPrice} prescription{toPrice > 1 ? 's' : ''} to price
                </Text>
                <Text style={styles.alertSub}>Patients are waiting on your quote</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#b45309" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Walk-ins who just scanned ────────────────────────────────── */}
        {waiting.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, styles.sectionTitleSolo]}>At the counter</Text>
            {waiting.map(c => (
              <TouchableOpacity
                key={c.id}
                style={styles.row}
                onPress={() => navigation.navigate('TestRequestQuote', {
                  patientId: c.patientId, patientName: c.name, patientAge: c.age, gender: c.gender, checkinId: c.id,
                })}
              >
                <View style={[styles.rail, { backgroundColor: COLORS.primary }]} />
                <View style={styles.rowInner}>
                  <View style={styles.avatarSm}><Text style={styles.avatarSmText}>{initials(c.name)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{c.name}</Text>
                    <Text style={styles.rowMeta}>
                      {c.age ? `${c.age} yrs · ` : ''}scanned {timeAgo(c.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.newPill}><Text style={styles.newPillText}>NEW</Text></View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Samples in progress ──────────────────────────────────────── */}
        <View style={[styles.section, { marginBottom: SPACING.xl * 2 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Samples in progress</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Requests')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          {orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="flask-outline" size={36} color={COLORS.borderStrong} />
              <Text style={styles.emptyText}>No lab orders yet</Text>
              <Text style={styles.emptyHint}>Scan a walk-in patient to start one</Text>
            </View>
          ) : orders.slice(0, 5).map(o => {
            const stage = resolveStage(o, stageMap[o.id]);
            const pill = STAGE_PILL[stage] || STAGE_PILL.to_price;
            return (
              <TouchableOpacity
                key={o.id}
                style={styles.row}
                onPress={() => navigation.navigate('SampleReport', { orderId: o.id })}
              >
                <View style={[styles.rail, { backgroundColor: pill.rail }]} />
                <View style={styles.rowInner}>
                  <View style={styles.avatarSm}><Text style={styles.avatarSmText}>{initials(o.patientName)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{o.patientName}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>{testSummary(o.tests)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.rowOrderId}>{o.order_id}</Text>
                    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
const initials = (n) => String(n || '?').trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const testSummary = (tests) => {
  if (!Array.isArray(tests) || tests.length === 0) return 'No tests priced yet';
  return tests.map(t => t.name).filter(Boolean).join(' · ') || `${tests.length} tests`;
};

const timeAgo = (ts) => {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
};

const Stat = ({ value, label, tint }) => (
  <View style={styles.statCol}>
    <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
    <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
  </View>
);

const Quick = ({ icon, label, bg, fg, onPress }) => (
  <TouchableOpacity style={styles.quickCard} onPress={onPress}>
    <View style={[styles.quickIcon, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={fg} />
    </View>
    <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },

  hero: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.headerRadiusLeft,
    borderBottomRightRadius: SIZES.headerRadiusRight,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute', top: -116, right: -80,
    width: 232, height: 232, borderRadius: 116,
    borderWidth: 34, borderColor: 'rgba(255,255,255,0.09)',
  },

  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  idLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.28)', justifyContent: 'center', alignItems: 'center',
  },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 11.5, fontWeight: '500' },
  roleLine: { color: COLORS.white, fontSize: 14.5, fontWeight: '700', marginTop: 2 },
  idRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.13)', justifyContent: 'center', alignItems: 'center',
  },
  notifDot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffb347' },

  heroBody: { marginTop: SPACING.l },
  heroTitle: { fontSize: 23, fontWeight: '800', color: COLORS.white, letterSpacing: -0.5 },
  heroSub: { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.72)', marginTop: 5 },

  strip: {
    flexDirection: 'row', alignItems: 'center', marginTop: SPACING.l,
    backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: SIZES.radiusLg, paddingVertical: SPACING.m,
  },
  statCol: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 10.5, fontWeight: '600', color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  stripDiv: { width: 1, alignSelf: 'stretch', marginVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)' },

  counterCard: {
    backgroundColor: COLORS.white, marginHorizontal: 20, marginTop: -20,
    borderRadius: SIZES.radiusXl, borderWidth: 1, borderColor: COLORS.border,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  cardDivider: { height: 1, backgroundColor: '#f2e6e2' },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  scanIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  scanTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  scanSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  scanCta: { backgroundColor: COLORS.primary, borderRadius: 13, paddingHorizontal: 15, paddingVertical: 11 },
  scanCtaText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  section: { paddingHorizontal: 20, marginTop: SPACING.m },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  sectionTitleSolo: { marginBottom: 12 },
  seeAll: { fontSize: 12.5, fontWeight: '600', color: COLORS.primary },

  quickGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusXl, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5,
  },
  quickCard: { flex: 1, alignItems: 'center' },
  quickIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 10.5, fontWeight: '600', color: COLORS.text, textAlign: 'center' },

  earnCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  earnIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  earnLabel: { fontSize: 11.5, fontWeight: '500', color: COLORS.textSecondary },
  earnValue: { fontSize: 20, fontWeight: '900', color: COLORS.text, marginTop: 2, letterSpacing: -0.5 },
  earnRight: { alignItems: 'flex-end' },
  earnAmount: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.2 },
  earnCaption: { fontSize: 10, fontWeight: '500', color: COLORS.textSecondary, marginTop: 2 },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fffcf2', borderRadius: SIZES.radiusLg, padding: 14,
    borderWidth: 1, borderColor: '#f0e2bd',
  },
  alertIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#fdecc8', justifyContent: 'center', alignItems: 'center' },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#7c4a03' },
  alertSub: { fontSize: 11, color: '#8a6a3a', marginTop: 3 },

  row: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  rail: { width: 3 },
  rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  avatarSm: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  avatarSmText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  rowName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  rowOrderId: { fontSize: 11, fontWeight: '700', color: '#9aa0a6' },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  newPill: { backgroundColor: COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  newPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4, color: COLORS.primary },

  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  emptyHint: { fontSize: 12, color: COLORS.borderStrong },
});
