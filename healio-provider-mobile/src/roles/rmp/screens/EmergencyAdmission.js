import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { CustomButton } from '../components/CustomButton';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import { fetchHospitals, fetchHospitalDoctors, createEmergencyAdmission } from '../services/api';

const TRIAGE = [
  { key: 'critical', label: 'Critical', color: '#dc2626', bg: '#fee2e2' },
  { key: 'urgent',   label: 'Urgent',   color: '#c05621', bg: '#fdf6e2' },
  { key: 'stable',   label: 'Stable',   color: '#2f855a', bg: '#ebfaf0' },
];

function mmss(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Raise an emergency admission for a linked patient: pick hospital (+ optional
// doctor), triage and complaint → the hospital app alarms and must accept
// within 5 minutes. This screen then LIVE-tracks the answer via realtime.
export default function EmergencyAdmission({ navigation, route }) {
  const patient = route?.params?.patient;
  const { user } = useAuth();
  const rmpId = user?.userId;
  const rmpName = user?.name;

  // form state
  const [hospitals, setHospitals] = useState([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [hospitalId, setHospitalId] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [doctorId, setDoctorId] = useState(null);          // optional
  const [triage, setTriage] = useState('critical');
  const [complaint, setComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  // waiting state (after submit)
  const [admission, setAdmission] = useState(null);        // { id, expires_at }
  const [outcome, setOutcome] = useState(null);            // 'accepted' | 'declined' | 'expired'
  const [remaining, setRemaining] = useState(0);
  const tickRef = useRef(null);

  useEffect(() => {
    fetchHospitals()
      .then(setHospitals)
      .catch(e => Alert.alert('Could not load hospitals', e?.message || 'Please try again.'))
      .finally(() => setLoadingHospitals(false));
  }, []);

  // Load the chosen hospital's doctors (optional pick).
  useEffect(() => {
    if (!hospitalId) { setDoctors([]); setDoctorId(null); return; }
    setLoadingDoctors(true);
    setDoctorId(null);
    fetchHospitalDoctors(hospitalId)
      .then(setDoctors)
      .catch(() => setDoctors([]))
      .finally(() => setLoadingDoctors(false));
  }, [hospitalId]);

  // After submit: countdown + live status from the hospital's response.
  useEffect(() => {
    if (!admission) return;

    const deadline = new Date(admission.expires_at).getTime();
    const tick = () => {
      const left = Math.round((deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        clearInterval(tickRef.current);
        setOutcome(prev => prev || 'expired');
      }
    };
    tick();
    tickRef.current = setInterval(tick, 1000);

    const channel = supabase
      .channel(`emadm-${admission.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'emergency_admissions', filter: `id=eq.${admission.id}` },
        (payload) => {
          const s = payload.new?.status;
          if (s && s !== 'pending') {
            clearInterval(tickRef.current);
            setOutcome(s);
          }
        }
      )
      .subscribe();

    return () => { clearInterval(tickRef.current); supabase.removeChannel(channel); };
  }, [admission]);

  const handleSend = async () => {
    if (!hospitalId) return Alert.alert('Pick a hospital', 'Select the hospital to alert.');
    if (!complaint.trim()) return Alert.alert('Chief complaint required', 'Describe the emergency in a few words.');
    setSending(true);
    try {
      const row = await createEmergencyAdmission({
        rmpId, rmpName, patient, hospitalId,
        doctorStaffId: doctorId, triage,
        complaint: complaint.trim(), notes: notes.trim(),
      });
      setAdmission(row);
    } catch (e) {
      Alert.alert('Could not send', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Emergency Admission" onBack={() => navigation.goBack()} />
        <Text style={styles.emptyText}>No patient selected.</Text>
      </SafeAreaView>
    );
  }

  // ── Waiting / outcome view ────────────────────────────────────────────────────
  if (admission) {
    const hospital = hospitals.find(h => h.id === hospitalId);
    const cfg = {
      accepted: { icon: 'checkmark-circle', color: '#16a34a', title: 'Admission accepted ✓',
                  text: `${hospital?.name || 'The hospital'} has accepted the emergency admission. Take ${patient.name} there now.` },
      declined: { icon: 'close-circle', color: '#dc2626', title: 'Admission declined',
                  text: `${hospital?.name || 'The hospital'} cannot take this admission. Try another hospital immediately.` },
      expired:  { icon: 'time', color: '#c05621', title: 'No response',
                  text: `${hospital?.name || 'The hospital'} did not respond in 5 minutes. Try another hospital immediately.` },
    }[outcome];

    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Emergency Admission" onBack={() => navigation.goBack()} />
        <View style={styles.waitBody}>
          {!outcome ? (
            <>
              <View style={styles.pulseRing}>
                <ActivityIndicator size="large" color="#dc2626" />
              </View>
              <Text style={styles.waitTitle}>Alerting {hospital?.name || 'hospital'}…</Text>
              <Text style={styles.waitText}>
                The hospital's app is ringing. They have {mmss(remaining)} to accept.
              </Text>
              <Text style={styles.waitTimer}>{mmss(remaining)}</Text>
              <Text style={styles.waitHint}>Keep this screen open — the answer appears here instantly.</Text>
            </>
          ) : (
            <>
              <Ionicons name={cfg.icon} size={72} color={cfg.color} />
              <Text style={[styles.waitTitle, { color: cfg.color }]}>{cfg.title}</Text>
              <Text style={styles.waitText}>{cfg.text}</Text>
              {outcome === 'accepted' ? (
                <CustomButton title="Done" onPress={() => navigation.goBack()} />
              ) : (
                <CustomButton title="Try Another Hospital" onPress={() => {
                  setAdmission(null); setOutcome(null); setHospitalId(null); setDoctorId(null);
                }} />
              )}
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Form view ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Emergency Admission" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Patient */}
        <View style={styles.patientCard}>
          <Avatar name={patient.name} size={44} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.patientName}>{patient.name}</Text>
            <Text style={styles.patientMeta}>
              {patient.phone}{patient.age != null ? ` · ${patient.age} yrs` : ''}{patient.gender ? ` · ${patient.gender}` : ''}
            </Text>
          </View>
          <View style={styles.sosPill}><Text style={styles.sosPillText}>SOS</Text></View>
        </View>

        {/* Hospital */}
        <Text style={styles.fieldLabel}>Hospital *</Text>
        {loadingHospitals ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
        ) : hospitals.map(h => (
          <TouchableOpacity
            key={h.id}
            style={[styles.pickRow, hospitalId === h.id && styles.pickRowActive]}
            onPress={() => setHospitalId(h.id)}
          >
            <Ionicons name="business-outline" size={18} color={hospitalId === h.id ? COLORS.primary : COLORS.textSecondary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickName, hospitalId === h.id && { color: COLORS.primary }]}>{h.name}</Text>
              {!!h.city && <Text style={styles.pickSub}>{h.city}</Text>}
            </View>
            <Ionicons
              name={hospitalId === h.id ? 'radio-button-on' : 'radio-button-off'}
              size={19} color={hospitalId === h.id ? COLORS.primary : COLORS.border}
            />
          </TouchableOpacity>
        ))}

        {/* Doctor (optional) */}
        {!!hospitalId && (
          <>
            <Text style={styles.fieldLabel}>Doctor (optional)</Text>
            {loadingDoctors ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
            ) : doctors.length === 0 ? (
              <Text style={styles.noDocs}>No doctors listed — the hospital will assign one.</Text>
            ) : doctors.map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.pickRow, doctorId === d.id && styles.pickRowActive]}
                onPress={() => setDoctorId(doctorId === d.id ? null : d.id)}
              >
                <Ionicons name="medkit-outline" size={18} color={doctorId === d.id ? COLORS.primary : COLORS.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickName, doctorId === d.id && { color: COLORS.primary }]}>{d.name}</Text>
                  <Text style={styles.pickSub}>{d.specialty}</Text>
                </View>
                <Ionicons
                  name={doctorId === d.id ? 'radio-button-on' : 'radio-button-off'}
                  size={19} color={doctorId === d.id ? COLORS.primary : COLORS.border}
                />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Triage */}
        <Text style={styles.fieldLabel}>Condition</Text>
        <View style={styles.triageRow}>
          {TRIAGE.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.triageChip, triage === t.key && { backgroundColor: t.bg, borderColor: t.color }]}
              onPress={() => setTriage(t.key)}
            >
              <Text style={[styles.triageText, triage === t.key && { color: t.color }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Complaint */}
        <Text style={styles.fieldLabel}>Chief Complaint *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chest pain, unconscious, road accident"
          placeholderTextColor={COLORS.textSecondary}
          value={complaint}
          onChangeText={setComplaint}
        />

        {/* Notes */}
        <Text style={styles.fieldLabel}>Notes for the hospital</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Vitals, allergies, how far away you are…"
          placeholderTextColor={COLORS.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.sosBtn, sending && { opacity: 0.7 }]} onPress={handleSend} disabled={sending}>
          {sending
            ? <ActivityIndicator color="#fff" />
            : <>
                <Ionicons name="alert-circle" size={20} color="#fff" />
                <Text style={styles.sosBtnText}>Send Emergency Alert</Text>
              </>}
        </TouchableOpacity>
        <Text style={styles.footerHint}>The hospital gets 5 minutes to accept before it expires.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  emptyText: { textAlign: 'center', marginTop: 60, color: COLORS.textSecondary },

  patientCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff7f7', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 14, padding: 14, marginTop: 20,
  },
  patientName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  patientMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  sosPill: { backgroundColor: '#dc2626', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  sosPillText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: COLORS.text, marginTop: 20, marginBottom: 8 },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 13,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    backgroundColor: COLORS.white,
  },
  pickRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  pickName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  pickSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  noDocs: { fontSize: 12.5, color: COLORS.textSecondary, fontStyle: 'italic', marginBottom: 4 },

  triageRow: { flexDirection: 'row', gap: 10 },
  triageChip: {
    flex: 1, height: 38, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
  },
  triageText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },

  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 13,
    paddingHorizontal: 14, height: 48, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  inputMultiline: { height: 84, paddingTop: 12, textAlignVertical: 'top' },

  footer: {
    paddingHorizontal: 24, paddingTop: 10, paddingBottom: 18,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  sosBtn: {
    height: 54, borderRadius: 16, backgroundColor: '#dc2626',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sosBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  footerHint: { fontSize: 11.5, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8 },

  // waiting / outcome
  waitBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 14 },
  pulseRing: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#fee2e2',
    alignItems: 'center', justifyContent: 'center',
  },
  waitTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  waitText: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  waitTimer: { fontSize: 40, fontWeight: '800', color: '#dc2626', fontVariant: ['tabular-nums'] },
  waitHint: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center' },
});
