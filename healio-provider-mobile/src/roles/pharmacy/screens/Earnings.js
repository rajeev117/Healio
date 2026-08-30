import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES, ELEVATION } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { fetchPharmacyEarnings } from '../services/api';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This week' },
  { key: 'month', label: 'This month' },
];
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function Earnings() {
  const { user } = useAuth();
  const { hospitalId } = user || {};
  const [earnings, setEarnings] = useState(null);
  const [period, setPeriod]     = useState('today');
  const [loading, setLoading]   = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    fetchPharmacyEarnings(hospitalId)
      .then(setEarnings)
      .catch(e => console.warn('Pharmacy Earnings error:', e.message))
      .finally(() => setLoading(false));
  }, [hospitalId]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const maxBar = earnings ? Math.max(...earnings.weekTrend, 1) : 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
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
                  {/* Only the peak is labelled - a number on every bar is noise. */}
                  <Text style={styles.barValue}>
                    {v > 0 && v === maxBar ? inr(v) : ''}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${(v / maxBar) * 100}%` }]} />
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.chartBaseline} />
            <View style={styles.chartAxis}>
              {earnings.weekLabels.map((l, i) => (
                <Text key={i} style={styles.barLabel} numberOfLines={1}>{l}</Text>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.primary, borderBottomLeftRadius: SIZES.header, borderBottomRightRadius: SIZES.header,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
  },
  headerLabel: { color: COLORS.white, fontSize: 20, fontWeight: '800', marginBottom: SPACING.m },
  periodRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 4, marginBottom: SPACING.l },
  periodTab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  periodTabActive: { backgroundColor: COLORS.white },
  periodText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  periodTextActive: { color: COLORS.primary },
  bigAmount: { color: COLORS.white, fontSize: 38, fontWeight: '800' },
  bigSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4, fontWeight: '500' },
  summaryRow: { flexDirection: 'row', gap: 12, marginHorizontal: 20, marginTop: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  summaryLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  summaryValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginHorizontal: 20, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, letterSpacing: -0.1 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, marginTop: SPACING.m },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValue: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '700', marginBottom: 6 },
  barTrack: { width: 12, flex: 1, justifyContent: 'flex-end' },
  // Rounded at the data end, square on the baseline: a fully rounded bar reads
  // as floating rather than measured from zero.
  barFill: {
    width: 12, backgroundColor: COLORS.primary, minHeight: 3,
    borderTopLeftRadius: 4, borderTopRightRadius: 4,
  },
  chartBaseline: { height: 1, backgroundColor: COLORS.border },
  chartAxis: { flexDirection: 'row', marginTop: 8 },
  barLabel: { flex: 1, fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', textAlign: 'center' },
});
