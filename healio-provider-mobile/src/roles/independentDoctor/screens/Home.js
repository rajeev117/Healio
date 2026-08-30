import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import ShutterToggle from '../components/ShutterToggle';
import {
  fetchDoctorAppointments, resolveDoctorContext,
  fetchDoctorCheckins, dismissDoctorCheckin,
} from '../services/doctorData';

const calcAge = (dob) =>
  dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

const initialsOf = (name) =>
  (name || '?').replace(/^Dr\.?\s*/i, '').split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

export default function Home({ navigation }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [appointments, setAppointments] = useState([]);
  const [ctx, setCtx] = useState({});
  const [checkins, setCheckins] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [appts, dctx, cks] = await Promise.all([
        fetchDoctorAppointments(), resolveDoctorContext(), fetchDoctorCheckins(),
      ]);
      setAppointments(appts);
      setCtx(dctx);
      setCheckins(cks);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDismissCheckin = (id) => {
    setCheckins(prev => prev.filter(c => c.id !== id));
    dismissDoctorCheckin(id);
  };

  const timeAgo = (iso) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return t('idoc_just_now');
    if (mins < 60) return t('idoc_mins_ago', { n: mins });
    const hrs = Math.round(mins / 60);
    return hrs < 24 ? t('idoc_hours_ago', { n: hrs }) : t('idoc_days_ago', { n: Math.round(hrs / 24) });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('idoc_good_morning');
    if (h < 17) return t('idoc_good_afternoon');
    return t('idoc_good_evening');
  };

  const doctorName = ctx.name || user?.name || t('idoc_doctor');
  const practice   = ctx.clinic || user?.hospitalName || t('idoc_my_practice');
  const specialty  = ctx.specialty || t('idoc_general_physician');
  const city       = ctx.city || user?.hospitalCity || '';

  const todayApts  = appointments.filter(a => a.isToday);
  const nextApt    = todayApts.find(a => a.status === 'confirmed');
  const completed  = todayApts.filter(a => a.status === 'completed').length;
  const remaining  = todayApts.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length;
  // A solo doctor accepts their own bookings — this is the queue that needs them.
  const pending    = appointments.filter(a => a.status === 'pending' && !a.isPast).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />
        }
      >
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.ring} pointerEvents="none" />

          <View style={styles.idRow}>
            <TouchableOpacity style={styles.idLeft} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(doctorName) || 'DR'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>{greeting()}</Text>
                <Text style={styles.doctorName} numberOfLines={1}>{doctorName}</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.idRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('DoctorQR')}>
                <Ionicons name="qr-code-outline" size={20} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Appointments')}>
                <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
                {(pending > 0 || checkins.length > 0) && <View style={styles.notifDot} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.heroTitle} numberOfLines={1}>{practice}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}><Text style={styles.badgeText}>{t('idoc_independent_doctor')}</Text></View>
              <Text style={styles.heroSub} numberOfLines={1}>{specialty}{city ? ` · ${city}` : ''}</Text>
            </View>
          </View>

          <View style={styles.strip}>
            <Stat value={todayApts.length} label={t('idoc_today')}     tint="#ffd27d" />
            <View style={styles.stripDivider} />
            <Stat value={completed}        label={t('idoc_completed')} tint="#9ae6b4" />
            <View style={styles.stripDivider} />
            <Stat value={remaining}        label={t('idoc_remaining')} tint="#fbb6a3" />
          </View>
        </View>

        {/* ── Shutter — am I consulting right now? ──────────────────────── */}
        <View style={styles.shutterCard}>
          <ShutterToggle
            storageKey="@healio_idoctor_shutter"
            openLabel={t('idoc_accepting_patients')}
            closedLabel={t('idoc_not_consulting')}
          />
        </View>

        {/* ── Waiting on me ────────────────────────────────────────────── */}
        {pending > 0 && (
          <TouchableOpacity style={styles.pendingBanner} onPress={() => navigation.navigate('Appointments')}>
            <View style={styles.pendingIcon}>
              <Ionicons name="hourglass-outline" size={18} color={COLORS.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>{t('idoc_pending_title', { n: pending })}</Text>
              <Text style={styles.pendingSub}>{t('idoc_pending_sub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        {/* ── Quick actions ────────────────────────────────────────────── */}
        <View style={styles.quickGrid}>
          <QuickAction icon="calendar" label={t('idoc_appointments')} bg={COLORS.tintGold} color={COLORS.tintGoldInk}
            onPress={() => navigation.navigate('Appointments')} />
          <QuickAction icon="time" label={t('idoc_schedule')} bg={COLORS.tintTeal} color={COLORS.tintTealInk}
            onPress={() => navigation.navigate('Schedule')} />
          <QuickAction icon="flask" label={t('idoc_refer')} bg={COLORS.tintBlue} color={COLORS.tintBlueInk}
            onPress={() => navigation.navigate('Referrals')} />
          <QuickAction icon="document-text" label={t('idoc_prescribe')} bg={COLORS.tintViolet} color={COLORS.tintVioletInk}
            onPress={() => navigation.navigate('UploadPrescription', { appointment: nextApt })} />
        </View>

        {/* ── Checked-in patients (scanned my QR) ──────────────────────── */}
        {checkins.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('idoc_checked_in')}</Text>
            {checkins.map(c => {
              const age = calcAge(c.patient?.date_of_birth);
              return (
                <View key={c.id} style={[styles.row, { borderLeftColor: COLORS.tintTealInk }]}>
                  <View style={styles.rowAvatar}>
                    <Text style={styles.rowAvatarText}>{initialsOf(c.patient?.name)}</Text>
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{c.patient?.name || t('idoc_patient')}</Text>
                    <Text style={styles.rowMeta}>
                      {age ? `${age} ${t('idoc_yrs')} · ` : ''}{c.patient?.gender || ''}{c.patient?.phone ? ` · ${c.patient.phone}` : ''}
                    </Text>
                    <Text style={styles.rowMeta}>{t('idoc_scanned_qr')} · {timeAgo(c.created_at)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDismissCheckin(c.id)} style={{ padding: 6 }} hitSlop={8}>
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Next patient ─────────────────────────────────────────────── */}
        {nextApt && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('idoc_next_patient')}</Text>
            <TouchableOpacity
              style={styles.nextCard}
              onPress={() => navigation.navigate('AppointmentDetail', { appointment: nextApt })}
            >
              <View style={styles.nextAvatar}>
                <Text style={styles.nextAvatarText}>{initialsOf(nextApt.patientName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nextName}>{nextApt.patientName}</Text>
                <Text style={styles.rowMeta}>
                  {nextApt.patientAge}{nextApt.patientAge !== '—' ? ` ${t('idoc_yrs')}` : ''} · {nextApt.patientGender}
                </Text>
                <Text style={styles.nextReason}>{nextApt.reason}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={styles.nextTime}>{nextApt.time}</Text>
                <TypeTag type={nextApt.type} t={t} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Today's list ─────────────────────────────────────────────── */}
        <View style={[styles.section, { marginBottom: SPACING.xl * 2 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('idoc_todays_appointments')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
              <Text style={styles.seeAll}>{t('idoc_see_all')}</Text>
            </TouchableOpacity>
          </View>
          {todayApts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={40} color={COLORS.borderStrong} />
              <Text style={styles.emptyText}>{t('idoc_no_appointments_today')}</Text>
            </View>
          ) : todayApts.map(apt => (
            <TouchableOpacity
              key={apt.id}
              style={[styles.row, { borderLeftColor: railFor(apt.status) }]}
              onPress={() => navigation.navigate('AppointmentDetail', { appointment: apt })}
            >
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>{apt.time}</Text>
                <View style={[styles.statusDot, { backgroundColor: railFor(apt.status) }]} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{apt.patientName}</Text>
                <Text style={styles.rowMeta}>{apt.reason}</Text>
              </View>
              <TypeTag type={apt.type} t={t} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// The 3px state-coloured leading rail that marks every independent list row.
const railFor = (status) => (
  status === 'completed' ? COLORS.success
    : status === 'cancelled' ? COLORS.error
      : status === 'pending' ? COLORS.warning
        : COLORS.tintBlueInk
);

const Stat = ({ value, label, tint }) => (
  <View style={styles.statCol}>
    <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QuickAction = ({ icon, label, bg, color, onPress }) => (
  <TouchableOpacity style={styles.quickCard} onPress={onPress}>
    <View style={[styles.quickIcon, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={22} color={color} />
    </View>
    <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

const TypeTag = ({ type, t }) => {
  const isVideo = type === 'Video';
  return (
    <View style={[styles.typeTag, isVideo && { backgroundColor: COLORS.infoSoft }]}>
      <Text style={[styles.typeTagText, isVideo && { color: COLORS.tintBlueInk }]}>
        {isVideo ? t('idoc_video') : t('idoc_in_person')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface },

  hero: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.headerRadiusLeft,
    borderBottomRightRadius: SIZES.headerRadiusRight,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute', top: -70, right: -54,
    width: 190, height: 190, borderRadius: 95,
    borderWidth: 30, borderColor: 'rgba(255,255,255,0.10)',
  },
  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  idLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
  doctorName: { color: COLORS.white, fontSize: 16, fontWeight: '700', marginTop: 1 },
  idRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.13)', justifyContent: 'center', alignItems: 'center',
  },
  notifDot: {
    position: 'absolute', top: 9, right: 10,
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#ffb020',
  },

  heroBody: { marginTop: SPACING.l, marginBottom: SPACING.m },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white, letterSpacing: -0.4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  badgeText: { fontSize: 10.5, fontWeight: '700', color: COLORS.white, letterSpacing: 0.2 },
  heroSub: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.72)' },

  strip: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: SIZES.radiusLg, paddingVertical: 14,
  },
  statCol: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 10.5, color: 'rgba(255,255,255,0.72)', marginTop: 3, fontWeight: '600' },
  stripDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 6 },

  shutterCard: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: -18,
    borderRadius: SIZES.radiusLg, borderWidth: 1, borderColor: COLORS.border,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },

  pendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.warningSoft, marginHorizontal: 16, marginTop: 12,
    borderRadius: SIZES.radius, borderWidth: 1, borderColor: '#f0d9a8', padding: 14,
  },
  pendingIcon: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  pendingTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.text },
  pendingSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },

  quickGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.white, marginHorizontal: 16, marginTop: 12,
    borderRadius: SIZES.radiusXl, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  quickCard: { alignItems: 'center', width: '22%' },
  quickIcon: {
    width: 46, height: 46, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center', marginBottom: 7,
  },
  quickLabel: { fontSize: 10.5, fontWeight: '700', color: COLORS.text, textAlign: 'center' },

  section: { paddingHorizontal: 16, marginTop: SPACING.l },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
  seeAll: { fontSize: 12.5, color: COLORS.primary, fontWeight: '700', marginBottom: 12 },
  emptyBox: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  emptyText: { fontSize: 13.5, color: COLORS.textSecondary, fontWeight: '500' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: SIZES.radius, padding: 13, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
    borderLeftWidth: 3,   // the state rail
  },
  rowAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  rowAvatarText: { fontSize: 13, fontWeight: '800', color: COLORS.primary },
  rowInfo: { flex: 1, paddingHorizontal: 12 },
  rowName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  timeCol: { width: 62, alignItems: 'center', gap: 6 },
  timeText: { fontSize: 11.5, fontWeight: '800', color: COLORS.text },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  nextCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 5,
  },
  nextAvatar: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  nextAvatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  nextName: { fontSize: 15.5, fontWeight: '800', color: COLORS.text },
  nextReason: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
  nextTime: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },

  typeTag: { backgroundColor: COLORS.secondary, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  typeTagText: { fontSize: 10.5, fontWeight: '700', color: COLORS.primary },
});
