import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES, ELEVATION } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { fetchDoctorAppointments, resolveDoctorContext, journeyStatus } from '../services/doctorData';

const getGreeting = (t) => {
  const h = new Date().getHours();
  if (h < 12) return t('doc_good_morning');
  if (h < 17) return t('doc_good_afternoon');
  return t('doc_good_evening');
};

export default function Home({ navigation }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState([]);
  const [ctx, setCtx] = useState({ specialty: null, department: null, hospital: null });

  const load = useCallback(async () => {
    const [appts, dctx] = await Promise.all([fetchDoctorAppointments(), resolveDoctorContext()]);
    setAppointments(appts);
    setCtx(dctx);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doctorName = user?.name || ctx.name || 'Doctor';
  const hospital   = user?.hospitalName || ctx.hospital || 'Hospital';
  const department = ctx.department || 'General';
  const specialty  = ctx.specialty || 'Doctor';
  const initials   = doctorName.replace(/^Dr\.?\s*/i, '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const todayApts = appointments.filter(a => a.isToday);
  const nextApt = todayApts.find(a => a.status !== 'completed' && a.status !== 'cancelled');
  const nextJourney = nextApt ? journeyStatus(nextApt.rawStatus || nextApt.status) : null;
  const completed = todayApts.filter(a => a.status === 'completed').length;
  const remaining = todayApts.filter(a => a.status !== 'completed' && a.status !== 'cancelled').length;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Primary Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => navigation.navigate('Profile')}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || 'DR'}</Text>
              </View>
              <View>
                <Text style={styles.greeting}>{getGreeting(t)}</Text>
                <Text style={styles.doctorName}>{doctorName}</Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => navigation.navigate('ScanPatient')}
              >
                <Ionicons name="scan-outline" size={22} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.notifBtn}
                onPress={() => navigation.navigate('Appointments')}
              >
                <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
                {remaining > 0 && <View style={styles.notifDot} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerBody}>
            <Text style={styles.headerTitle}>{hospital}</Text>
            <Text style={styles.headerSub}>{department} · {specialty}</Text>
          </View>

          {/* Today's Progress */}
          <View style={styles.progressCard}>
            <View style={styles.progressCol}>
              <Text style={styles.progressNum}>{todayApts.length}</Text>
              <Text style={styles.progressLabel} numberOfLines={1}>{t('doc_total_today')}</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressCol}>
              <Text style={[styles.progressNum, { color: COLORS.success }]}>{completed}</Text>
              <Text style={styles.progressLabel} numberOfLines={1}>{t('status_completed')}</Text>
            </View>
            <View style={styles.progressDivider} />
            <View style={styles.progressCol}>
              <Text style={[styles.progressNum, { color: '#FF8A00' }]}>{remaining}</Text>
              <Text style={styles.progressLabel} numberOfLines={1}>{t('doc_remaining')}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickSection}>
          <View style={styles.quickGrid}>
            <QuickAction icon="calendar" label={t('doc_qa_appointments')} bg={COLORS.tintGold} color={COLORS.tintGoldInk}
              onPress={() => navigation.navigate('Appointments')} />
            <QuickAction icon="time" label={t('doc_qa_schedule')} bg={COLORS.tintTeal} color={COLORS.tintTealInk}
              onPress={() => navigation.navigate('Schedule')} />
            <QuickAction icon="flask" label={t('doc_qa_lab_request')} bg={COLORS.tintBlue} color={COLORS.tintBlueInk}
              onPress={() => navigation.navigate('RequestServices')} />
            <QuickAction icon="document-text" label={t('doc_qa_prescribe')} bg={COLORS.tintViolet} color={COLORS.tintVioletInk}
              onPress={() => navigation.navigate('UploadPrescription', { appointment: nextApt })} />
          </View>
        </View>

        {/* Next Patient */}
        {nextApt && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('doc_next_patient')}</Text>
            <TouchableOpacity
              style={styles.nextPatientCard}
              onPress={() => navigation.navigate('AppointmentDetail', { appointment: nextApt })}
            >
              <View style={styles.patientAvatar}>
                <Text style={styles.patientAvatarText}>
                  {nextApt.patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{nextApt.patientName}</Text>
                <Text style={styles.patientMeta}>
                  {nextApt.patientAge}{nextApt.patientAge !== '—' ? ` ${t('yrs')}` : ''} · {nextApt.patientGender}
                </Text>
                <Text style={styles.patientReason}>{nextApt.reason}</Text>
              </View>
              <View style={styles.aptTimeBox}>
                <Text style={styles.aptTime}>{nextApt.time}</Text>
                {nextJourney && (
                  <View style={[styles.journeyPill, { backgroundColor: nextJourney.bg }]}>
                    <Text style={[styles.journeyPillText, { color: nextJourney.color }]}>{t(nextJourney.labelKey)}</Text>
                  </View>
                )}
                <View style={[styles.typeTag, nextApt.type === 'Video' && styles.videoTag]}>
                  <Text style={[styles.typeTagText, nextApt.type === 'Video' && styles.videoTagText]}>
                    {nextApt.type === 'Video' ? t('type_video') : t('type_inperson')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Today's List */}
        <View style={[styles.section, { marginBottom: SPACING.xl * 2 }]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('doc_todays_appointments')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
              <Text style={styles.seeAll}>{t('doc_see_all')}</Text>
            </TouchableOpacity>
          </View>
          {todayApts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>{t('doc_no_appointments_today')}</Text>
            </View>
          ) : todayApts.map(apt => {
            const j = journeyStatus(apt.rawStatus || apt.status);
            return (
              <TouchableOpacity
                key={apt.id}
                style={styles.aptRow}
                onPress={() => navigation.navigate('AppointmentDetail', { appointment: apt })}
              >
                <View style={styles.aptTimeCol}>
                  <Text style={styles.aptRowTime}>{apt.time}</Text>
                  <View style={[styles.statusDot, { backgroundColor: j.color }]} />
                </View>
                <View style={styles.aptRowInfo}>
                  <Text style={styles.aptRowName}>{apt.patientName}</Text>
                  <Text style={styles.aptRowReason}>{apt.reason}</Text>
                </View>
                <View style={styles.aptRowRight}>
                  <View style={[styles.journeyPill, { backgroundColor: j.bg }]}>
                    <Text style={[styles.journeyPillText, { color: j.color }]}>{t(j.labelKey)}</Text>
                  </View>
                  <View style={[styles.aptRowType, apt.type === 'Video' && styles.videoTag]}>
                    <Text style={[styles.aptRowTypeText, apt.type === 'Video' && styles.videoTagText]}>
                      {apt.type === 'Video' ? t('type_video') : t('type_inperson')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const QuickAction = ({ icon, label, bg, color, onPress }) => (
  <TouchableOpacity style={styles.quickCard} onPress={onPress}>
    <View style={[styles.quickIcon, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.header,
    borderBottomRightRadius: SIZES.header,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.l,
  },
  avatarBtn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
  doctorName: { color: COLORS.white, fontSize: 16, fontWeight: '700', marginTop: 1 },
  notifBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  notifDot: {
    position: 'absolute', top: 9, right: 10,
    width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF8A00',
  },
  headerBody: { marginBottom: SPACING.l },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white, letterSpacing: -0.4 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  progressCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    padding: SPACING.m,
  },
  progressCol: { flex: 1, alignItems: 'center' },
  progressNum: { fontSize: 24, fontWeight: '800', color: COLORS.white },
  progressLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontWeight: '500' },
  progressDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  quickSection: { paddingHorizontal: 20, marginTop: -26, marginBottom: SPACING.m },
  quickGrid: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusXl, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  quickCard: { flex: 1, alignItems: 'center' },
  quickIcon: {
    width: 48, height: 48, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  quickLabel: { fontSize: 11, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  section: { paddingHorizontal: 20, marginTop: SPACING.m },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.m,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, letterSpacing: -0.1 },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  nextPatientCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    ...ELEVATION.raised,
  },
  patientAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  patientAvatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  patientMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  patientReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, fontStyle: 'italic' },
  aptTimeBox: { alignItems: 'flex-end', gap: 6 },
  aptRowRight: { alignItems: 'flex-end', gap: 6 },
  journeyPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  journeyPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  aptTime: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  typeTag: { backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeTagText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  videoTag: { backgroundColor: COLORS.tintBlue },
  videoTagText: { color: COLORS.tintBlueInk },
  aptRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusMd, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  aptTimeCol: { width: 70, alignItems: 'center', gap: 6 },
  aptRowTime: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  aptRowInfo: { flex: 1, paddingHorizontal: 12 },
  aptRowName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  aptRowReason: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  aptRowType: { backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  aptRowTypeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
});
