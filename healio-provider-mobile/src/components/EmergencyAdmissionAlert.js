import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
  Vibration, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';

// Full-screen alarm for RMP-raised emergency admissions (migration-046).
// Mounted once alongside the hospital tabs: when a pending admission arrives
// for this org, the screen BLINKS red, the phone VIBRATES, and staff get a
// 5-minute countdown to accept or decline. Unanswered → marked expired.

const VIBRATION_PATTERN = [0, 700, 500];   // buzz 0.7s, pause 0.5s, repeat

const TRIAGE_LABEL = {
  critical: { label: 'CRITICAL', color: '#fecaca' },
  urgent:   { label: 'URGENT',   color: '#fde68a' },
  stable:   { label: 'STABLE',   color: '#bbf7d0' },
};

function mmss(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function EmergencyAdmissionAlert() {
  const [admission, setAdmission] = useState(null);   // pending row being alarmed
  const [remaining, setRemaining] = useState(0);
  const [acting, setActing] = useState(null);         // 'accept' | 'decline'
  const blink = useRef(new Animated.Value(0)).current;
  const tickRef = useRef(null);

  const doctors = useStore(state => state.doctors);
  const requestedDoctor = admission?.doctor_staff_id
    ? doctors.find(d => d.id === admission.doctor_staff_id)?.name
    : null;

  const dismiss = useCallback(() => {
    Vibration.cancel();
    if (tickRef.current) clearInterval(tickRef.current);
    setAdmission(null);
    setActing(null);
  }, []);

  // ── Watch for incoming admissions ────────────────────────────────────────────
  useEffect(() => {
    let channel; let cancelled = false;

    const isLive = (row) =>
      row && row.status === 'pending' && new Date(row.expires_at).getTime() > Date.now();

    (async () => {
      const orgId = await useStore.getState().resolveOrgId();
      if (!orgId || cancelled) return;

      // Anything already ringing (e.g. app was closed when it arrived)?
      const { data } = await supabase
        .from('emergency_admissions')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (!cancelled && isLive(data?.[0])) setAdmission(data[0]);

      channel = supabase
        .channel(`emadm-alert-${orgId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'emergency_admissions', filter: `organisation_id=eq.${orgId}` },
          (payload) => { if (isLive(payload.new)) setAdmission(payload.new); }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'emergency_admissions', filter: `organisation_id=eq.${orgId}` },
          (payload) => {
            // Answered on another device → stop ringing here.
            setAdmission(prev =>
              prev && payload.new?.id === prev.id && payload.new?.status !== 'pending' ? null : prev);
          }
        )
        .subscribe();
    })();

    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, []);

  // ── Ring: blink + vibrate + countdown while an admission is up ───────────────
  useEffect(() => {
    if (!admission) return;

    Vibration.vibrate(VIBRATION_PATTERN, true);

    const loop = Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 450, useNativeDriver: false }),
      Animated.timing(blink, { toValue: 0, duration: 450, useNativeDriver: false }),
    ]));
    loop.start();

    const deadline = new Date(admission.expires_at).getTime();
    const tick = () => {
      const left = Math.round((deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        // Ran out — mark expired (best effort) and stop ringing.
        supabase.from('emergency_admissions')
          .update({ status: 'expired', responded_at: new Date().toISOString() })
          .eq('id', admission.id).eq('status', 'pending')
          .then(() => {});
        dismiss();
      }
    };
    tick();
    tickRef.current = setInterval(tick, 1000);

    return () => {
      Vibration.cancel();
      loop.stop();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [admission?.id]);

  const respond = async (nextStatus) => {
    setActing(nextStatus === 'accepted' ? 'accept' : 'decline');
    try {
      const { data, error } = await supabase
        .from('emergency_admissions')
        .update({ status: nextStatus, responded_at: new Date().toISOString() })
        .eq('id', admission.id)
        .eq('status', 'pending')       // lose gracefully if answered elsewhere
        .select('id');
      if (error) throw error;
      const won = (data || []).length > 0;
      dismiss();
      if (nextStatus === 'accepted' && won) {
        useStore.getState().hydrateFromSupabase();   // patient → Patients tab
        Alert.alert(
          'Admission accepted ✓',
          `${admission.patient_name || 'The patient'} is on the way. Their details are in the Patients tab — prepare a bed.`
        );
      }
    } catch (e) {
      setActing(null);
      Alert.alert('Could not respond', e?.message || 'Please try again.');
    }
  };

  if (!admission) return null;

  const bg = blink.interpolate({ inputRange: [0, 1], outputRange: ['#7f1d1d', '#dc2626'] });
  const triage = TRIAGE_LABEL[admission.triage] || TRIAGE_LABEL.critical;

  return (
    <Modal animationType="fade" visible onRequestClose={() => {}}>
      <Animated.View style={[styles.screen, { backgroundColor: bg }]}>

        <View style={styles.header}>
          <Ionicons name="warning" size={30} color="#fff" />
          <Text style={styles.headerText}>EMERGENCY ADMISSION</Text>
          <Ionicons name="warning" size={30} color="#fff" />
        </View>

        <Text style={styles.timer}>{mmss(remaining)}</Text>
        <Text style={styles.timerHint}>to respond before this request expires</Text>

        <View style={styles.card}>
          <View style={styles.cardRowTop}>
            <Text style={styles.patientName}>{admission.patient_name || 'Patient'}</Text>
            <View style={[styles.triagePill, { backgroundColor: triage.color }]}>
              <Text style={styles.triagePillText}>{triage.label}</Text>
            </View>
          </View>
          {!!admission.patient_phone && <Text style={styles.cardMeta}>{admission.patient_phone}</Text>}

          <View style={styles.divider} />
          <Text style={styles.cardLabel}>CHIEF COMPLAINT</Text>
          <Text style={styles.cardValue}>{admission.complaint || 'Not specified'}</Text>

          {!!admission.notes && (
            <>
              <Text style={styles.cardLabel}>NOTES</Text>
              <Text style={styles.cardValue}>{admission.notes}</Text>
            </>
          )}

          <View style={styles.divider} />
          <Text style={styles.cardMeta}>
            Sent by {admission.rmp_name || 'Healthcare Consultant'}
            {requestedDoctor ? ` · Requests ${requestedDoctor}` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={() => respond('accepted')}
          disabled={!!acting}
        >
          {acting === 'accept'
            ? <ActivityIndicator color="#166534" />
            : <>
                <Ionicons name="checkmark-circle" size={24} color="#166534" />
                <Text style={styles.acceptText}>ACCEPT ADMISSION</Text>
              </>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.declineBtn}
          onPress={() => respond('declined')}
          disabled={!!acting}
        >
          {acting === 'decline'
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.declineText}>Decline — cannot take this patient</Text>}
        </TouchableOpacity>

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { color: '#fff', fontSize: 19, fontWeight: '900', letterSpacing: 1 },
  timer: { color: '#fff', fontSize: 64, fontWeight: '900', marginTop: 18, fontVariant: ['tabular-nums'] },
  timerHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, marginBottom: 22 },

  card: {
    alignSelf: 'stretch', backgroundColor: '#fff', borderRadius: 20, padding: 18,
  },
  cardRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  patientName: { fontSize: 20, fontWeight: '800', color: '#111827', flex: 1, marginRight: 10 },
  triagePill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  triagePillText: { fontSize: 11, fontWeight: '900', color: '#111827', letterSpacing: 0.5 },
  cardMeta: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 12 },
  cardLabel: { fontSize: 10.5, fontWeight: '800', color: '#9ca3af', letterSpacing: 0.7, marginTop: 6 },
  cardValue: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 3 },

  acceptBtn: {
    alignSelf: 'stretch', height: 60, borderRadius: 18, backgroundColor: '#bbf7d0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22,
  },
  acceptText: { color: '#166534', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },
  declineBtn: {
    alignSelf: 'stretch', height: 48, borderRadius: 16, marginTop: 12,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  declineText: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
});
