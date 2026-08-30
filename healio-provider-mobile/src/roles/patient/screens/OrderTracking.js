import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase } from '../services/supabase';
import { STATUS, listRequests, subscribe } from '../../../lib/orderRequests';

// ─────────────────────────────────────────────────────────────────────────────
// OrderTracking — queries real pharmacy_orders, lab_orders, homecare_orders
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'pharmacy', label: 'Pharmacy',  icon: 'medkit' },
  { id: 'lab',      label: 'Lab Tests', icon: 'flask' },
  { id: 'homecare', label: 'Home Care', icon: 'home' },
];

// ── Step definitions ──────────────────────────────────────────────────────────
const PHARMACY_STEPS = ['Order Placed', 'Confirmed', 'Ready', 'Dispensed'];
// 'completed' is what the provider app sets; map it to the final step.
const PHARMACY_STATUS_STEP = { pending: 0, confirmed: 1, ready: 2, dispensed: 3, completed: 3 };

const LAB_STEPS = ['Booked', 'Sample Collected', 'Processing', 'Report Ready'];
// 'pending' = order just created at the counter; 'completed' = report uploaded.
const LAB_STATUS_STEP = { booked: 0, pending: 0, sample_collected: 1, processing: 2, report_ready: 3, completed: 3 };

const HOMECARE_STEPS = ['Booked', 'Confirmed', 'In Progress', 'Completed'];
const HOMECARE_STATUS_STEP = { booked: 0, confirmed: 1, in_progress: 2, completed: 3 };

// ── Status badge config ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  // pharmacy
  pending:           { label: 'Pending',          color: '#92400e', bg: COLORS.warningSoft },
  confirmed:         { label: 'Confirmed',         color: '#1e40af', bg: COLORS.infoSoft },
  ready:             { label: 'Ready',             color: '#065f46', bg: COLORS.successSoft },
  dispensed:         { label: 'Dispensed',         color: COLORS.success, bg: COLORS.successSoft },
  // lab
  booked:            { label: 'Booked',            color: '#1e40af', bg: COLORS.infoSoft },
  sample_collected:  { label: 'Sample Collected',  color: '#1e40af', bg: COLORS.infoSoft },
  processing:        { label: 'Processing',        color: '#92400e', bg: COLORS.warningSoft },
  report_ready:      { label: 'Report Ready',      color: COLORS.success, bg: COLORS.successSoft },
  // homecare
  in_progress:       { label: 'In Progress',       color: '#92400e', bg: COLORS.warningSoft },
  completed:         { label: 'Completed',         color: COLORS.success, bg: COLORS.successSoft },
  // generic
  cancelled:         { label: 'Cancelled',         color: COLORS.error, bg: COLORS.dangerSoft },
};

// ── Step tracker component ────────────────────────────────────────────────────
function Steps({ steps, current }) {
  return (
    <View style={styles.stepsWrap}>
      {steps.map((step, i) => {
        const done   = i <= current;
        const active = i === current;
        return (
          <View key={step} style={styles.stepItem}>
            <View style={styles.stepLeft}>
              <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                {done && !active && <Ionicons name="checkmark" size={10} color={COLORS.white} />}
                {active && <View style={styles.stepInner} />}
              </View>
              {i < steps.length - 1 && (
                <View style={[styles.stepLine, done && i < current && styles.stepLineDone]} />
              )}
            </View>
            <Text style={[styles.stepLabel, done && styles.stepLabelDone, active && styles.stepLabelActive]}>
              {step}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Single order card ─────────────────────────────────────────────────────────
function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS_CONFIG[order.status] || { label: order.status, color: COLORS.text, bg: COLORS.surface };

  return (
    <View style={styles.orderCard}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
        <View style={styles.orderTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>{order.orderId}</Text>
            <Text style={styles.orderDate}>{order.date}</Text>
          </View>
          <View style={styles.orderTopRight}>
            <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
              <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
            </View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
          </View>
        </View>

        <View style={styles.itemsRow}>
          {order.items.map((item, i) => (
            <View key={i} style={styles.itemChip}>
              <Text style={styles.itemChipText} numberOfLines={1}>{item}</Text>
            </View>
          ))}
        </View>

        {!!order.meta && (
          <View style={styles.etaRow}>
            <Ionicons name="time-outline" size={13} color={COLORS.primary} />
            <Text style={styles.etaText}>{order.meta}</Text>
          </View>
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedSection}>
          <Text style={styles.trackingLabel}>Order Tracking</Text>
          <Steps steps={order.steps} current={order.currentStep} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalAmount}>₹{order.total}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function OrderTracking({ navigation, route }) {
  // Rendered both as the "Orders" bottom tab and as a pushed stack screen; the
  // tab has nowhere to go back to, so it drops the back arrow.
  const asTab = route?.name === 'Orders';
  const [activeTab, setActiveTab] = useState(route?.params?.tab || 'pharmacy');

  // Opening the tab with a specific section (e.g. from the dashboard strip)
  // has to switch the section even when the screen is already mounted.
  useEffect(() => {
    if (route?.params?.tab) setActiveTab(route.params.tab);
  }, [route?.params?.tab]);
  const [requests, setRequests] = useState([]);
  const [pharmacyOrders, setPharmacyOrders] = useState([]);
  const [labOrders, setLabOrders]           = useState([]);
  const [homecareOrders, setHomecareOrders] = useState([]);
  const [loading, setLoading]               = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [pharmaRes, labRes, homecareRes] = await Promise.all([
        supabase
          .from('pharmacy_orders')
          .select('id, order_id, items, total, status, created_at, delivery_slot, address')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('lab_orders')
          .select('id, tests, total, status, created_at, scheduled_date, scheduled_time, collection_type')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('homecare_orders')
          .select('id, service, total, status, created_at, scheduled_date, scheduled_time, address')
          .eq('patient_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      const formatDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      };

      setPharmacyOrders(
        (pharmaRes.data || []).map((o, i) => ({
          id: o.id,
          orderId: o.order_id || `#PH-${String(o.id).slice(0, 6).toUpperCase()}`,
          date: formatDate(o.created_at),
          items: Array.isArray(o.items)
            ? o.items.map(it => `${it.name || it}${it.qty ? ` ×${it.qty}` : ''}`)
            : [],
          total: o.total || 0,
          status: o.status || 'pending',
          steps: PHARMACY_STEPS,
          currentStep: PHARMACY_STATUS_STEP[o.status] ?? 0,
          meta: o.delivery_slot || null,
        }))
      );

      setLabOrders(
        (labRes.data || []).map((o) => ({
          id: o.id,
          orderId: `#LB-${String(o.id).slice(0, 6).toUpperCase()}`,
          date: formatDate(o.created_at),
          // Legacy rows stored plain test names; prescription requests store an
          // object per line.
          items: Array.isArray(o.tests)
            ? o.tests.map(t => (typeof t === 'string' ? t : t?.name || 'Requested tests'))
            : [],
          total: o.total || 0,
          status: o.status || 'booked',
          steps: LAB_STEPS,
          currentStep: LAB_STATUS_STEP[o.status] ?? 0,
          meta: o.scheduled_date ? `${o.collection_type === 'home' ? 'Home collection' : 'Walk-in'} · ${o.scheduled_date}${o.scheduled_time ? ` at ${o.scheduled_time}` : ''}` : null,
        }))
      );

      setHomecareOrders(
        (homecareRes.data || []).map((o) => ({
          id: o.id,
          orderId: `#HC-${String(o.id).slice(0, 6).toUpperCase()}`,
          date: formatDate(o.created_at),
          items: [o.service || 'Home Care Service'],
          total: o.total || 0,
          status: o.status || 'booked',
          steps: HOMECARE_STEPS,
          currentStep: HOMECARE_STATUS_STEP[o.status] ?? 0,
          meta: o.scheduled_date ? `${o.scheduled_date}${o.scheduled_time ? ` at ${o.scheduled_time}` : ''}` : null,
        }))
      );
    } catch (e) {
      console.warn('OrderTracking load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(load);

  // Local prescription requests, kept live so an invoice arriving while this
  // screen is open shows up straight away.
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const rs = await listRequests();
      if (alive) setRequests(rs);
    };
    sync();
    const unsub = subscribe(sync);
    return () => { alive = false; unsub(); };
  }, []);

  // Prescription orders for the tab in view — these live in the local request
  // store from the moment they are sent until the patient settles the invoice.
  const tabRequests = requests.filter(r =>
    (activeTab === 'pharmacy' && r.kind === 'pharmacy') ||
    (activeTab === 'lab' && r.kind === 'lab')
  );

  // Still moving through review / approval — surfaced as action cards on top.
  const openRequests = tabRequests.filter(
    r => r.status === STATUS.AWAITING_REVIEW || r.status === STATUS.QUOTED
  );

  // Settled ones join the regular order list so they stay visible afterwards.
  const settledRequests = tabRequests
    .filter(r => [STATUS.CONFIRMED, STATUS.DECLINED, STATUS.CANCELLED].includes(r.status))
    .map(r => ({
      id: r.id,
      orderId: `#${r.orderNumber}`,
      date: new Date(r.paidAt || r.updatedAt || r.createdAt)
        .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      items: r.invoice?.items?.map(i => i.label) || ['Prescription order'],
      total: r.status === STATUS.CONFIRMED ? (r.invoice?.total || 0) : 0,
      status: r.status === STATUS.CONFIRMED ? 'confirmed' : 'cancelled',
      steps: activeTab === 'lab' ? LAB_STEPS : PHARMACY_STEPS,
      currentStep: r.status === STATUS.CONFIRMED ? 1 : 0,
      meta: [r.fulfilmentLabel, r.slot].filter(Boolean).join(' · '),
    }));

  const remoteOrders = activeTab === 'pharmacy' ? pharmacyOrders
    : activeTab === 'lab' ? labOrders
    : homecareOrders;
  const orders = [...settledRequests, ...remoteOrders];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        {asTab ? (
          <View style={{ width: 40 }} />
        ) : (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={activeTab === tab.id ? COLORS.primary : COLORS.textSecondary}
            />
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {openRequests.map(r => {
            const quoted = r.status === STATUS.QUOTED;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.requestCard, quoted && styles.requestCardQuoted]}
                onPress={() => navigation.navigate('OrderApproval', { requestId: r.id })}
                activeOpacity={0.85}
              >
                <View style={[styles.requestIcon, quoted && { backgroundColor: COLORS.warningSoft }]}>
                  <Ionicons
                    name={quoted ? 'receipt-outline' : 'hourglass-outline'}
                    size={18}
                    color={quoted ? '#92400e' : COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestTitle}>
                    {quoted ? 'Invoice ready — your approval needed' : 'Waiting for provider approval'}
                  </Text>
                  <Text style={styles.requestMeta}>
                    {r.orderNumber} · {r.providerName}
                    {quoted && r.invoice ? ` · ₹${r.invoice.total}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            );
          })}

          {orders.length === 0 && openRequests.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySubText}>Your {TABS.find(t => t.id === activeTab)?.label} orders will appear here once placed.</Text>
            </View>
          ) : (
            orders.map(order => <OrderCard key={order.id} order={order} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  requestCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radius,
    borderWidth: 1.5, borderColor: COLORS.border,
    padding: SPACING.m, marginBottom: SPACING.s,
  },
  requestCardQuoted: { borderColor: COLORS.warning, backgroundColor: COLORS.warningSoft },
  requestIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  requestTitle: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  requestMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: COLORS.primary },
  tabLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.primary },
  listContent: { padding: SPACING.m, gap: 14, paddingBottom: 40 },
  orderCard: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  orderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderId: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  orderDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  orderTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  itemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  itemChip: {
    backgroundColor: COLORS.background, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: COLORS.border, maxWidth: '85%',
  },
  itemChipText: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  etaText: { fontSize: 12, fontWeight: '700', color: COLORS.primary, flex: 1 },
  expandedSection: {
    marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  trackingLabel: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
  stepsWrap: {},
  stepItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepLeft: { alignItems: 'center', width: 20 },
  stepDot: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.border, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotDone:   { backgroundColor: COLORS.success, borderColor: COLORS.success },
  stepDotActive: { backgroundColor: COLORS.white, borderColor: COLORS.primary },
  stepInner:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  stepLine:      { width: 2, height: 24, backgroundColor: COLORS.border },
  stepLineDone:  { backgroundColor: COLORS.success },
  stepLabel: {
    fontSize: 13, color: COLORS.textSecondary,
    paddingTop: 1, paddingBottom: 20, fontWeight: '600',
  },
  stepLabelDone:   { color: COLORS.text },
  stepLabelActive: { color: COLORS.primary, fontWeight: '800' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 12, marginTop: 4,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  totalLabel:  { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  totalAmount: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText:    { fontSize: 15, color: COLORS.text, fontWeight: '700' },
  emptySubText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
});
