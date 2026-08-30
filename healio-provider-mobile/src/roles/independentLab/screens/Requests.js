// Every order this lab has, filterable by stage. The Home screen shows the
// first five; this is the full queue.
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import AppBar from '../components/AppBar';
import { fetchOrders, getStages, resolveStage } from '../services/api';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const FILTERS = [
  { key: 'all',        label: 'All' },
  { key: 'to_price',   label: 'To price' },
  { key: 'processing', label: 'In lab' },
  { key: 'ready',      label: 'Ready' },
  { key: 'shared',     label: 'Done' },
];

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

const BUCKET = {
  to_price:   ['to_price', 'quoted'],
  processing: ['accepted', 'collected', 'processing'],
  ready:      ['ready'],
  shared:     ['shared'],
};

export default function Requests({ navigation }) {
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
      <AppBar title="Lab orders" subtitle={`${orders.length} total`} />

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
              <Ionicons name="flask-outline" size={36} color={COLORS.borderStrong} />
              <Text style={styles.emptyText}>Nothing here</Text>
            </View>
          ) : visible.map(o => {
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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{o.patientName}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {o.order_id} · {Array.isArray(o.tests) && o.tests.length ? `${o.tests.length} test${o.tests.length > 1 ? 's' : ''}` : 'not priced'}
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
