import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';
import AppBar from '../components/AppBar';
import {
  fetchDoctorAppointments, createHomecareOrder,
  fetchLabTestCatalog, fetchReferralFacilities,
} from '../services/doctorData';
import { sendToLab, sendToPharmacy } from '../../../lib/careFlow';

// ─────────────────────────────────────────────────────────────────────────────
// Refer a patient.
//
// This is where the individual doctor diverges most from the hospital one. A
// hospital doctor sends a patient down the corridor — the order is raised
// against their own organisation and someone in the same building fulfils it.
// A solo practitioner has no lab, no pharmacy and no home-care team, so they
// refer OUT: pick an external facility from the public catalog
// (rmp_service_facilities, migration-051), and the order is raised against THAT
// organisation instead. Home care is the exception — there is no facility to
// choose, so it stays a platform-routed request.
// ─────────────────────────────────────────────────────────────────────────────

// Loaded from lab_tests (migration-055) at runtime; this is the fallback only.
const FALLBACK_LAB_TESTS = ['CBC', 'Lipid Profile', 'HbA1c', 'Thyroid Panel', 'Liver Function', 'Kidney Function', 'ECG', 'Echo', 'Troponin', 'BNP'];

const HOMECARE_OPTIONS = ['Nursing Visit', 'Physiotherapy', 'ECG at Home', 'Blood Collection', 'IV Infusion', 'Wound Dressing'];
const PHARMACY_OPTIONS = ['Send Prescription', 'Medication Refill', 'Emergency Medication'];

const SERVICES = [
  { id: 'lab',      icon: 'flask-outline',  color: COLORS.tintTealInk,   bg: COLORS.tintTeal,   nameKey: 'idoc_svc_lab',      descKey: 'idoc_svc_lab_desc',      needsFacility: true },
  { id: 'pharmacy', icon: 'medkit-outline', color: COLORS.tintBlueInk,   bg: COLORS.tintBlue,   nameKey: 'idoc_svc_pharmacy', descKey: 'idoc_svc_pharmacy_desc', needsFacility: true },
  { id: 'homecare', icon: 'home-outline',   color: COLORS.tintVioletInk, bg: COLORS.tintViolet, nameKey: 'idoc_svc_homecare', descKey: 'idoc_svc_homecare_desc', needsFacility: false },
];

export default function Referrals({ route, navigation }) {
  const { t } = useLanguage();
  const apt = route?.params?.appointment;

  const [todayPatients, setTodayPatients] = useState([]);
  const [labTests, setLabTests] = useState(FALLBACK_LAB_TESTS);
  const [service, setService] = useState(null);
  const [options, setOptions] = useState([]);
  const [patient, setPatient] = useState(apt || null);

  const [facilities, setFacilities] = useState([]);
  const [facility, setFacility] = useState(null);
  const [loadingFacilities, setLoadingFacilities] = useState(false);

  const [urgency, setUrgency] = useState('routine');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [appts, tests] = await Promise.all([fetchDoctorAppointments(), fetchLabTestCatalog()]);
    setTodayPatients(appts.filter(a => a.isToday && a.status !== 'cancelled'));
    if (tests.length) setLabTests(tests.map(x => x.name));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickService = async (svc) => {
    setService(svc);
    setOptions([]);
    setFacility(null);
    setFacilities([]);
    if (!svc.needsFacility) return;
    setLoadingFacilities(true);
    try {
      setFacilities(await fetchReferralFacilities(svc.id));
    } finally {
      setLoadingFacilities(false);
    }
  };

  const toggleOption = (option) => {
    setOptions(prev => prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]);
  };

  const optionList = service?.id === 'lab' ? labTests
    : service?.id === 'pharmacy' ? PHARMACY_OPTIONS
      : HOMECARE_OPTIONS;

  const handleSubmit = async () => {
    if (!patient)               { Alert.alert(t('idoc_select_patient'), t('idoc_select_patient_msg')); return; }
    if (!patient.patientId)     { Alert.alert(t('idoc_patient_unavailable'), t('idoc_patient_unavailable_msg')); return; }
    if (!service)               { Alert.alert(t('idoc_select_service'), t('idoc_select_service_msg')); return; }
    if (service.needsFacility && !facility) { Alert.alert(t('idoc_select_facility'), t('idoc_select_facility_msg')); return; }
    if (options.length === 0)   { Alert.alert(t('idoc_select_items'), t('idoc_select_items_msg')); return; }

    setSubmitting(true);
    try {
      const payload = {
        patientId: patient.patientId,
        appointmentId: patient.id || apt?.id || null,
      };
      if (service.id === 'lab') {
        await sendToLab({
          ...payload,
          tests: options,
          // The referral target, not this doctor's own clinic.
          organisationId: facility.organisationId,
          department: facility.unit || null,
        });
      } else if (service.id === 'pharmacy') {
        await sendToPharmacy({
          ...payload,
          medicines: options,
          organisationId: facility.organisationId,
        });
      } else {
        await createHomecareOrder({ ...payload, serviceName: options.join(', ') });
      }
      Alert.alert(
        t('idoc_referral_sent'),
        service.needsFacility
          ? t('idoc_referral_sent_msg', { name: patient.patientName, facility: facility.name })
          : t('idoc_referral_sent_platform_msg', { name: patient.patientName }),
        [{ text: t('idoc_ok'), onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert(t('idoc_referral_failed'), e?.message || t('idoc_try_again'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar title={t('idoc_refer_patient')} onBack={() => navigation.goBack()} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* ── Patient ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('idoc_patient')}</Text>
          {todayPatients.length === 0 ? (
            <Text style={styles.emptyHint}>{t('idoc_no_patients_today')}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {todayPatients.map(p => {
                const active = patient?.id === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.patientChip, active && styles.activePatientChip]}
                    onPress={() => setPatient(p)}
                  >
                    <View style={[styles.patientChipAvatar, active && { backgroundColor: COLORS.white }]}>
                      <Text style={[styles.patientChipAvatarText, active && { color: COLORS.primary }]}>
                        {(p.patientName || '?').split(' ').map(n => n[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.patientChipName, active && { color: COLORS.white }]} numberOfLines={1}>
                      {(p.patientName || '').split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* ── Service ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('idoc_service_type')}</Text>
          <View style={styles.servicesGrid}>
            {SERVICES.map(svc => {
              const active = service?.id === svc.id;
              return (
                <TouchableOpacity
                  key={svc.id}
                  style={[styles.svcCard, active && styles.activeSvcCard]}
                  onPress={() => pickService(svc)}
                >
                  <View style={[styles.svcIcon, { backgroundColor: svc.bg }]}>
                    <Ionicons name={svc.icon} size={20} color={svc.color} />
                  </View>
                  <Text style={[styles.svcName, active && { color: COLORS.primary }]}>{t(svc.nameKey)}</Text>
                  <Text style={styles.svcDesc}>{t(svc.descKey)}</Text>
                  {active && (
                    <View style={styles.svcCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Where to send them ───────────────────────────────────────── */}
        {service?.needsFacility && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {service.id === 'lab' ? t('idoc_choose_lab') : t('idoc_choose_pharmacy')}
            </Text>
            {loadingFacilities ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : facilities.length === 0 ? (
              <Text style={styles.emptyHint}>{t('idoc_no_facilities')}</Text>
            ) : facilities.map(f => {
              const active = facility?.id === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.facilityRow, active && styles.activeFacilityRow]}
                  onPress={() => setFacility(f)}
                >
                  <View style={[styles.facilityIcon, active && { backgroundColor: COLORS.primary }]}>
                    <Ionicons
                      name={service.id === 'lab' ? 'flask' : 'medkit'}
                      size={16}
                      color={active ? COLORS.white : COLORS.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.facilityName} numberOfLines={1}>{f.name}</Text>
                    <Text style={styles.facilityMeta} numberOfLines={1}>
                      {f.source === 'hospital' ? t('idoc_inside_hospital') : t('idoc_standalone')}
                      {f.city ? ` · ${f.city}` : ''}
                    </Text>
                  </View>
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={19}
                    color={active ? COLORS.primary : COLORS.borderStrong}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── What to order ────────────────────────────────────────────── */}
        {service && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {service.id === 'lab' ? t('idoc_select_tests') : t('idoc_select_options')}
            </Text>
            <View style={styles.optionsGrid}>
              {optionList.map(opt => {
                const active = options.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionChip, active && styles.activeOptionChip]}
                    onPress={() => toggleOption(opt)}
                  >
                    {active && <Ionicons name="checkmark" size={13} color={COLORS.white} />}
                    <Text style={[styles.optionChipText, active && { color: COLORS.white }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Priority ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('idoc_priority')}</Text>
          <View style={styles.urgencyRow}>
            {[
              { id: 'routine',   key: 'idoc_routine',   tint: COLORS.primary },
              { id: 'urgent',    key: 'idoc_urgent',    tint: COLORS.warning },
              { id: 'emergency', key: 'idoc_emergency', tint: COLORS.error },
            ].map(u => (
              <TouchableOpacity
                key={u.id}
                style={[
                  styles.urgencyChip,
                  urgency === u.id && { backgroundColor: u.tint, borderColor: u.tint },
                ]}
                onPress={() => setUrgency(u.id)}
              >
                <Text style={[styles.urgencyText, urgency === u.id && { color: COLORS.white }]}>{t(u.key)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('idoc_clinical_notes')}</Text>
          <TextInput
            style={styles.notesInput}
            placeholder={t('idoc_clinical_notes_ph')}
            placeholderTextColor={COLORS.textSecondary}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* ── Summary ──────────────────────────────────────────────────── */}
        {patient && service && options.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>{t('idoc_referral_summary')}</Text>
            <SummaryLine label={t('idoc_patient')} value={patient.patientName} />
            <SummaryLine label={t('idoc_service')} value={t(service.nameKey)} />
            {!!facility && <SummaryLine label={t('idoc_sending_to')} value={facility.name} />}
            <SummaryLine label={t('idoc_items')} value={options.join(', ')} />
            <SummaryLine label={t('idoc_priority')} value={t(`idoc_${urgency}`)} />
          </View>
        )}

        <View style={styles.btnSection}>
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
            <Text style={styles.submitBtnText}>{submitting ? t('idoc_sending') : t('idoc_send_referral')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const SummaryLine = ({ label, value }) => (
  <Text style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}: </Text>{value}
  </Text>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface },

  section: { marginHorizontal: 16, marginTop: SPACING.m },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  emptyHint: { fontSize: 12.5, color: COLORS.textSecondary, fontStyle: 'italic' },

  patientChip: {
    alignItems: 'center', backgroundColor: COLORS.white, borderRadius: SIZES.radius, padding: 12,
    marginRight: 10, borderWidth: 1, borderColor: COLORS.border, width: 80,
  },
  activePatientChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  patientChipAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  patientChipAvatarText: { fontSize: 12.5, fontWeight: '800', color: COLORS.primary },
  patientChipName: { fontSize: 10.5, fontWeight: '700', color: COLORS.text, textAlign: 'center' },

  servicesGrid: { flexDirection: 'row', gap: 10 },
  svcCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: SIZES.radius, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  activeSvcCard: { borderColor: COLORS.primary, borderWidth: 2 },
  svcIcon: { width: 40, height: 40, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginBottom: 9 },
  svcName: { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 3 },
  svcDesc: { fontSize: 10.5, color: COLORS.textSecondary, lineHeight: 14 },
  svcCheck: { position: 'absolute', top: 8, right: 8 },

  facilityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: COLORS.white, borderRadius: SIZES.radius, padding: 13, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  activeFacilityRow: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  facilityIcon: {
    width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  facilityName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  facilityMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  activeOptionChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionChipText: { fontSize: 12.5, fontWeight: '600', color: COLORS.text },

  urgencyRow: { flexDirection: 'row', gap: 10 },
  urgencyChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  urgencyText: { fontSize: 12.5, fontWeight: '700', color: COLORS.textSecondary },

  notesInput: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radius,
    padding: SPACING.m, fontSize: 13.5, color: COLORS.text, minHeight: 80, textAlignVertical: 'top',
  },

  summaryCard: {
    backgroundColor: COLORS.secondary, marginHorizontal: 16, marginTop: SPACING.m,
    borderRadius: SIZES.radius, padding: 16, borderWidth: 1, borderColor: COLORS.borderStrong, gap: 6,
  },
  summaryTitle: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  summaryRow: { fontSize: 12.5, color: COLORS.text },
  summaryLabel: { fontWeight: '700', color: COLORS.textSecondary },

  btnSection: { marginHorizontal: 16, marginTop: SPACING.m },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius, padding: 16, gap: 10,
  },
  submitBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
