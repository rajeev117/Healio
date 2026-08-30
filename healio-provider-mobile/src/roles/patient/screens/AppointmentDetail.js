import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';

// Opened from the Home "Next appointment" banner. Shows the booked visit's
// details, then a QR-scan call-to-action so the patient checks in on arrival
// to start their journey (Arrived → Checked In → …), handled by QRScanHub.
export default function AppointmentDetail({ route, navigation }) {
  const apt = route?.params?.appointment || {};
  const initials = (apt.doctorName || 'Dr')
    .replace(/^Dr\.?\s*/i, '')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const statusStyle = STATUS_STYLES[apt.status] || STATUS_STYLES.Upcoming;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointment</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Doctor / summary card */}
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || 'DR'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.doctorName}>{apt.doctorName || 'Doctor'}</Text>
              {!!apt.specialty && <Text style={styles.specialty}>{apt.specialty}</Text>}
            </View>
            <View style={[styles.statusPill, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.color }]}>
                {apt.status || 'Upcoming'}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <InfoRow icon="calendar-outline" label="Date" value={apt.date || '—'} />
          <InfoRow icon="time-outline" label="Time" value={apt.time || '—'} />
          <InfoRow icon="medkit-outline" label="Type" value={apt.type || 'Clinic Visit'} />
          {!!apt.location && <InfoRow icon="business-outline" label="Location" value={apt.location} last />}
        </View>

        {/* Start-journey call to action */}
        <View style={styles.journeyCard}>
          <View style={styles.journeyIcon}>
            <Ionicons name="qr-code-outline" size={26} color={COLORS.primary} />
          </View>
          <Text style={styles.journeyTitle}>Scan QR to start journey</Text>
          <Text style={styles.journeyNote}>
            When you arrive, scan the hospital or clinic's QR code to check in and begin your visit.
          </Text>
          <TouchableOpacity
            style={styles.scanBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('QRScanHub', { mode: 'scan' })}
          >
            <Ionicons name="scan-outline" size={20} color={COLORS.white} />
            <Text style={styles.scanBtnText}>Scan QR</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const InfoRow = ({ icon, label, value, last }) => (
  <View style={[styles.infoRow, last && { borderBottomWidth: 0 }]}>
    <View style={styles.infoIconBox}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const STATUS_STYLES = {
  Upcoming:  { bg: COLORS.infoSoft, color: '#2b6cb0' },
  Past:      { bg: COLORS.mutedSoft, color: COLORS.textSecondary },
  Cancelled: { bg: COLORS.dangerSoft, color: COLORS.error },
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  body: { padding: SPACING.m, gap: SPACING.m },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: SPACING.m,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  doctorName: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  specialty: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.m },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.border + '80',
  },
  infoIconBox: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, width: 74, fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text, textAlign: 'right' },

  journeyCard: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: SPACING.l,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  journeyIcon: {
    width: 58, height: 58, borderRadius: 29, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.m,
  },
  journeyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  journeyNote: {
    fontSize: 13, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 19, marginTop: 6, marginBottom: SPACING.l, paddingHorizontal: 8,
  },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius,
    paddingVertical: 15, paddingHorizontal: 28, alignSelf: 'stretch',
  },
  scanBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
});
