import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../../../context/AuthContext';
import { fetchRmpEarnings } from '../services/api';

export default function Earnings() {
  const { user } = useAuth();
  const rmpId = user?.userId;
  const [commission, setCommission] = useState({ thisMonth: 0, growthPct: 0, bookings: 0, perBooking: 60, withdrawable: 0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!rmpId) return;
    setLoading(true);
    try {
      const data = await fetchRmpEarnings(rmpId);
      setCommission(data.commission);
      setHistory(data.history);
    } catch (e) {
      console.warn('Earnings load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [rmpId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Earnings" />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>PARTNER INCENTIVE THIS MONTH</Text>
          <Text style={styles.heroAmount}>₹{commission.thisMonth.toLocaleString('en-IN')}</Text>
          <Text style={styles.heroMeta}>
            {commission.growthPct >= 0 ? '↑' : '↓'} {Math.abs(commission.growthPct)}% vs last month  ·  {commission.bookings} bookings
          </Text>
          <TouchableOpacity style={styles.withdrawBtn}>
            <Text style={styles.withdrawText}>Withdraw ₹{commission.withdrawable}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoNum}>₹{commission.perBooking}</Text>
            <Text style={styles.infoLabel}>Per booking</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoNum}>₹{commission.withdrawable}</Text>
            <Text style={styles.infoLabel}>Withdrawable</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>HISTORY</Text>
        {history.length === 0 ? (
          <Text style={styles.empty}>No earnings yet.</Text>
        ) : history.map(entry => {
          const isCredit = entry.type === 'credit';
          return (
            <View key={entry.id} style={styles.entryRow}>
              <View style={[styles.entryIcon, { backgroundColor: isCredit ? COLORS.successSoft : COLORS.mutedSoft }]}>
                <Ionicons
                  name={isCredit ? 'arrow-down-outline' : 'arrow-up-outline'}
                  size={16}
                  color={isCredit ? COLORS.success : COLORS.textSecondary}
                />
              </View>
              <View style={styles.entryInfo}>
                <Text style={styles.entryLabel}>{entry.label}</Text>
                <Text style={styles.entryDate}>{entry.date}</Text>
              </View>
              <Text style={[styles.entryAmount, { color: isCredit ? COLORS.success : COLORS.text }]}>
                {isCredit ? '+' : '−'}₹{entry.amount}
              </Text>
            </View>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  heroCard: { backgroundColor: COLORS.primary, borderRadius: 18, padding: 20, marginTop: 18 },
  heroLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },
  heroAmount: { fontSize: 34, fontWeight: '700', color: COLORS.white, marginTop: 4 },
  heroMeta: { fontSize: 12.5, fontWeight: '500', color: 'rgba(255,255,255,0.85)', marginTop: 8 },
  withdrawBtn: { backgroundColor: COLORS.white, borderRadius: 16, height: 32, alignSelf: 'flex-start', paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  withdrawText: { fontSize: 12.5, fontWeight: '600', color: COLORS.primary },
  infoRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  infoCard: { flex: 1, height: 72, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  infoNum: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  infoLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  sectionLabel: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.6, marginTop: 26, marginBottom: 6 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  entryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  entryInfo: { flex: 1, marginLeft: 12 },
  entryLabel: { fontSize: 13.5, fontWeight: '600', color: COLORS.text },
  entryDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  entryAmount: { fontSize: 14, fontWeight: '700' },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 30, fontSize: 13.5 },
});
