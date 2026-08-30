import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { signOut } from '../../../lib/supabase';
import { fetchDoctorAppointments, resolveDoctorContext, clearDoctorContext } from '../services/doctorData';

export default function Profile({ navigation }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [ctx, setCtx] = useState({});

  const load = useCallback(async () => {
    const [appts, dctx] = await Promise.all([fetchDoctorAppointments(), resolveDoctorContext()]);
    setAppointments(appts);
    setCtx(dctx);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const name       = user?.name || ctx.name || 'Doctor';
  const specialty  = ctx.specialty || 'Doctor';
  const department = ctx.department || 'General';
  const hospital   = user?.hospitalName || ctx.hospital || 'Hospital';
  const initials   = name.replace(/^Dr\.?\s*/i, '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const completed = appointments.filter(a => a.status === 'completed').length;
  const uniquePatients = new Set(appointments.map(a => a.patientId).filter(Boolean)).size;
  const rating = ctx.rating ? `${ctx.rating}★` : '—';

  const doLogout = async () => {
    try { await signOut(); } catch (_) {}
    clearDoctorContext();
    logout();
    const rootNav = navigation.getParent() ?? navigation;
    rootNav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') { doLogout(); return; }
    Alert.alert(t('logout'), t('doc_logout_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: doLogout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || 'DR'}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.specialty}>{specialty}</Text>
          <Text style={styles.hospital}>{hospital} · {department}</Text>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
            <Text style={styles.badgeText}>{t('doc_verified_badge')}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label={t('doc_stat_patients')} value={`${uniquePatients}`} icon="people-outline" />
          <StatBox label={t('doc_stat_appointments')} value={`${appointments.length}`} icon="calendar-outline" />
          <StatBox label={t('status_completed')} value={`${completed}`} icon="checkmark-circle-outline" />
          <StatBox label={t('doc_stat_rating')} value={rating} icon="star-outline" />
        </View>

        {/* Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('doc_professional_info')}</Text>
          <InfoRow icon="business-outline" label={t('doc_info_hospital')} value={hospital} />
          <InfoRow icon="medkit-outline" label={t('doc_info_department')} value={department} />
          <InfoRow icon="ribbon-outline" label={t('doc_info_specialty')} value={specialty} />
          {!!user?.hospitalCity && <InfoRow icon="location-outline" label={t('doc_info_city')} value={user.hospitalCity} />}
        </View>

        {/* Menu */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('doc_settings')}</Text>
          {/* Goes to the editor, not the read-only tab — a hospital doctor can
              now define their own sessions, same as the hospital can. */}
          <MenuItem icon="time-outline" label={t('doc_manage_schedule')} onPress={() => navigation.navigate('DoctorSchedule')} />
          <MenuItem icon="notifications-outline" label={t('doc_notif_prefs')} onPress={() => {}} />
          <MenuItem icon="lock-closed-outline" label={t('doc_change_password')} onPress={() => {}} />
          <MenuItem icon="help-circle-outline" label={t('rmp_menu_help')} onPress={() => {}} />
          <MenuItem icon="information-circle-outline" label={t('doc_about')} onPress={() => {}} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const StatBox = ({ label, value, icon }) => (
  <View style={styles.statBox}>
    <Ionicons name={icon} size={16} color={COLORS.primary} style={{ marginBottom: 4 }} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const MenuItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIcon}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
    </View>
    <Text style={styles.menuLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.primary, borderBottomLeftRadius: SIZES.header, borderBottomRightRadius: SIZES.header,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, alignItems: 'center',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  specialty: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '600' },
  hospital: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, marginTop: 12,
  },
  badgeText: { fontSize: 12, color: COLORS.white, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: -24, backgroundColor: COLORS.white,
    borderRadius: 20, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },
  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginHorizontal: 20,
    marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.hairline, gap: 10,
  },
  infoIcon: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  infoLabel: { width: 100, fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.hairline, gap: 12,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.dangerSoft,
    borderRadius: SIZES.radius, padding: 16, marginHorizontal: 20, marginBottom: 12, gap: 10,
    borderWidth: 1, borderColor: '#FEB2B2',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
});
