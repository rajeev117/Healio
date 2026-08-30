import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { fetchEarnings } from '../services/api';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
];
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function Earnings() {
  const { user } = useAuth();
  const { hospitalId: orgId } = user || {};
  const [earnings, setEarnings] = useState(null);
  const [period, setPeriod]     = useState('today');
  const [loading, setLoading]   = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchEarnings(orgId)
      .then(setEarnings)
      .catch(e => console.warn('Independent pharmacy earnings:', e.message))
      .finally(() => setLoading(false));
  }, [orgId]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loader}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const maxBar = earnings ? Math.max(...earnings.weekTrend, 1) : 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.ring} pointerEvents="none" />
          <Text style={styles.headerLabel}>Earnings</Text>
          <View style={styles.periodRow}>
            {PERIODS.map(p => (
              <TouchableOpacity
                key={p.key}
                style={[styles.periodTab, period === p.key && styles.periodTabActive]}
                onPress={() => setPeriod(p.key)}
              >
                <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.bigAmount}>{inr(earnings?.[period])}</Text>
          <Text style={styles.bigSub}>
            {period === 'today' ? "Today's collection" : period === 'week' ? 'Collected this week' : 'Collected this month'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Pending payout</Text>
            <Text style={styles.summaryValue}>{inr(earnings?.pendingPayout)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>This month</Text>
            <Text style={styles.summaryValue}>{inr(earnings?.month)}</Text>
          </View>
        </View>

        {earnings && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Last 7 days</Text>
            <View style={styles.chart}>
              {earnings.weekTrend.map((v, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barValue}>{v > 0 ? Math.round(v / 1000) + 'k' : ''}</Text>
                  <View style={styles.barTrack}>
                    <View style={[
                      styles.barFill,
                      { height: `${(v / maxBar) * 100}%` },
                      v === maxBar && v > 0 && { backgroundColor: COLORS.primary },
                    ]} />
                  </View>
                  <Text style={styles.barLabel}>{earnings.weekLabels[i]}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>How payouts work</Text>
          <Text style={styles.noteBody}>
            Collections settle to your registered account on the platform payout cycle. Orders still marked
            pending are not counted until they complete.
          </Text>
        </View>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.headerRadiusLeft,
    borderBottomRightRadius: SIZES.headerRadiusRight,
    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 8 : 16, paddingBottom: 36,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute', top: -100, right: -70,
    width: 200, height: 200, borderRadius: 100,
    borderWidth: 30, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerLabel: { color: COLORS.white, fontSize: 20, fontWeight: '800', marginBottom: SPACING.m },
  periodRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 4, marginBottom: SPACING.l },
  periodTab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  periodTabActive: { backgroundColor: COLORS.white },
  periodText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  periodTextActive: { color: COLORS.primary },
  bigAmount: { color: COLORS.white, fontSize: 38, fontWeight: '900', letterSpacing: -1 },
  bigSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  summaryRow: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  summaryValue: { fontSize: 20, fontWeight: '900', color: COLORS.text, marginTop: 4, letterSpacing: -0.5 },
  card: { backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 16, marginHorizontal: 20, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160, marginTop: SPACING.m },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 9, color: COLORS.textSecondary, fontWeight: '700', marginBottom: 4 },
  barTrack: { width: 16, flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.surface, borderRadius: 8 },
  barFill: { width: 16, borderRadius: 8, backgroundColor: '#f0dcd7', minHeight: 4 },
  barLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 6 },
  noteCard: { backgroundColor: COLORS.primarySoft, borderRadius: SIZES.radiusLg, padding: 16, marginHorizontal: 20, marginTop: 16 },
  noteTitle: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  noteBody: { fontSize: 11.5, color: '#a1736a', marginTop: 6, lineHeight: 17 },
});
