import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { setAppointmentStatus, journeyStatus } from '../services/doctorData';
import { useLanguage } from '../../../context/LanguageContext';

export default function AppointmentDetail({ route, navigation }) {
  const { appointment: apt } = route.params;
  const { t } = useLanguage();
  const [status, setStatus] = useState(apt.status);
  const [busy, setBusy] = useState(false);

  const canManage = status !== 'completed' && status !== 'cancelled';

  const persist = async (next) => {
    setBusy(true);
    const ok = await setAppointmentStatus(apt.id, next);
    setBusy(false);
    if (ok) {
      setStatus(next);
    } else {
      Alert.alert(t('doc_could_not_update_title'), t('doc_could_not_update_msg'));
    }
  };

  const handleComplete = () => {
    Alert.alert(t('doc_mark_complete_title'), t('doc_mark_complete_msg', { name: apt.patientName }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('doc_complete'), onPress: () => persist('completed') },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(t('doc_cancel_appt'), t('doc_cancel_appt_msg'), [
      { text: t('doc_no'), style: 'cancel' },
      { text: t('doc_cancel_appt'), style: 'destructive', onPress: () => persist('cancelled') },
    ]);
  };

  const handleReschedule = () => {
    Alert.alert(t('doc_reschedule'), t('doc_reschedule_alert_msg'));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('doc_appointment_title')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Patient Card */}
        <View style={styles.patientCard}>
          <View style={styles.patientAvatar}>
            <Text style={styles.patientAvatarText}>
              {apt.patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{apt.patientName}</Text>
            <Text style={styles.patientMeta}>
              {apt.patientAge}{apt.patientAge !== '—' ? ' yrs' : ''} · {apt.patientGender}
            </Text>
            {!!apt.patientPhone && (
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={13} color={COLORS.primary} />
                <Text style={styles.phoneText}>{apt.patientPhone}</Text>
              </View>
            )}
            {apt.bookedByRmp ? (
              <View style={styles.rmpTag}>
                <Ionicons name="people-outline" size={12} color={COLORS.tintVioletInk} />
                <Text style={styles.rmpTagText}>{t('doc_booked_rmp')}</Text>
              </View>
            ) : null}
          </View>
          <StatusBadge status={status} />
        </View>

        {/* Appointment Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>{t('doc_appt_details')}</Text>
          <InfoRow icon="calendar-outline" label={t('doc_label_date')} value={apt.date} />
          <InfoRow icon="time-outline" label={t('doc_label_time')} value={apt.time} />
          <InfoRow
            icon={apt.type === 'Video' ? 'videocam-outline' : 'person-outline'}
            label={t('doc_label_type')} value={apt.type === 'Video' ? t('type_video') : t('type_inperson')}
          />
          <InfoRow icon="medical-outline" label={t('doc_label_reason')} value={apt.reason} />
          {apt.notes ? <InfoRow icon="document-text-outline" label={t('doc_label_notes')} value={apt.notes} /> : null}
        </View>

        {/* Actions */}
        {canManage && (
          <View style={styles.actionsCard}>
            <Text style={styles.infoCardTitle}>{t('doc_actions')}</Text>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigation.navigate('UploadPrescription', { appointment: apt })}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#FAF5FF' }]}>
                <Ionicons name="document-text" size={20} color={COLORS.tintVioletInk} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{t('doc_upload_rx')}</Text>
                <Text style={styles.actionSub}>{t('doc_upload_rx_sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigation.navigate('RequestServices', { appointment: apt })}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#E6FFFA' }]}>
                <Ionicons name="flask" size={20} color={COLORS.tintTealInk} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{t('doc_request_service')}</Text>
                <Text style={styles.actionSub}>{t('doc_request_service_sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionRow} onPress={handleReschedule}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.warningSoft }]}>
                <Ionicons name="calendar" size={20} color={COLORS.tintGoldInk} />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>{t('doc_reschedule')}</Text>
                <Text style={styles.actionSub}>{t('doc_reschedule_sub')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Status Buttons */}
        {canManage && (
          <View style={styles.btnSection}>
            <TouchableOpacity style={[styles.completeBtn, busy && { opacity: 0.6 }]} onPress={handleComplete} disabled={busy}>
              {busy ? <ActivityIndicator color={COLORS.white} /> : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                  <Text style={styles.completeBtnText}>{t('doc_mark_completed')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, busy && { opacity: 0.6 }]} onPress={handleCancel} disabled={busy}>
              <Ionicons name="close-circle" size={18} color={COLORS.error} />
              <Text style={styles.cancelBtnText}>{t('doc_cancel_appt')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'completed' && (
          <View style={styles.doneBox}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
            <Text style={styles.doneText}>{t('doc_appt_completed')}</Text>
          </View>
        )}

        {status === 'cancelled' && (
          <View style={[styles.doneBox, { backgroundColor: COLORS.dangerSoft }]}>
            <Ionicons name="close-circle" size={22} color={COLORS.error} />
            <Text style={[styles.doneText, { color: COLORS.error }]}>{t('doc_appt_cancelled')}</Text>
          </View>
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

// Patient journey: Arrived → Checked In → Completed (see doctorData.journeyStatus).
const StatusBadge = ({ status }) => {
  const { t } = useLanguage();
  const c = journeyStatus(status);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{t(c.labelKey)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface },
  patientCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    margin: 16, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  patientAvatar: {
    width: 56, height: 56, borderRadius: 24, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  patientAvatarText: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  patientMeta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  phoneText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  rmpTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    alignSelf: 'flex-start', backgroundColor: '#FAF5FF',
    borderWidth: 1, borderColor: '#E9D8FD',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  rmpTagText: { fontSize: 11, fontWeight: '700', color: '#6B46C1' },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  infoCard: {
    backgroundColor: COLORS.white, marginHorizontal: 20, marginBottom: 12,
    borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  infoCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.hairline,
  },
  infoIconBox: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, width: 70, fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  actionsCard: {
    backgroundColor: COLORS.white, marginHorizontal: 20, marginBottom: 12,
    borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.hairline,
  },
  actionIcon: {
    width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  actionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  btnSection: { marginHorizontal: 20, marginBottom: 12, gap: 8 },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.success, borderRadius: SIZES.radius, padding: 14, gap: 8,
  },
  completeBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.dangerSoft, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: '#FEB2B2', padding: 14, gap: 8,
  },
  cancelBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '700' },
  doneBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.successSoft, marginHorizontal: 20, borderRadius: SIZES.radius, padding: 14, gap: 8,
  },
  doneText: { fontSize: 14, fontWeight: '700', color: COLORS.success },
});
