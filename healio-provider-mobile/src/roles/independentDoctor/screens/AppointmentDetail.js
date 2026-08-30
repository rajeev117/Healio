import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';
import AppBar from '../components/AppBar';
import { setAppointmentStatus } from '../services/doctorData';

export default function AppointmentDetail({ route, navigation }) {
  const { t } = useLanguage();
  const { appointment: apt } = route.params;
  const [status, setStatus] = useState(apt.status);
  const [busy, setBusy] = useState(false);

  const canManage = status !== 'completed' && status !== 'cancelled';
  // Unlike a hospital doctor, a solo practitioner accepts their own bookings.
  const needsDecision = status === 'pending';

  const persist = async (next) => {
    setBusy(true);
    const ok = await setAppointmentStatus(apt.id, next);
    setBusy(false);
    if (ok) setStatus(next);
    else Alert.alert(t('idoc_update_failed'), t('idoc_update_failed_msg'));
  };

  const handleAccept = () => persist('confirmed');

  const handleComplete = () => {
    Alert.alert(t('idoc_mark_complete'), t('idoc_mark_complete_msg', { name: apt.patientName }), [
      { text: t('idoc_cancel'), style: 'cancel' },
      { text: t('idoc_complete'), onPress: () => persist('completed') },
    ]);
  };

  const handleCancel = () => {
    Alert.alert(t('idoc_cancel_appointment'), t('idoc_cancel_appointment_msg'), [
      { text: t('idoc_no'), style: 'cancel' },
      { text: t('idoc_cancel_appointment'), style: 'destructive', onPress: () => persist('cancelled') },
    ]);
  };

  const handleReschedule = () => {
    Alert.alert(t('idoc_reschedule'), t('idoc_reschedule_msg'));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar
        title={t('idoc_appointment')}
        subtitle={`${apt.date} · ${apt.time}`}
        onBack={() => navigation.goBack()}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Patient */}
        <View style={[styles.patientCard, { borderLeftColor: railFor(status) }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(apt.patientName || '?').split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{apt.patientName}</Text>
            <Text style={styles.patientMeta}>
              {apt.patientAge}{apt.patientAge !== '—' ? ` ${t('idoc_yrs')}` : ''} · {apt.patientGender}
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
                <Text style={styles.rmpTagText}>{t('idoc_booked_via_rmp')}</Text>
              </View>
            ) : null}
          </View>
          <StatusBadge status={status} t={t} />
        </View>

        {/* Accept / decline — the front-desk step a solo doctor does themselves */}
        {needsDecision && (
          <View style={styles.decideCard}>
            <View style={styles.decideHead}>
              <Ionicons name="hourglass-outline" size={17} color={COLORS.warning} />
              <Text style={styles.decideTitle}>{t('idoc_awaiting_your_decision')}</Text>
            </View>
            <Text style={styles.decideSub}>{t('idoc_awaiting_your_decision_sub')}</Text>
            <View style={styles.decideRow}>
              <TouchableOpacity
                style={[styles.declineBtn, busy && { opacity: 0.6 }]}
                onPress={handleCancel}
                disabled={busy}
              >
                <Text style={styles.declineText}>{t('idoc_decline')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.acceptBtn, busy && { opacity: 0.6 }]}
                onPress={handleAccept}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color={COLORS.white} size="small" /> : (
                  <>
                    <Ionicons name="checkmark" size={17} color={COLORS.white} />
                    <Text style={styles.acceptText}>{t('idoc_accept_booking')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('idoc_appointment_details')}</Text>
          <InfoRow icon="calendar-outline" label={t('idoc_date')} value={apt.date} />
          <InfoRow icon="time-outline" label={t('idoc_time')} value={apt.time} />
          <InfoRow
            icon={apt.type === 'Video' ? 'videocam-outline' : 'person-outline'}
            label={t('idoc_type')}
            value={apt.type === 'Video' ? t('idoc_video') : t('idoc_in_person')}
          />
          <InfoRow icon="medical-outline" label={t('idoc_reason')} value={apt.reason} />
          {apt.notes ? <InfoRow icon="document-text-outline" label={t('idoc_notes')} value={apt.notes} /> : null}
        </View>

        {/* Actions */}
        {canManage && !needsDecision && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('idoc_actions')}</Text>

            <ActionRow
              icon="document-text" tint={COLORS.tintViolet} ink={COLORS.tintVioletInk}
              title={t('idoc_upload_prescription')} sub={t('idoc_upload_prescription_sub')}
              onPress={() => navigation.navigate('UploadPrescription', { appointment: apt })}
            />
            <ActionRow
              icon="flask" tint={COLORS.tintTeal} ink={COLORS.tintTealInk}
              title={t('idoc_refer_patient')} sub={t('idoc_refer_patient_sub')}
              onPress={() => navigation.navigate('Referrals', { appointment: apt })}
            />
            <ActionRow
              icon="calendar" tint={COLORS.warningSoft} ink={COLORS.warning}
              title={t('idoc_reschedule')} sub={t('idoc_reschedule_sub')}
              onPress={handleReschedule}
            />
          </View>
        )}

        {/* Close-out */}
        {canManage && !needsDecision && (
          <View style={styles.btnSection}>
            <TouchableOpacity style={[styles.completeBtn, busy && { opacity: 0.6 }]} onPress={handleComplete} disabled={busy}>
              {busy ? <ActivityIndicator color={COLORS.white} /> : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                  <Text style={styles.completeBtnText}>{t('idoc_mark_completed')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, busy && { opacity: 0.6 }]} onPress={handleCancel} disabled={busy}>
              <Ionicons name="close-circle" size={18} color={COLORS.error} />
              <Text style={styles.cancelBtnText}>{t('idoc_cancel_appointment')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === 'completed' && (
          <View style={styles.doneBox}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
            <Text style={styles.doneText}>{t('idoc_appointment_completed')}</Text>
          </View>
        )}

        {status === 'cancelled' && (
          <View style={[styles.doneBox, { backgroundColor: COLORS.dangerSoft }]}>
            <Ionicons name="close-circle" size={22} color={COLORS.error} />
            <Text style={[styles.doneText, { color: COLORS.error }]}>{t('idoc_appointment_cancelled')}</Text>
          </View>
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const railFor = (status) => (
  status === 'completed' ? COLORS.success
    : status === 'cancelled' ? COLORS.error
      : status === 'pending' ? COLORS.warning
        : COLORS.tintBlueInk
);

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const ActionRow = ({ icon, tint, ink, title, sub, onPress }) => (
  <TouchableOpacity style={styles.actionRow} onPress={onPress}>
    <View style={[styles.actionIcon, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={19} color={ink} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
  </TouchableOpacity>
);

const StatusBadge = ({ status, t }) => {
  const config = {
    pending:   { bg: COLORS.warningSoft, color: '#b45309',            key: 'idoc_status_pending' },
    confirmed: { bg: COLORS.successSoft, color: COLORS.success,       key: 'idoc_status_confirmed' },
    completed: { bg: COLORS.mutedSoft,   color: COLORS.textSecondary, key: 'idoc_status_completed' },
    cancelled: { bg: COLORS.dangerSoft,  color: COLORS.error,         key: 'idoc_status_cancelled' },
  };
  const c = config[status] || config.confirmed;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.color }]}>{t(c.key)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface },

  patientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, margin: 16, borderRadius: SIZES.radiusLg, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 3,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  patientName: { fontSize: 16.5, fontWeight: '800', color: COLORS.text },
  patientMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 2 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  phoneText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  rmpTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start',
    backgroundColor: COLORS.tintViolet, borderWidth: 1, borderColor: '#e9d8fd',
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  rmpTagText: { fontSize: 10.5, fontWeight: '700', color: COLORS.tintVioletInk },
  badge: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  decideCard: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 12,
    borderRadius: SIZES.radiusLg, padding: 16, borderWidth: 1, borderColor: '#f0d9a8',
  },
  decideHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  decideTitle: { fontSize: 14.5, fontWeight: '800', color: COLORS.text },
  decideSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, marginBottom: 14, lineHeight: 17 },
  decideRow: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: SIZES.radius,
    backgroundColor: COLORS.dangerSoft, borderWidth: 1, borderColor: '#f3c9c9',
  },
  declineText: { fontSize: 13.5, fontWeight: '800', color: COLORS.error },
  acceptBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: SIZES.radius, backgroundColor: COLORS.success,
  },
  acceptText: { fontSize: 13.5, fontWeight: '800', color: COLORS.white },

  card: {
    backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 12,
    borderRadius: SIZES.radiusLg, padding: 16, borderWidth: 1, borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoIconBox: {
    width: 28, height: 28, borderRadius: 9, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  infoLabel: { fontSize: 12.5, color: COLORS.textSecondary, width: 76, fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 12.5, fontWeight: '600', color: COLORS.text },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  actionIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  actionTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  actionSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },

  btnSection: { marginHorizontal: 16, marginBottom: 12, gap: 8 },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.success, borderRadius: SIZES.radius, padding: 14,
  },
  completeBtnText: { color: COLORS.white, fontSize: 14.5, fontWeight: '800' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.dangerSoft, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: '#f3c9c9', padding: 14,
  },
  cancelBtnText: { color: COLORS.error, fontSize: 14.5, fontWeight: '800' },

  doneBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.successSoft, marginHorizontal: 16, borderRadius: SIZES.radius, padding: 14,
  },
  doneText: { fontSize: 13.5, fontWeight: '800', color: COLORS.success },
});
