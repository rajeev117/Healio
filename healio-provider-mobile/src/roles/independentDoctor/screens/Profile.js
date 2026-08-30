import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { signOut } from '../../../lib/supabase';
import { fetchPlatformContent, openSupport, openLegal } from '../../../lib/platformContent';
import {
  fetchDoctorAppointments, resolveDoctorContext, clearDoctorContext,
  updateDoctorPublicProfile,
} from '../services/doctorData';

export default function Profile({ navigation }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [ctx, setCtx] = useState({});

  // Edit the public profile — what patients see on the booking page. An
  // individual doctor has no hospital admin to maintain this for them, so they
  // also own their specialty here, unlike a hospital doctor.
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState({ specialty: '', experience: '', qualifications: '', about: '', services: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [appts, dctx] = await Promise.all([fetchDoctorAppointments(), resolveDoctorContext()]);
    setAppointments(appts);
    setCtx(dctx);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openEdit = () => {
    setEditForm({
      specialty: ctx.specialty || '',
      experience: ctx.experienceYears != null ? String(ctx.experienceYears) : '',
      qualifications: ctx.qualifications || '',
      about: ctx.bio || '',
      services: (ctx.services || []).join(', '),
    });
    setEditVisible(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await updateDoctorPublicProfile({
        specialty: editForm.specialty,
        experienceYears: editForm.experience,
        qualifications: editForm.qualifications,
        bio: editForm.about,
        services: editForm.services,
      });
      setEditVisible(false);
      await load();
      Alert.alert(t('idoc_saved'), t('idoc_saved_msg'));
    } catch (e) {
      Alert.alert(t('idoc_save_failed'), e?.message || t('idoc_try_again'));
    } finally {
      setSaving(false);
    }
  };

  const name      = ctx.name || user?.name || t('idoc_doctor');
  const practice  = ctx.clinic || user?.hospitalName || t('idoc_my_practice');
  const specialty = ctx.specialty || t('idoc_general_physician');
  const city      = ctx.city || user?.hospitalCity || '';
  const initials  = name.replace(/^Dr\.?\s*/i, '').split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

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
    Alert.alert(t('idoc_logout'), t('idoc_logout_msg'), [
      { text: t('idoc_cancel'), style: 'cancel' },
      { text: t('idoc_logout'), style: 'destructive', onPress: doLogout },
    ]);
  };

  const profileIncomplete = !ctx.qualifications && !ctx.bio && ctx.experienceYears == null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.ring} pointerEvents="none" />
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || 'DR'}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.specialty}>{specialty}</Text>
          <Text style={styles.practice}>{practice}{city ? ` · ${city}` : ''}</Text>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.white} />
            <Text style={styles.badgeText}>{t('idoc_verified_independent')}</Text>
          </View>
        </View>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatBox label={t('idoc_patients')} value={`${uniquePatients}`} icon="people-outline" />
          <StatBox label={t('idoc_appointments')} value={`${appointments.length}`} icon="calendar-outline" />
          <StatBox label={t('idoc_completed')} value={`${completed}`} icon="checkmark-circle-outline" />
          <StatBox label={t('idoc_rating')} value={rating} icon="star-outline" />
        </View>

        {/* ── Nudge to finish the public profile ───────────────────────── */}
        {profileIncomplete && (
          <TouchableOpacity style={styles.nudge} onPress={openEdit}>
            <View style={styles.nudgeIcon}>
              <Ionicons name="sparkles-outline" size={17} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeTitle}>{t('idoc_complete_profile')}</Text>
              <Text style={styles.nudgeSub}>{t('idoc_complete_profile_sub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        {/* ── Practice info ────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('idoc_practice_info')}</Text>
          <InfoRow icon="business-outline" label={t('idoc_practice')} value={practice} />
          <InfoRow icon="ribbon-outline" label={t('idoc_specialty')} value={specialty} />
          {ctx.experienceYears != null && (
            <InfoRow icon="time-outline" label={t('idoc_experience')} value={`${ctx.experienceYears} ${t('idoc_yrs')}`} />
          )}
          {!!ctx.qualifications && (
            <InfoRow icon="school-outline" label={t('idoc_qualifications')} value={ctx.qualifications} />
          )}
          {!!(ctx.services || []).length && (
            <InfoRow icon="medkit-outline" label={t('idoc_treats')} value={(ctx.services || []).join(', ')} />
          )}
          {!!city && <InfoRow icon="location-outline" label={t('idoc_city')} value={city} />}
        </View>

        {/* ── Settings ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('idoc_settings')}</Text>
          <MenuItem icon="person-circle-outline" label={t('idoc_edit_public_profile')} onPress={openEdit} />
          <MenuItem icon="time-outline" label={t('idoc_manage_schedule')} onPress={() => navigation.navigate('DoctorSchedule')} />
          <MenuItem icon="qr-code-outline" label={t('idoc_my_qr')} onPress={() => navigation.navigate('DoctorQR')} />
          {/* Support & legal entries come from the Healio admin panel */}
          <MenuItem icon="help-circle-outline" label={t('idoc_help_support')}
            onPress={() => fetchPlatformContent('doctor').then(openSupport)} />
          <MenuItem icon="information-circle-outline" label={t('idoc_legal')}
            onPress={() => fetchPlatformContent('doctor').then(openLegal)} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>{t('idoc_logout')}</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>

      {/* ── Edit public profile ────────────────────────────────────────── */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('idoc_edit_public_profile')}</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>{t('idoc_edit_public_profile_sub')}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t('idoc_specialty')}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={t('idoc_specialty_ph')}
                placeholderTextColor={COLORS.textSecondary}
                value={editForm.specialty}
                onChangeText={v => setEditForm({ ...editForm, specialty: v })}
              />

              <Text style={styles.fieldLabel}>{t('idoc_experience_years')}</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="number-pad"
                maxLength={2}
                placeholder={t('idoc_experience_ph')}
                placeholderTextColor={COLORS.textSecondary}
                value={editForm.experience}
                onChangeText={v => setEditForm({ ...editForm, experience: v.replace(/\D/g, '') })}
              />

              <Text style={styles.fieldLabel}>{t('idoc_qualifications')}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={t('idoc_qualifications_ph')}
                placeholderTextColor={COLORS.textSecondary}
                value={editForm.qualifications}
                onChangeText={v => setEditForm({ ...editForm, qualifications: v })}
              />

              <Text style={styles.fieldLabel}>{t('idoc_treats')}</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder={t('idoc_treats_ph')}
                placeholderTextColor={COLORS.textSecondary}
                value={editForm.services}
                onChangeText={v => setEditForm({ ...editForm, services: v })}
              />
              <Text style={styles.fieldHint}>{t('idoc_treats_hint')}</Text>

              <Text style={styles.fieldLabel}>{t('idoc_about_you')}</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 90, textAlignVertical: 'top' }]}
                multiline
                placeholder={t('idoc_about_ph')}
                placeholderTextColor={COLORS.textSecondary}
                value={editForm.about}
                onChangeText={v => setEditForm({ ...editForm, about: v })}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSaveBtn, saving && { opacity: 0.6 }]}
              onPress={saveEdit}
              disabled={saving}
            >
              <Text style={styles.modalSaveText}>{saving ? t('idoc_saving') : t('idoc_save_profile')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const StatBox = ({ label, value, icon }) => (
  <View style={styles.statBox}>
    <Ionicons name={icon} size={15} color={COLORS.primary} style={{ marginBottom: 4 }} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
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
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface },

  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.headerRadiusLeft,
    borderBottomRightRadius: SIZES.headerRadiusRight,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    paddingBottom: 38,
    alignItems: 'center',
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute', top: -78, right: -58,
    width: 186, height: 186, borderRadius: 93,
    borderWidth: 30, borderColor: 'rgba(255,255,255,0.09)',
  },
  avatar: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.28)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 23, fontWeight: '900', color: COLORS.white },
  name: { fontSize: 21, fontWeight: '900', color: COLORS.white, textAlign: 'center' },
  specialty: { fontSize: 13.5, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '700' },
  practice: { fontSize: 11.5, color: 'rgba(255,255,255,0.65)', marginTop: 4, textAlign: 'center' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, marginTop: 12,
  },
  badgeText: { fontSize: 11.5, color: COLORS.white, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row', marginHorizontal: 16, marginTop: -22, backgroundColor: COLORS.white,
    borderRadius: SIZES.radiusLg, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statValue: { fontSize: 15.5, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 9.5, color: COLORS.textSecondary, marginTop: 2, fontWeight: '600' },

  nudge: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.warningSoft, marginHorizontal: 16, marginBottom: 12,
    borderRadius: SIZES.radius, borderWidth: 1, borderColor: '#f0d9a8', padding: 14,
  },
  nudgeIcon: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  nudgeTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.text },
  nudgeSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },

  card: {
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 16,
    marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoIcon: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  infoLabel: { width: 100, fontSize: 12.5, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 12.5, fontWeight: '600', color: COLORS.text },

  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  menuLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.text },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.dangerSoft, borderRadius: SIZES.radius, padding: 16,
    marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f3c9c9',
  },
  logoutText: { fontSize: 14.5, fontWeight: '800', color: COLORS.error },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 16.5, fontWeight: '900', color: COLORS.text },
  modalSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  fieldLabel: {
    fontSize: 10.5, fontWeight: '800', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13.5, color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  fieldHint: { fontSize: 10.5, color: COLORS.textSecondary, marginTop: 4 },
  modalSaveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 15,
    alignItems: 'center', marginTop: 16,
  },
  modalSaveText: { fontSize: 14.5, fontWeight: '800', color: COLORS.white },
});
