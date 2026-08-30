import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { fetchDoctorAppointments, createHomecareOrder } from '../services/doctorData';
import { sendToLab, sendToPharmacy } from '../../../lib/careFlow';
import { useLanguage } from '../../../context/LanguageContext';

// nameKey/descKey → t(). The selectable clinical items (tests/options) stay
// English as medical data. `name` kept as an English fallback.
const HOSPITAL_SERVICES = [
  {
    id: 'svc_lab', name: 'Lab Tests', nameKey: 'doc_svc_lab', descKey: 'doc_svc_lab_desc',
    icon: 'flask-outline', color: '#319795', bg: '#E6FFFA',
    tests: ['CBC', 'Lipid Profile', 'HbA1c', 'Thyroid Panel', 'Liver Function', 'Kidney Function', 'ECG', 'Echo', 'Troponin', 'BNP'],
  },
  {
    id: 'svc_homecare', name: 'Home Care', nameKey: 'doc_svc_homecare', descKey: 'doc_svc_homecare_desc',
    icon: 'home-outline', color: '#6B46C1', bg: '#FAF5FF',
    options: ['Nursing Visit', 'Physiotherapy', 'ECG at Home', 'Blood Collection', 'IV Infusion', 'Wound Dressing'],
  },
  {
    id: 'svc_pharmacy', name: 'Pharmacy', nameKey: 'doc_svc_pharmacy', descKey: 'doc_svc_pharmacy_desc',
    icon: 'medkit-outline', color: '#3182CE', bg: '#EBF8FF',
    options: ['Send Prescription', 'Medication Refill', 'Emergency Medication'],
  },
];

// Values stay English (compared for styling + stored); labels translate.
const URGENCY = ['Routine', 'Urgent', 'Emergency'];
const URGENCY_KEYS = { Routine: 'doc_urgency_routine', Urgent: 'doc_urgency_urgent', Emergency: 'doc_urgency_emergency' };

export default function RequestServices({ route, navigation }) {
  const apt = route?.params?.appointment;
  const { t } = useLanguage();

  const [todayPatients, setTodayPatients] = useState([]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(apt || null);
  const [urgency, setUrgency] = useState('Routine');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const appts = await fetchDoctorAppointments();
    setTodayPatients(appts.filter(a => a.isToday));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleOption = (option) => {
    setSelectedOptions(prev => prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]);
  };

  const handleSubmit = async () => {
    if (!selectedPatient) { Alert.alert(t('doc_select_patient_title'), t('doc_select_patient_msg')); return; }
    if (!selectedPatient.patientId) { Alert.alert(t('doc_patient_unavailable_title'), t('doc_patient_unavailable_msg')); return; }
    if (!selectedService) { Alert.alert(t('doc_select_service_title'), t('doc_select_service_msg')); return; }
    if (selectedOptions.length === 0) { Alert.alert(t('doc_select_items_title'), t('doc_select_items_msg')); return; }

    setSubmitting(true);
    try {
      const payload = {
        patientId: selectedPatient.patientId,
        appointmentId: selectedPatient.id || apt?.id || null,
      };
      if (selectedService.id === 'svc_lab') {
        await sendToLab({ ...payload, tests: selectedOptions });
      } else if (selectedService.id === 'svc_pharmacy') {
        await sendToPharmacy({ ...payload, medicines: selectedOptions });
      } else {
        await createHomecareOrder({ ...payload, serviceName: selectedOptions.join(', ') });
      }
      Alert.alert(
        t('doc_request_sent_title'),
        t('doc_request_sent_msg', { service: t(selectedService.nameKey), patient: selectedPatient.patientName }),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      Alert.alert(t('doc_request_fail_title'), e?.message || t('login_err_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('doc_request_service_title')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Select Patient */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('doc_patient')}</Text>
            {todayPatients.length === 0 ? (
              <Text style={styles.emptyHint}>{t('doc_no_patients_today')}</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientScroll}>
                {todayPatients.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.patientChip, selectedPatient?.id === p.id && styles.activePatientChip]}
                    onPress={() => setSelectedPatient(p)}
                  >
                    <View style={[styles.patientChipAvatar, selectedPatient?.id === p.id && { backgroundColor: COLORS.white }]}>
                      <Text style={[styles.patientChipAvatarText, selectedPatient?.id === p.id && { color: COLORS.primary }]}>
                        {p.patientName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.patientChipName, selectedPatient?.id === p.id && styles.activePatientChipText]}>
                      {p.patientName.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Service Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('doc_service_type')}</Text>
            <View style={styles.servicesGrid}>
              {HOSPITAL_SERVICES.map(svc => (
                <TouchableOpacity
                  key={svc.id}
                  style={[styles.svcCard, selectedService?.id === svc.id && styles.activeSvcCard]}
                  onPress={() => { setSelectedService(svc); setSelectedOptions([]); }}
                >
                  <View style={[styles.svcIcon, { backgroundColor: svc.bg }]}>
                    <Ionicons name={svc.icon} size={22} color={svc.color} />
                  </View>
                  <Text style={[styles.svcName, selectedService?.id === svc.id && { color: COLORS.primary }]}>{t(svc.nameKey)}</Text>
                  <Text style={styles.svcDesc}>{t(svc.descKey)}</Text>
                  {selectedService?.id === svc.id && (
                    <View style={styles.svcCheck}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Options */}
          {selectedService && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{selectedService.id === 'svc_lab' ? t('doc_select_tests') : t('doc_select_options')}</Text>
              <View style={styles.optionsGrid}>
                {(selectedService.tests || selectedService.options || []).map(opt => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.optionChip, selectedOptions.includes(opt) && styles.activeOptionChip]}
                    onPress={() => toggleOption(opt)}
                  >
                    {selectedOptions.includes(opt) && <Ionicons name="checkmark" size={13} color={COLORS.white} />}
                    <Text style={[styles.optionChipText, selectedOptions.includes(opt) && styles.activeOptionChipText]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Urgency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('doc_priority')}</Text>
            <View style={styles.urgencyRow}>
              {URGENCY.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[
                    styles.urgencyChip,
                    urgency === u && styles.activeUrgencyChip,
                    u === 'Emergency' && urgency === u && { backgroundColor: COLORS.error, borderColor: COLORS.error },
                    u === 'Urgent' && urgency === u && { backgroundColor: '#B7791F', borderColor: '#B7791F' },
                  ]}
                  onPress={() => setUrgency(u)}
                >
                  <Text style={[styles.urgencyText, urgency === u && { color: COLORS.white }]}>{t(URGENCY_KEYS[u])}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('doc_clinical_notes')}</Text>
            <TextInput
              style={styles.notesInput}
              placeholder={t('doc_notes_placeholder')}
              placeholderTextColor={COLORS.textSecondary}
              value={notes} onChangeText={setNotes} multiline
            />
          </View>

          {/* Summary */}
          {selectedPatient && selectedService && selectedOptions.length > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{t('doc_request_summary')}</Text>
              <Text style={styles.summaryRow2}><Text style={styles.summaryLabel2}>{t('doc_summary_patient')}</Text>{selectedPatient.patientName}</Text>
              <Text style={styles.summaryRow2}><Text style={styles.summaryLabel2}>{t('doc_summary_service')}</Text>{t(selectedService.nameKey)}</Text>
              <Text style={styles.summaryRow2}><Text style={styles.summaryLabel2}>{t('doc_summary_items')}</Text>{selectedOptions.join(', ')}</Text>
              <Text style={styles.summaryRow2}><Text style={styles.summaryLabel2}>{t('doc_summary_priority')}</Text>{t(URGENCY_KEYS[urgency])}</Text>
            </View>
          )}

          {/* Submit */}
          <View style={styles.btnSection}>
            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
              <Ionicons name="send" size={18} color={COLORS.white} />
              <Text style={styles.submitBtnText}>{submitting ? t('doc_sending') : t('doc_send_request')}</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: SPACING.xl * 2 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface },
  section: { marginHorizontal: 20, marginTop: SPACING.m },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  emptyHint: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },
  patientScroll: { marginBottom: 4 },
  patientChip: {
    alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 16, padding: 12,
    marginRight: 10, borderWidth: 1, borderColor: COLORS.border, width: 80,
  },
  activePatientChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  patientChipAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  patientChipAvatarText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  patientChipName: { fontSize: 11, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  activePatientChipText: { color: COLORS.white },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  svcCard: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: COLORS.border, position: 'relative',
  },
  activeSvcCard: { borderColor: COLORS.primary, borderWidth: 2 },
  svcIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  svcName: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  svcDesc: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 15 },
  svcCheck: { position: 'absolute', top: 10, right: 10 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 12, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  activeOptionChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optionChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  activeOptionChipText: { color: COLORS.white },
  urgencyRow: { flexDirection: 'row', gap: 10 },
  urgencyChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
  },
  activeUrgencyChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  urgencyText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  notesInput: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radius,
    padding: SPACING.m, fontSize: 14, color: COLORS.text, minHeight: 80, textAlignVertical: 'top',
  },
  summaryCard: {
    backgroundColor: COLORS.secondary, marginHorizontal: 20, marginTop: SPACING.m, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: COLORS.primaryHairline, gap: 6,
  },
  summaryTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  summaryRow2: { fontSize: 13, color: COLORS.text },
  summaryLabel2: { fontWeight: '700', color: COLORS.textSecondary },
  btnSection: { marginHorizontal: 20, marginTop: SPACING.m },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: SIZES.radius, padding: 16, gap: 10,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
