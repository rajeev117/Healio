import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';
import AppBar from '../components/AppBar';
import { resolveDoctorContext } from '../services/doctorData';

// The doctor's static QR: `healio:doctor:<staff row uuid>`. A patient scans it
// to check in — their identity is then visible to this doctor (migration-043).
// Same payload the hospital doctor module uses, so one scanner handles both.
export default function DoctorQR({ navigation }) {
  const { t } = useLanguage();
  const [ctx, setCtx] = useState(null);

  useFocusEffect(useCallback(() => {
    resolveDoctorContext().then(setCtx);
  }, []));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar title={t('idoc_my_qr')} onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        <View style={styles.qrCard}>
          <View style={styles.qrTop}>
            <View style={styles.logoBox}>
              <Ionicons name="medkit" size={18} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qrName} numberOfLines={1}>{ctx?.name || t('idoc_doctor')}</Text>
              <Text style={styles.qrSub} numberOfLines={1}>
                {ctx?.specialty || t('idoc_general_physician')}{ctx?.city ? ` · ${ctx.city}` : ''}
              </Text>
            </View>
          </View>

          <View style={styles.qrFrame}>
            {ctx?.staffId
              ? <QRCode value={`healio:doctor:${ctx.staffId}`} size={220} color={COLORS.primary} backgroundColor={COLORS.white} />
              : <Text style={styles.qrMissing}>{t('idoc_identity_unavailable')}</Text>}
          </View>

          <Text style={styles.qrCaption}>{t('idoc_qr_caption')}</Text>
        </View>

        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.hintText}>{t('idoc_qr_hint')}</Text>
        </View>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },

  qrCard: {
    width: '100%', backgroundColor: COLORS.white, borderRadius: SIZES.radiusXl,
    padding: 20, marginTop: SPACING.l, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },
  qrTop: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginBottom: SPACING.l },
  logoBox: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  qrName: { fontSize: 15.5, fontWeight: '800', color: COLORS.text },
  qrSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  qrFrame: {
    padding: 16, backgroundColor: COLORS.white, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    minHeight: 252, minWidth: 252, justifyContent: 'center', alignItems: 'center',
  },
  qrMissing: { fontSize: 12.5, color: COLORS.textSecondary, textAlign: 'center' },
  qrCaption: {
    fontSize: 11.5, fontWeight: '800', color: COLORS.textSecondary,
    marginTop: SPACING.m, letterSpacing: 0.5,
  },

  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: SPACING.m,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: SIZES.radius, padding: 12, alignSelf: 'stretch',
  },
  hintText: { flex: 1, fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 17 },
});
