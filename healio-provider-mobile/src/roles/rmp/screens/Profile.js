import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { signOut } from '../../../lib/supabase';
import { fetchRmpStats } from '../services/api';

// `label` (English) drives the onPress dispatch; `labelKey` drives the display.
const MENU = [
  { icon: 'qr-code-outline', label: 'My QR Code', labelKey: 'profile_my_qr' },
  { icon: 'person-outline', label: 'Personal Information', labelKey: 'rmp_menu_personal' },
  { icon: 'shield-checkmark-outline', label: 'KYC & Documents', labelKey: 'rmp_menu_kyc' },
  { icon: 'card-outline', label: 'Payout Account', labelKey: 'rmp_menu_payout' },
  { icon: 'language-outline', label: 'Language', labelKey: 'welcome_lang_default' },
  { icon: 'help-circle-outline', label: 'Help & Support', labelKey: 'rmp_menu_help' },
];

export default function Profile({ navigation }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const rmpName = user?.name || t('rmp_role');
  const rmpId = user?.userId;
  const initials = rmpName.split(' ').map(n => n[0]).slice(0, 2).join('');

  const [stats, setStats] = useState({ patients: 0, bookings: 0 });

  const load = useCallback(async () => {
    if (!rmpId) return;
    try {
      const s = await fetchRmpStats(rmpId);
      setStats(s);
    } catch (e) {
      console.warn('Profile stats error:', e.message);
    }
  }, [rmpId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doLogout = async () => {
    try { await signOut(); } catch (_) {}
    logout();
    const rootNav = navigation?.getParent?.() ?? navigation;
    rootNav?.reset?.({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') { doLogout(); return; }
    Alert.alert(t('rmp_log_out'), t('rmp_logout_confirm_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('rmp_log_out'), style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('rmp_profile_title')} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <Avatar initials={initials} size={56} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{rmpName}, {t('rmp_role')}</Text>
            {user?.rmpPhone ? <Text style={styles.profileMeta}>{user.rmpPhone}</Text> : null}
            {user?.rmpEmail ? <Text style={styles.profileMeta}>{user.rmpEmail}</Text> : null}
            {(user?.rmpAddress || user?.rmpVillage) ? <Text style={styles.profileMeta}>{user.rmpAddress || user.rmpVillage}</Text> : null}
          </View>
          <StatusPill label="Verified" tone="success" />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.patients}</Text>
            <Text style={styles.statLabel}>{t('rmp_stat_patients')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.bookings}</Text>
            <Text style={styles.statLabel}>{t('rmp_stat_bookings')}</Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          {MENU.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, i > 0 && styles.menuRowBorder]}
              onPress={
                item.label === 'My QR Code' ? () => navigation.navigate('RmpQR')
                : item.label === 'Language' ? () => navigation.navigate('ChooseLanguage')
                : undefined
              }
            >
              <Ionicons name={item.icon} size={20} color={COLORS.primary} />
              <Text style={styles.menuLabel}>{t(item.labelKey)}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          <Text style={styles.logoutText}>{t('rmp_log_out')}</Text>
        </TouchableOpacity>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 16, marginTop: 18 },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 15.5, fontWeight: '700', color: COLORS.text },
  profileMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, height: 72, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  menuCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, marginTop: 14 },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 15, gap: 14 },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.border },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, backgroundColor: COLORS.dangerSoft, marginTop: 18 },
  logoutText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
});
