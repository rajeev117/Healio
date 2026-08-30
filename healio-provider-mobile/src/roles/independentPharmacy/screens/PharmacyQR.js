// The counter QR.
//
// The payload is `healio:pharmacy:<organisationId>`, exactly what
// resolve_provider_qr (migration-043) already resolves — it accepts kind
// 'pharmacy' and looks the id up in `organisations` without checking the org's
// type. So an independent pharmacy's code works through the patient app's
// existing scan → check-in path with no change on either side. The check-in is
// also what unlocks the patient's prescriptions for this counter, via
// checkin_prescriptions.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import AppBar from '../components/AppBar';

export default function PharmacyQR({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hospitalId: orgId, hospitalName } = user || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar title="My QR code" subtitle="Patients scan this at your counter" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center', padding: 20 }}
      >
        <View style={styles.qrCard}>
          <View style={styles.qrTop}>
            <View style={styles.logoBox}><Ionicons name="medkit" size={18} color={COLORS.white} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qrName} numberOfLines={1}>{hospitalName}</Text>
              <Text style={styles.qrKind}>Independent pharmacy</Text>
            </View>
          </View>

          <View style={styles.qrFrame}>
            <QRCode value={`healio:pharmacy:${orgId}`} size={220} color={COLORS.primary} backgroundColor={COLORS.white} />
          </View>

          <Text style={styles.qrCaption}>HEALIO PHARMACY CODE</Text>
        </View>

        <View style={styles.explain}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.explainText}>
            When a patient scans this, they consent to share their prescriptions with you for 24 hours —
            and they appear on your home screen straight away.
          </Text>
        </View>

        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Main', { screen: 'Orders' })}>
          <Ionicons name="receipt-outline" size={18} color={COLORS.white} />
          <Text style={styles.ctaText}>Go to orders</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.l + insets.bottom }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: COLORS.surface },
  qrCard: {
    width: '100%', backgroundColor: COLORS.white, borderRadius: SIZES.radiusXl, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    elevation: 3, shadowColor: '#821c03', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12,
  },
  qrTop: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginBottom: SPACING.l },
  logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  qrName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  qrKind: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  qrFrame: { padding: 16, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  qrCaption: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, marginTop: SPACING.m, letterSpacing: 1.2 },
  explain: {
    flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: SPACING.m,
    backgroundColor: COLORS.primarySoft, borderRadius: SIZES.radiusLg, padding: 14,
  },
  explainText: { flex: 1, fontSize: 11.5, color: '#a1736a', lineHeight: 17 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius, padding: 15,
    marginTop: SPACING.m, alignSelf: 'stretch',
  },
  ctaText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
