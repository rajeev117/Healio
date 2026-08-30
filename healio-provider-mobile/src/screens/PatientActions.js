import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { COLORS, SPACING } from '../constants/theme';
import styles from './PatientActions.styles';
import {
  uploadFile, uploadClinicalDocument,
  markVisitComplete, suggestFollowUp, getLatestAppointment,
} from '../lib/careFlow';
import { fetchDayAvailability, getNextNDays, SLOT_STATE } from '../lib/schedule';

// Next 14 days for the follow-up picker, starting tomorrow.
const FOLLOWUP_DAYS = getNextNDays(15).slice(1);

export default function PatientActions({ navigation, route }) {
  const patientId = route?.params?.patientId;
  const patient = useStore((s) => s.patients.find((p) => p.id === patientId) || s.patients[0]);

  const [uploading, setUploading]   = useState(false);
  const [docUploaded, setDocUploaded] = useState(false);

  // Follow-up modal
  const [followModal, setFollowModal] = useState(false);
  const [followDay, setFollowDay]     = useState(0);
  const [followSlot, setFollowSlot]   = useState(null);   // the whole slot object
  const [followSlots, setFollowSlots] = useState([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [sendingFollow, setSendingFollow] = useState(false);

  // Vitals modal
  const [vitalsModal, setVitalsModal] = useState(false);
  const [vBpSys,  setVBpSys]  = useState('');
  const [vBpDia,  setVBpDia]  = useState('');
  const [vTemp,   setVTemp]   = useState('');
  const [vPulse,  setVPulse]  = useState('');
  const [vWeight, setVWeight] = useState('');
  const [vSpo2,   setVSpo2]   = useState('');
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsSaved, setVitalsSaved]   = useState(false);

  // Mark complete
  const [completing, setCompleting] = useState(false);
  const [visitDone, setVisitDone]   = useState(false);

  const pid = patient?.id;

  // ── Document upload (image or PDF) ──────────────────────────────────────────
  const pickAndUpload = async (mode) => {
    try {
      let asset;
      if (mode === 'image') {
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (res.canceled) return;
        asset = res.assets[0];
      } else if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission needed', 'Allow camera access to take a photo.'); return; }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (res.canceled) return;
        asset = res.assets[0];
      } else {
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
        if (res.canceled) return;
        asset = res.assets[0];
      }

      setUploading(true);
      const url = await uploadFile('records', asset, pid);
      await uploadClinicalDocument({ patientId: pid, fileUrl: url, title: 'Prescription / Document' });
      setDocUploaded(true);
      Alert.alert('Uploaded ✓', 'Document saved to the patient\'s records.');
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const promptUpload = () => {
    Alert.alert('Upload Document', 'Choose a source', [
      { text: 'Take Photo', onPress: () => pickAndUpload('camera') },
      { text: 'Choose Image', onPress: () => pickAndUpload('image') },
      { text: 'Choose PDF/File', onPress: () => pickAndUpload('file') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Mark visit complete ─────────────────────────────────────────────────────
  const handleMarkComplete = () => {
    Alert.alert('Mark Visit Complete', `Mark ${patient?.name}'s current visit as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Complete',
        onPress: async () => {
          setCompleting(true);
          try {
            await markVisitComplete({ patientId: pid });
            setVisitDone(true);
            Alert.alert('Visit Completed ✓', 'The appointment has been marked complete.');
          } catch (e) {
            Alert.alert('Could not complete', e?.message || 'Please try again.');
          } finally { setCompleting(false); }
        },
      },
    ]);
  };

  // ── Vitals ──────────────────────────────────────────────────────────────────
  const handleSaveVitals = async () => {
    const hasAny = vBpSys || vBpDia || vTemp || vPulse || vWeight || vSpo2;
    if (!hasAny) { Alert.alert('No vitals', 'Enter at least one reading before saving.'); return; }
    setSavingVitals(true);
    try {
      const vitalsData = {};
      if (vBpSys || vBpDia) vitalsData.blood_pressure = `${vBpSys || '?'}/${vBpDia || '?'} mmHg`;
      if (vTemp)   vitalsData.temperature = `${vTemp} °C`;
      if (vPulse)  vitalsData.pulse       = `${vPulse} bpm`;
      if (vWeight) vitalsData.weight      = `${vWeight} kg`;
      if (vSpo2)   vitalsData.spo2        = `${vSpo2} %`;

      const { error } = await supabase.from('health_records').insert({
        patient_id: pid,
        type: 'vitals',
        title: `Vitals — ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`,
        notes: JSON.stringify(vitalsData),
      });
      if (error) throw error;

      setVitalsSaved(true);
      setVitalsModal(false);
      // reset fields
      setVBpSys(''); setVBpDia(''); setVTemp(''); setVPulse(''); setVWeight(''); setVSpo2('');
      Alert.alert('Vitals saved ✓', 'Readings have been saved to the patient\'s health records.');
    } catch (e) {
      Alert.alert('Could not save vitals', e?.message || 'Please try again.');
    } finally { setSavingVitals(false); }
  };

  // ── Suggest follow-up date ──────────────────────────────────────────────────
  // The offered times are the doctor's own slots for that date, with the ones
  // another patient already holds marked — a follow-up used to be offered from
  // a fixed six-slot list regardless of whether the doctor consulted then.
  const loadFollowSlots = useCallback(async () => {
    if (!followModal) return;
    setFollowLoading(true);
    setFollowSlot(null);
    try {
      const latest = await getLatestAppointment(pid);
      const doctorId = latest?.doctor_staff_id;
      const day = doctorId
        ? await fetchDayAvailability(doctorId, FOLLOWUP_DAYS[followDay].iso)
        : { slots: [] };
      setFollowSlots(day.slots);
    } catch (_) {
      setFollowSlots([]);
    } finally {
      setFollowLoading(false);
    }
  }, [followModal, followDay, pid]);

  useEffect(() => { loadFollowSlots(); }, [loadFollowSlots]);

  const handleSuggestFollowUp = async () => {
    if (!followSlot) { Alert.alert('Pick a time', 'Select a time slot for the follow-up.'); return; }
    setSendingFollow(true);
    try {
      await suggestFollowUp({ patientId: pid, isoDateTime: followSlot.at });
      setFollowModal(false); setFollowSlot(null);
      Alert.alert('Follow-up Suggested ✓', `${patient?.name} has been notified to confirm the follow-up visit.`);
    } catch (e) {
      if (['SLOT_FULL', 'SLOT_BLOCKED', 'ON_LEAVE', 'OUTSIDE_SCHEDULE', 'SLOT_PAST'].includes(e?.code)) {
        Alert.alert('Slot no longer available', e.message);
        loadFollowSlots();
      } else {
        Alert.alert('Could not suggest', e?.message || 'Please try again.');
      }
    } finally { setSendingFollow(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quick Actions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Patient banner */}
        <View style={styles.patientBanner}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(patient?.name || 'P').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.patientName}>{patient?.name || 'Patient'}</Text>
            <Text style={styles.patientSub}>Manage this patient's care journey</Text>
          </View>
        </View>

        {/* 1. Upload document */}
        <Text style={styles.sectionLabel}>Prescription / Documents</Text>
        <TouchableOpacity style={styles.bigAction} onPress={promptUpload} disabled={uploading}>
          <View style={[styles.bigIcon, { backgroundColor: COLORS.primarySoft }]}>
            {uploading
              ? <ActivityIndicator color={COLORS.primary} />
              : <Ionicons name={docUploaded ? 'checkmark-circle' : 'cloud-upload-outline'} size={24} color={COLORS.primary} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigActionTitle}>{docUploaded ? 'Document uploaded' : 'Upload Document'}</Text>
            <Text style={styles.bigActionSub}>Photo or PDF of the prescription / report</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* 2. Vitals */}
        <Text style={styles.sectionLabel}>Vitals</Text>
        <TouchableOpacity style={styles.bigAction} onPress={() => setVitalsModal(true)}>
          <View style={[styles.bigIcon, { backgroundColor: '#fce7f3' }]}>
            <Ionicons name={vitalsSaved ? 'checkmark-circle' : 'heart-outline'} size={24} color="#be185d" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigActionTitle}>{vitalsSaved ? 'Vitals recorded' : 'Record Vitals'}</Text>
            <Text style={styles.bigActionSub}>BP, temperature, pulse, weight, SpO₂</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        {/* 4. Visit actions */}
        <Text style={styles.sectionLabel}>Visit</Text>
        <TouchableOpacity style={styles.bigAction} onPress={() => setFollowModal(true)}>
          <View style={[styles.bigIcon, { backgroundColor: '#fdf6e2' }]}>
            <Ionicons name="calendar-outline" size={24} color="#c05621" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigActionTitle}>Suggest Next Visit</Text>
            <Text style={styles.bigActionSub}>Propose a follow-up date — patient confirms</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.bigAction} onPress={handleMarkComplete} disabled={completing || visitDone}>
          <View style={[styles.bigIcon, { backgroundColor: COLORS.successSoft }]}>
            {completing
              ? <ActivityIndicator color={COLORS.success} />
              : <Ionicons name={visitDone ? 'checkmark-done-circle' : 'checkmark-circle-outline'} size={24} color={COLORS.success} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigActionTitle}>{visitDone ? 'Visit completed' : 'Mark Visit Complete'}</Text>
            <Text style={styles.bigActionSub}>Close this consultation</Text>
          </View>
          {!visitDone && <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />}
        </TouchableOpacity>

        {/* 5. History shortcut */}
        <Text style={styles.sectionLabel}>Records</Text>
        <TouchableOpacity
          style={styles.bigAction}
          onPress={() => navigation.navigate('PatientHistory', { patientId: pid })}
        >
          <View style={[styles.bigIcon, { backgroundColor: COLORS.successSoft }]}>
            <Ionicons name="document-text-outline" size={24} color={COLORS.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bigActionTitle}>Medical History</Text>
            <Text style={styles.bigActionSub}>Visits, lab reports, pharmacy orders</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </ScrollView>

      {/* Vitals modal */}
      <Modal visible={vitalsModal} animationType="slide" transparent onRequestClose={() => setVitalsModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Record Vitals</Text>
                <TouchableOpacity onPress={() => setVitalsModal(false)}><Ionicons name="close" size={22} color={COLORS.text} /></TouchableOpacity>
              </View>
              <Text style={styles.modalSub}>Enter the readings you measured. All fields are optional.</Text>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* BP */}
                <Text style={styles.vLabel}>Blood Pressure (mmHg)</Text>
                <View style={styles.vRow}>
                  <View style={styles.vFieldWrap}>
                    <TextInput style={styles.vInput} placeholder="Systolic" placeholderTextColor={COLORS.textSecondary}
                      keyboardType="numeric" value={vBpSys} onChangeText={setVBpSys} maxLength={3} />
                    <Text style={styles.vUnit}>SYS</Text>
                  </View>
                  <Text style={styles.vSep}>/</Text>
                  <View style={styles.vFieldWrap}>
                    <TextInput style={styles.vInput} placeholder="Diastolic" placeholderTextColor={COLORS.textSecondary}
                      keyboardType="numeric" value={vBpDia} onChangeText={setVBpDia} maxLength={3} />
                    <Text style={styles.vUnit}>DIA</Text>
                  </View>
                </View>

                {/* Temp */}
                <Text style={styles.vLabel}>Temperature (°C)</Text>
                <View style={styles.vFieldWrap}>
                  <TextInput style={[styles.vInput, { flex: 1 }]} placeholder="e.g. 37.2" placeholderTextColor={COLORS.textSecondary}
                    keyboardType="decimal-pad" value={vTemp} onChangeText={setVTemp} maxLength={5} />
                  <Text style={styles.vUnit}>°C</Text>
                </View>

                {/* Pulse */}
                <Text style={styles.vLabel}>Pulse (bpm)</Text>
                <View style={styles.vFieldWrap}>
                  <TextInput style={[styles.vInput, { flex: 1 }]} placeholder="e.g. 72" placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric" value={vPulse} onChangeText={setVPulse} maxLength={3} />
                  <Text style={styles.vUnit}>BPM</Text>
                </View>

                {/* SpO2 */}
                <Text style={styles.vLabel}>SpO₂ (%)</Text>
                <View style={styles.vFieldWrap}>
                  <TextInput style={[styles.vInput, { flex: 1 }]} placeholder="e.g. 98" placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric" value={vSpo2} onChangeText={setVSpo2} maxLength={3} />
                  <Text style={styles.vUnit}>%</Text>
                </View>

                {/* Weight */}
                <Text style={styles.vLabel}>Weight (kg)</Text>
                <View style={styles.vFieldWrap}>
                  <TextInput style={[styles.vInput, { flex: 1 }]} placeholder="e.g. 68" placeholderTextColor={COLORS.textSecondary}
                    keyboardType="decimal-pad" value={vWeight} onChangeText={setVWeight} maxLength={6} />
                  <Text style={styles.vUnit}>kg</Text>
                </View>
                <View style={{ height: 20 }} />
              </ScrollView>
              <TouchableOpacity style={styles.modalConfirm} onPress={handleSaveVitals} disabled={savingVitals}>
                {savingVitals ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.modalConfirmText}>Save Vitals</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Follow-up modal */}
      <Modal visible={followModal} animationType="slide" transparent onRequestClose={() => setFollowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Suggest Next Visit</Text>
              <TouchableOpacity onPress={() => setFollowModal(false)}><Ionicons name="close" size={22} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>Pick a follow-up date and time. {patient?.name} will be notified to confirm or change it.</Text>

            <Text style={styles.pickLabel}>Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {FOLLOWUP_DAYS.map((d, i) => (
                <TouchableOpacity key={d.iso} style={[styles.dayPill, followDay === i && styles.dayPillActive]} onPress={() => setFollowDay(i)}>
                  <Text style={[styles.dayPillText, followDay === i && { color: COLORS.white }]}>{d.day} {d.num}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.pickLabel}>Time</Text>
            {followLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 14 }} />
            ) : followSlots.length === 0 ? (
              <Text style={styles.slotEmpty}>No consulting hours on that day.</Text>
            ) : (
              <View style={styles.slotsGrid}>
                {followSlots.map(slot => {
                  const sel = followSlot?.time === slot.time && followSlot?.sessionId === slot.sessionId;
                  const taken = slot.state === SLOT_STATE.FULL;
                  const off = slot.state === SLOT_STATE.BLOCKED || slot.state === SLOT_STATE.PAST;
                  return (
                    <TouchableOpacity
                      key={`${slot.sessionId}-${slot.time}`}
                      disabled={taken || off}
                      style={[
                        styles.slotPill,
                        sel && styles.slotPillActive,
                        taken && styles.slotPillTaken,
                        off && styles.slotPillOff,
                      ]}
                      onPress={() => setFollowSlot(slot)}>
                      <Text style={[
                        styles.slotText,
                        sel && { color: COLORS.white },
                        taken && styles.slotTextTaken,
                      ]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.modalConfirm} onPress={handleSuggestFollowUp} disabled={sendingFollow}>
              {sendingFollow ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.modalConfirmText}>Suggest Follow-up</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
