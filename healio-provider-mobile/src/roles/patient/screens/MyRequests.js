import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase } from '../services/supabase';

const STATUS_COLOR = {
  open: '#c05621', pending: '#c05621', resolved: COLORS.success, approved: COLORS.success, rejected: COLORS.error,
};

export default function MyRequests({ navigation }) {
  const [disputes, setDisputes] = useState([]);
  const [refunds, setRefunds]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('disputes');

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [d, r] = await Promise.all([
        supabase.from('disputes').select('*').eq('patient_id', user.id).order('created_at', { ascending: false }),
        supabase.from('refunds').select('*').eq('patient_id', user.id).order('requested_at', { ascending: false }),
      ]);
      setDisputes(d.data || []);
      setRefunds(r.data || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const list = tab === 'disputes' ? disputes : refunds;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        {['disputes', 'refunds'].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'disputes' ? `Complaints (${disputes.length})` : `Refunds (${refunds.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.m, gap: 12 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
          {list.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="documents-outline" size={44} color={COLORS.border} />
              <Text style={styles.emptyText}>No {tab === 'disputes' ? 'complaints' : 'refund requests'} yet</Text>
            </View>
          ) : tab === 'disputes' ? (
            disputes.map(d => (
              <View key={d.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{d.subject}</Text>
                  <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[d.status] || COLORS.textSecondary) + '22' }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLOR[d.status] || COLORS.textSecondary }]}>{d.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{d.category} · {d.priority} priority</Text>
                <Text style={styles.cardDate}>{new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
              </View>
            ))
          ) : (
            refunds.map(r => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>₹{Number(r.amount).toLocaleString('en-IN')} refund</Text>
                  <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[r.status] || COLORS.textSecondary) + '22' }]}>
                    <Text style={[styles.badgeText, { color: STATUS_COLOR[r.status] || COLORS.textSecondary }]}>{r.status}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{r.reason}</Text>
                <Text style={styles.cardDate}>via {r.method} · {new Date(r.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* New request buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtnOutline} onPress={() => navigation.navigate('RaiseDispute')}>
          <Ionicons name="chatbox-ellipses-outline" size={18} color={COLORS.primary} />
          <Text style={styles.footerBtnOutlineText}>Complaint</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtn} onPress={() => navigation.navigate('RequestRefund')}>
          <Ionicons name="cash-outline" size={18} color={COLORS.white} />
          <Text style={styles.footerBtnText}>Request Refund</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  tabBar: { flexDirection: 'row', margin: SPACING.m, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.white },
  card: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },
  cardDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary },
  footer: { flexDirection: 'row', gap: 12, padding: SPACING.m, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  footerBtnOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 16, borderWidth: 1, borderColor: COLORS.primary },
  footerBtnOutlineText: { color: COLORS.primary, fontWeight: '700' },
  footerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 16, backgroundColor: COLORS.primary },
  footerBtnText: { color: COLORS.white, fontWeight: '700' },
});
