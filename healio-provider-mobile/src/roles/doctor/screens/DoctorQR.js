import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, SPACING } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';
import { resolveDoctorContext } from '../services/doctorData';

// The doctor's static QR: `healio:doctor:<staff row uuid>`. A patient scans it
// to check in — their identity is then visible to this doctor (migration-043).
export default function DoctorQR({ navigation }) {
  const { t } = useLanguage();
  const [ctx, setCtx] = useState(null);

  useFocusEffect(useCallback(() => {
    resolveDoctorContext().then(setCtx);
  }, []));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile_my_qr')}</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
        <View style={styles.qrCard}>
          <View style={styles.qrTop}>
            <View style={styles.logoBox}>
              <Ionicons name="medkit" size={18} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.qrName}>{ctx?.name || 'Doctor'}</Text>
              <Text style={styles.qrSub}>{ctx?.hospital || 'Hospital'}{ctx?.department ? ` · ${ctx.department}` : ''}</Text>
            </View>
          </View>
          <View style={styles.qrFrame}>
            {ctx?.staffId
              ? <QRCode value={`healio:doctor:${ctx.staffId}`} size={220} color={COLORS.primary} backgroundColor={COLORS.white} />
              : <Text style={styles.qrMissing}>{t('doc_identity_unavailable')}</Text>}
          </View>
          <Text style={styles.qrCaption}>Healio {t('doc_qr_caption_label')}</Text>
        </View>

        <View style={styles.hintBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.hintText}>
            {t('doc_qr_hint')}
          </Text>
        </View>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 16,
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
  qrSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  qrFrame: { padding: 16, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, minHeight: 252, minWidth: 252, justifyContent: 'center', alignItems: 'center' },
  qrMissing: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  qrCaption: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginTop: SPACING.m, letterSpacing: 0.5 },
  hintBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: SPACING.m,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, padding: 12, alignSelf: 'stretch',
  },
  hintText: { flex: 1, fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
});
