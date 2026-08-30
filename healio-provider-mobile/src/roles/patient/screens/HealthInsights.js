import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ApiService } from '../services/ApiService';

export default function HealthInsights({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    records: 0, labReports: 0, prescriptions: 0, upcoming: 0, past: 0, lastVisit: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const [records, appts] = await Promise.all([
          ApiService.getRecords(),
          ApiService.getAppointments(),
        ]);
        const labReports = records.filter(r => r.category === 'Lab Reports').length;
        const prescriptions = records.filter(r => r.category === 'Prescriptions').length;
        const upcoming = appts.filter(a => a.status === 'Upcoming').length;
        const pastAppts = appts.filter(a => a.status === 'Past');
        setStats({
          records: records.length,
          labReports,
          prescriptions,
          upcoming,
          past: pastAppts.length,
          lastVisit: pastAppts[0]?.date || null,
        });
      } catch (e) { /* keep zeros */ }
      finally { setLoading(false); }
    })();
  }, []);

  const metrics = [
    { name: 'Lab Reports', icon: 'flask-outline', value: String(stats.labReports), color: '#319795' },
    { name: 'Prescriptions', icon: 'document-text-outline', value: String(stats.prescriptions), color: '#673AB7' },
    { name: 'Upcoming Visits', icon: 'calendar-outline', value: String(stats.upcoming), color: '#2196F3' },
    { name: 'Past Visits', icon: 'checkmark-done-outline', value: String(stats.past), color: '#4CAF50' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health Insights</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Health Records</Text>
            <Text style={styles.summaryValue}>{stats.records}</Text>
            <Text style={styles.summaryTrend}>
              {stats.lastVisit ? `Last visit: ${stats.lastVisit}` : 'No visits yet'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Your Records</Text>
          <View style={styles.grid}>
            {metrics.map(cat => (
              <TouchableOpacity
                key={cat.name}
                style={styles.metricCard}
                onPress={() => navigation.navigate('ReportsHub')}
              >
                <View style={[styles.iconContainer, { backgroundColor: cat.color + '20' }]}>
                  <Ionicons name={cat.icon} size={24} color={cat.color} />
                </View>
                <Text style={styles.metricScore}>{cat.value}</Text>
                <Text style={styles.metricLabel}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.insightBox}>
            <Ionicons name="bulb-outline" size={24} color={COLORS.primary} />
            <View style={styles.insightTextContent}>
              <Text style={styles.insightTitle}>Tip</Text>
              <Text style={styles.insightDesc}>
                {stats.upcoming > 0
                  ? `You have ${stats.upcoming} upcoming appointment${stats.upcoming > 1 ? 's' : ''}. Tap a card to view your records.`
                  : 'Book a consultation to start building your health history.'}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { padding: SPACING.m },
  summaryCard: { backgroundColor: COLORS.primary, borderRadius: 20, padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.xl },
  summaryTitle: { color: COLORS.white, fontSize: 16, opacity: 0.9 },
  summaryValue: { color: COLORS.white, fontSize: 40, fontWeight: '800', marginVertical: 8 },
  summaryTrend: { color: '#B9F6CA', fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.m },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metricCard: { width: '48%', backgroundColor: COLORS.surface, borderRadius: 16, padding: SPACING.m, marginBottom: SPACING.m, alignItems: 'center' },
  iconContainer: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  metricScore: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  metricLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  insightBox: { flexDirection: 'row', backgroundColor: COLORS.secondary + '30', padding: SPACING.m, borderRadius: 16, marginTop: SPACING.m, alignItems: 'center' },
  insightTextContent: { flex: 1, marginLeft: 12 },
  insightTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  insightDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2, lineHeight: 18 },
});
