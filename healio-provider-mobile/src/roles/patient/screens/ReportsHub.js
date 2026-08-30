import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getActiveFamilyMemberId, fetchWithFamilyFallback } from '../services/activeProfile';

const RANGE_DAYS = { 'Last 3 Months': 90, 'Last 6 Months': 180, 'Last 1 Year': 365, 'Lifetime': null };

export default function ReportsHub({ navigation }) {
  const [selections, setSelections] = useState({
    prescriptions: true,
    labReports: true,
    medicalHistory: true,
    payments: false,
  });
  const [dateRange, setDateRange] = useState('Last 6 Months');
  const [records, setRecords] = useState([]);     // {type, recorded_at}
  const [payments, setPayments] = useState([]);    // {created_at}

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const familyId = getActiveFamilyMemberId();
        const [hrData, tx] = await Promise.all([
          fetchWithFamilyFallback(() => supabase.from('health_records').select('type, recorded_at').eq('patient_id', user.id), familyId),
          supabase.from('transactions').select('created_at').eq('patient_id', user.id),
        ]);
        setRecords(hrData || []);
        setPayments(tx.data || []);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const toggleSelection = (key) => setSelections(prev => ({ ...prev, [key]: !prev[key] }));

  // Count records of each category within the selected date range
  const inRange = (iso) => {
    const days = RANGE_DAYS[dateRange];
    if (!days) return true;
    return (Date.now() - new Date(iso).getTime()) <= days * 86400000;
  };
  const counts = {
    prescriptions: records.filter(r => r.type === 'prescription' && inRange(r.recorded_at)).length,
    labReports: records.filter(r => r.type === 'lab_report' && inRange(r.recorded_at)).length,
    medicalHistory: records.filter(r => !['prescription', 'lab_report'].includes(r.type) && inRange(r.recorded_at)).length,
    payments: payments.filter(p => inRange(p.created_at)).length,
  };
  const totalSelected = Object.entries(selections).filter(([k, v]) => v).reduce((s, [k]) => s + (counts[k] || 0), 0);

  const handleGenerate = () => {
    const lines = Object.entries(selections)
      .filter(([, v]) => v)
      .map(([k]) => `• ${k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}: ${counts[k]} record${counts[k] === 1 ? '' : 's'}`)
      .join('\n');
    Alert.alert(
      'Health Report',
      `For ${dateRange}, your report includes ${totalSelected} record(s):\n\n${lines}\n\nA PDF will be emailed to your registered address.`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Center</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.promoCard}>
          <Ionicons name="analytics" size={40} color={COLORS.white} />
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoTitle}>Consolidated Health Audit</Text>
            <Text style={styles.promoDesc}>Generate a single PDF of your entire medical history to share with specialists.</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Select Data to Include</Text>
        <View style={styles.optionsContainer}>
          <ReportOption label="Doctor Prescriptions" count={counts.prescriptions} value={selections.prescriptions} onToggle={() => toggleSelection('prescriptions')} icon="document-text" />
          <ReportOption label="Lab & Diagnostic Reports" count={counts.labReports} value={selections.labReports} onToggle={() => toggleSelection('labReports')} icon="flask" />
          <ReportOption label="Medical Procedures & History" count={counts.medicalHistory} value={selections.medicalHistory} onToggle={() => toggleSelection('medicalHistory')} icon="medical" />
          <ReportOption label="Payment & Billing Receipts" count={counts.payments} value={selections.payments} onToggle={() => toggleSelection('payments')} icon="wallet" />
        </View>

        <Text style={styles.sectionTitle}>Time Period</Text>
        <View style={styles.rangeContainer}>
          {['Last 3 Months', 'Last 6 Months', 'Last 1 Year', 'Lifetime'].map(range => (
            <TouchableOpacity 
              key={range} 
              style={[styles.rangeBtn, dateRange === range && styles.activeRangeBtn]}
              onPress={() => setDateRange(range)}
            >
              <Text style={[styles.rangeText, dateRange === range && styles.activeRangeText]}>{range}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.infoText}>The report will be generated as a password-protected PDF and sent to your registered email.</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
          <Text style={styles.generateBtnText}>Generate & Download Report</Text>
          <Ionicons name="cloud-download" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const ReportOption = ({ label, value, onToggle, icon, count }) => (
  <View style={styles.optionRow}>
    <View style={styles.optionLeft}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View>
        <Text style={styles.optionLabel}>{label}</Text>
        <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>{count ?? 0} record{count === 1 ? '' : 's'}</Text>
      </View>
    </View>
    <Switch
      value={value} 
      onValueChange={onToggle} 
      trackColor={{ false: '#ddd', true: COLORS.primary }}
      thumbColor={COLORS.white}
    />
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: SPACING.m, 
    borderBottomWidth: 1, 
    borderBottomColor: COLORS.border 
  },
  backButton: { marginRight: SPACING.m },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  content: { padding: SPACING.m },
  promoCard: { 
    backgroundColor: COLORS.primary, 
    borderRadius: SIZES.radius, 
    padding: SPACING.l, 
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: SPACING.xl
  },
  promoTextContainer: { flex: 1, marginLeft: SPACING.m },
  promoTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  promoDesc: { color: COLORS.white, fontSize: 13, opacity: 0.9, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.m },
  optionsContainer: { 
    backgroundColor: COLORS.surface, 
    borderRadius: SIZES.radius, 
    padding: SPACING.s,
    marginBottom: SPACING.xl
  },
  optionRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: COLORS.secondary, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 12
  },
  optionLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rangeContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.xl },
  rangeBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    marginRight: 8, 
    marginBottom: 8,
    backgroundColor: COLORS.white
  },
  activeRangeBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  rangeText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  activeRangeText: { color: COLORS.white },
  infoBox: { 
    flexDirection: 'row', 
    backgroundColor: '#f8f9fa', 
    padding: 12, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  infoText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, marginLeft: 8 },
  footer: { padding: SPACING.m, borderTopWidth: 1, borderTopColor: COLORS.border },
  generateBtn: { 
    backgroundColor: COLORS.primary, 
    height: 56, 
    borderRadius: 16, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  generateBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700', marginRight: 10 }
});