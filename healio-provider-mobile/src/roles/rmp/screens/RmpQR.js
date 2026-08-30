import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, SPACING } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';

export default function RmpQR({ navigation }) {
  const { user } = useAuth();
  const rmpId = user?.userId;
  const rmpName = user?.name || 'Healthcare Consultant';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My QR Code</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
        <View style={styles.qrCard}>
          <View style={styles.qrTop}>
            <View style={styles.logoBox}>
              <Ionicons name="person" size={18} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.qrName}>{rmpName}</Text>
              <Text style={styles.qrLicense}>Healthcare Consultant</Text>
            </View>
          </View>
          <View style={styles.qrFrame}>
            {rmpId
              ? <QRCode value={`healio:rmp:${rmpId}`} size={220} color={COLORS.primary} backgroundColor={COLORS.white} />
              : <Text style={styles.qrMissing}>Identity unavailable</Text>}
          </View>
          <Text style={styles.qrCaption}>Healio Healthcare Consultant Code</Text>
        </View>

        <TouchableOpacity style={styles.pendingBtn} onPress={() => navigation.navigate('Bookings')}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.white} />
          <Text style={styles.pendingBtnText}>Go to Bookings</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 16,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },
  qrCard: {
    width: '100%', backgroundColor: COLORS.white, borderRadius: 24, padding: 20, marginTop: SPACING.l,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 6,
  },
  qrTop: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginBottom: SPACING.l },
  logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  qrName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  qrLicense: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  qrFrame: { padding: 16, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, minHeight: 252, minWidth: 252, justifyContent: 'center', alignItems: 'center' },
  qrMissing: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  qrCaption: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginTop: SPACING.m, letterSpacing: 0.5 },
  pendingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, marginTop: SPACING.l, alignSelf: 'stretch',
  },
  pendingBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
