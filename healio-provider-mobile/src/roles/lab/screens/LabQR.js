import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import QRCode from 'react-native-qrcode-svg';

export default function LabQR({ navigation }) {
  const { user } = useAuth();
  const { hospitalId, hospitalName } = user || {};

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My QR code</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
        <View style={styles.qrCard}>
          <View style={styles.qrTop}>
            <View style={styles.logoBox}>
              <Ionicons name="flask" size={18} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.qrLab}>{hospitalName}</Text>
              <Text style={styles.qrLicense}>Lab Department</Text>
            </View>
          </View>
          <View style={styles.qrFrame}>
            <QRCode value={`healio:lab:${hospitalId}`} size={220} color={COLORS.primary} backgroundColor={COLORS.white} />
          </View>
          <Text style={styles.qrCaption}>Healio Lab Code</Text>
        </View>

        <TouchableOpacity style={styles.pendingBtn} onPress={() => navigation.navigate('Main', { screen: 'Prescriptions' })}>
          <Ionicons name="document-text-outline" size={18} color={COLORS.white} />
          <Text style={styles.pendingBtnText}>Go to Lab Orders</Text>
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
    justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },
  qrCard: {
    width: '100%', backgroundColor: COLORS.white, borderRadius: 24, padding: 20, marginTop: SPACING.l,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  qrTop: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginBottom: SPACING.l },
  logoBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  qrLab: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  qrLicense: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  qrFrame: { padding: 16, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  qrCaption: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginTop: SPACING.m, letterSpacing: 0.5 },
  pendingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, marginTop: SPACING.l, alignSelf: 'stretch',
  },
  pendingBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
