import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Clipboard, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const TEST_ACCOUNTS = [
  {
    role: 'Hospital Admin',
    icon: 'business',
    color: COLORS.primary,
    bg: COLORS.primarySoft,
    entries: [
      { label: 'Admin Phone', value: '9000000001' },
      { label: 'OTP (test)',  value: '1111' },
      { label: 'Role',        value: 'hospital_admin' },
    ],
  },
  {
    role: 'Doctor',
    icon: 'medkit',
    color: '#2563eb',
    bg: '#eff6ff',
    entries: [
      { label: 'Phone',      value: '9000000002' },
      { label: 'OTP (test)', value: '1111' },
      { label: 'Role',       value: 'doctor' },
      { label: 'Specialty',  value: 'General Physician' },
    ],
  },
  {
    role: 'Lab Technician',
    icon: 'flask',
    color: '#7c3aed',
    bg: '#f3e5f5',
    entries: [
      { label: 'Phone',      value: '9000000003' },
      { label: 'OTP (test)', value: '1111' },
      { label: 'Role',       value: 'lab_technician' },
      { label: 'Staff ID',   value: 'LT-XXXXX (auto-generated)' },
    ],
  },
  {
    role: 'Pharmacist',
    icon: 'medical',
    color: '#d97706',
    bg: '#fef3c7',
    entries: [
      { label: 'Phone',      value: '9000000004' },
      { label: 'OTP (test)', value: '1111' },
      { label: 'Role',       value: 'pharmacist' },
      { label: 'Staff ID',   value: 'PH-XXXXX (auto-generated)' },
    ],
  },
  {
    role: 'OPD / Receptionist',
    icon: 'people',
    color: '#059669',
    bg: '#d1fae5',
    entries: [
      { label: 'Phone',      value: '9000000005' },
      { label: 'OTP (test)', value: '1111' },
      { label: 'Role',       value: 'opd' },
    ],
  },
  {
    role: 'Healthcare Consultant',
    icon: 'walk',
    color: '#e11d48',
    bg: '#fff1f2',
    entries: [
      { label: 'Phone',       value: '9000000006' },
      { label: 'OTP (test)',  value: '1111' },
      { label: 'Role',        value: 'rmp' },
      { label: 'Note',        value: 'Sign up first, then log in' },
    ],
  },
];

const copy = (text) => {
  Clipboard.setString(text);
  Alert.alert('Copied', `"${text}" copied to clipboard.`);
};

function AccountCard({ account }) {
  return (
    <View style={[styles.card, { borderLeftColor: account.color, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBox, { backgroundColor: account.bg }]}>
          <Ionicons name={account.icon} size={20} color={account.color} />
        </View>
        <Text style={[styles.roleTitle, { color: account.color }]}>{account.role}</Text>
      </View>
      {account.entries.map(e => (
        <TouchableOpacity key={e.label} style={styles.entry} onPress={() => !e.value.includes('auto') && !e.value.includes('Sign') && copy(e.value)} activeOpacity={0.7}>
          <Text style={styles.entryLabel}>{e.label}</Text>
          <Text style={styles.entryValue}>{e.value}</Text>
          {!e.value.includes('auto') && !e.value.includes('Sign') && (
            <Ionicons name="copy-outline" size={14} color={COLORS.textSecondary} />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function DevPanel({ navigation }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Dev Panel</Text>
        <View style={styles.devBadge}><Text style={styles.devBadgeText}>DEV</Text></View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.notice}>
          <Ionicons name="information-circle" size={18} color={COLORS.primary} />
          <Text style={styles.noticeText}>
            All accounts use OTP <Text style={styles.bold}>1111</Text> in test mode. Phone numbers must be registered in Supabase before login works. Tap a value to copy it.
          </Text>
        </View>

        {TEST_ACCOUNTS.map(acc => (
          <AccountCard key={acc.role} account={acc} />
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Supabase Tables</Text>
          {[
            ['staff',            'Doctors, nurses, lab techs, pharmacists, OPD'],
            ['organisations',    'Hospitals / labs / pharmacies'],
            ['rmps',             'RMP partner accounts'],
            ['profiles',         'Patient profiles'],
            ['appointments',     'Bookings (includes rmp_id column)'],
            ['rmp_patients',     'RMP ↔ patient links'],
            ['rmp_commissions',  '₹60 per booking auto-credited'],
          ].map(([t, d]) => (
            <View key={t} style={styles.tableRow}>
              <Text style={styles.tableName}>{t}</Text>
              <Text style={styles.tableDesc}>{d}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Staff ID Prefixes</Text>
          {[['DR', 'Doctor'], ['NR', 'Nurse'], ['RC', 'Receptionist / OPD'], ['LT', 'Lab Technician'], ['PH', 'Pharmacist']].map(([prefix, label]) => (
            <View key={prefix} style={styles.tableRow}>
              <Text style={styles.tableName}>{prefix}-XXXXX</Text>
              <Text style={styles.tableDesc}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 16 : 20, paddingBottom: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.text },
  devBadge: { backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  devBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: 16 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: COLORS.primarySoft, borderRadius: 14, padding: 14, marginBottom: 16 },
  noticeText: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 18 },
  bold: { fontWeight: '700' },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  roleTitle: { fontSize: 15, fontWeight: '800' },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border + '60', gap: 6 },
  entryLabel: { width: 90, fontSize: 12.5, color: COLORS.textSecondary, fontWeight: '500' },
  entryValue: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  section: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginTop: 4, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  tableRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: COLORS.border + '60' },
  tableName: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  tableDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
});
