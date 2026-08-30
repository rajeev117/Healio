// Every order this counter has, filterable by stage. Home shows the first five;
// this is the full queue.
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import AppBar from '../components/AppBar';
import { fetchOrders, getStages, resolveStage } from '../services/api';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const FILTERS = [
  { key: 'all',      label: 'All' },
  { key: 'to_quote', label: 'To quote' },
  { key: 'packing',  label: 'Packing' },
  { key: 'out',      label: 'Delivery' },
  { key: 'done',     label: 'Done' },
];

const STAGE_PILL = {
  to_quote:    { label: 'TO QUOTE',    bg: COLORS.warningSoft, fg: '#b45309',            rail: COLORS.warning },
  quoted:      { label: 'QUOTED',      bg: COLORS.warningSoft, fg: '#b45309',            rail: COLORS.warning },
  accepted:    { label: 'PAID',        bg: COLORS.successSoft, fg: COLORS.success,       rail: COLORS.success },
  packing:     { label: 'PACKING',     bg: COLORS.infoSoft,    fg: COLORS.tintBlueInk,   rail: COLORS.tintBlueInk },
  out:         { label: 'ON THE WAY',  bg: COLORS.tintViolet,  fg: COLORS.tintVioletInk, rail: COLORS.tintVioletInk },
  handed_over: { label: 'HANDED OVER', bg: COLORS.successSoft, fg: COLORS.success,       rail: COLORS.success },
  closed:      { label: 'CLOSED',      bg: COLORS.mutedSoft,   fg: COLORS.textSecondary, rail: '#c9c9d1' },
  cancelled:   { label: 'CANCELLED',   bg: COLORS.dangerSoft,  fg: COLORS.error,         rail: COLORS.error },
};

const BUCKET = {
  to_quote: ['to_quote', 'quoted'],
  packing:  ['accepted', 'packing'],
  out:      ['out'],
  done:     ['handed_over', 'closed'],
};

export default function Orders({ navigation }) {
  const { user } = useAuth();
  const { hospitalId: orgId } = user || {};
  const [orders, setOrders] = useState([]);
  const [stageMap, setStageMap] = useState({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [ord, stages] = await Promise.all([
        fetchOrders(orgId, 100).catch(() => []),
        getStages(),
      ]);
      setOrders(ord);
      setStageMap(stages);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = orders.filter((o) => {
    if (filter === 'all') return true;
    return (BUCKET[filter] || []).includes(resolveStage(o, stageMap[o.id]));
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar title="Orders" subtitle={`${orders.length} total`} />

      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipOn]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: SPACING.xl * 2 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
        >
          {visible.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="receipt-outline" size={36} color={COLORS.borderStrong} />
              <Text style={styles.emptyText}>Nothing here</Text>
            </View>
          ) : visible.map(o => {
            const stage = resolveStage(o, stageMap[o.id]);
            const pill = STAGE_PILL[stage] || STAGE_PILL.to_quote;
            const items = Array.isArray(o.items) ? o.items.length : 0;
            return (
              <TouchableOpacity
                key={o.id}
                style={styles.row}
                onPress={() => navigation.navigate('Fulfilment', { orderId: o.id })}
              >
                <View style={[styles.rail, { backgroundColor: pill.rail }]} />
                <View style={styles.rowInner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{o.patientName}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {o.order_id} · {items ? `${items} item${items > 1 ? 's' : ''}` : 'not priced'}
                      {o.delivery_address ? ' · delivery' : ' · pickup'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <Text style={styles.amount}>{inr(o.total)}</Text>
                    <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                      <Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: COLORS.surface },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterRow: { paddingVertical: 14, backgroundColor: COLORS.surface },
  chip: {
    backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 11.5, fontWeight: '700', color: COLORS.textSecondary },
  chipTextOn: { color: COLORS.white },
  row: {
    flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },
  rail: { width: 3 },
  rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  amount: { fontSize: 14, fontWeight: '800', color: COLORS.text, letterSpacing: -0.3 },
  pill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
});
