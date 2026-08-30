import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import styles from './OPDHome.styles';

const DB_TO_OPD = { scheduled: 'waiting', in_progress: 'called', completed: 'seen' };
const fmtT = (iso) => { try { return new Date(iso).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }); } catch { return ''; } };

// ─────────────────────────────────────────────────────────────────────────────
// OPDHome — shown when role === 'opd_assistant'
// OPD assistant manages the appointment queue:
//   - Check in walk-in patients (assign token)
//   - Mark patients as seen / called
//   - View today's pre-booked appointments
//
// When Supabase is connected:
// const { data: queue } = await supabase
//   .from('appointments')
//   .select('*, patients(name, age, gender, phone), providers(name)')
//   .eq('hospital_id', user.hospitalId)
//   .eq('date', today)
//   .order('token_no');
//
// Real-time updates via supabase.channel('opd-queue').on('postgres_changes', ...)
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_QUEUE = [
  { id: 'q1', tokenNo: 1, name: 'Rubina Sharma', age: 34, gender: 'F', doctor: 'Dr. Mehra',     type: 'OPD',      time: '09:30 AM', status: 'called' },
  { id: 'q2', tokenNo: 2, name: 'Mohan Kumar',   age: 52, gender: 'M', doctor: 'Dr. Banerjee', type: 'Follow-up',time: '10:15 AM', status: 'waiting' },
  { id: 'q3', tokenNo: 3, name: 'Anna Doe',      age: 28, gender: 'F', doctor: 'Dr. Mehra',     type: 'OPD',      time: '11:00 AM', status: 'waiting' },
  { id: 'q4', tokenNo: 4, name: 'Rajan Mehta',   age: 61, gender: 'M', doctor: 'Dr. Iyer',      type: 'Review',   time: '11:45 AM', status: 'waiting' },
  { id: 'q5', tokenNo: 5, name: 'Priya Nair',    age: 23, gender: 'F', doctor: 'Dr. Roy',        type: 'OPD',      time: '12:30 PM', status: 'waiting' },
];

const STATUS_CONFIG = {
  waiting: { label: 'Waiting',  bg: COLORS.warningSoft, text: '#c05621', icon: 'time-outline' },
  called:  { label: 'Called',   bg: COLORS.primarySoft, text: COLORS.primary, icon: 'megaphone-outline' },
  seen:    { label: 'Seen',     bg: COLORS.successSoft, text: COLORS.success, icon: 'checkmark-circle-outline' },
};

const DOCTORS = ['Dr. Mehra', 'Dr. Banerjee', 'Dr. Iyer', 'Dr. Roy', 'Dr. Das'];

export default function OPDHome({ navigation }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState(MOCK_QUEUE);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: '', age: '', phone: '', doctor: DOCTORS[0], type: 'OPD' });

  useEffect(() => {
    (async () => {
      try {
        if (!user?.hospitalId) return;
        const { data } = await supabase
          .from('appointments')
          .select('id, type, status, scheduled_at, token_no, profiles(name, gender), staff(name)')
          .eq('organisation_id', user.hospitalId)
          .order('scheduled_at');
        const rows = (data || []).filter(a => DB_TO_OPD[a.status]);
        // Real org queue (even if empty) — never show fake data once connected.
        setQueue(rows.map((a, i) => ({
          id: a.id,
          tokenNo: a.token_no || i + 1,
          name: a.profiles?.name || 'Patient',
          age: '—',
          gender: a.profiles?.gender || '—',
          doctor: a.staff?.name || '',
          type: a.type === 'clinic' ? 'OPD' : (a.type || 'OPD'),
          time: fmtT(a.scheduled_at),
          status: DB_TO_OPD[a.status] || 'waiting',
        })));
      } catch (e) { /* keep mock */ }
    })();
  }, [user?.hospitalId]);

  const waiting = queue.filter(q => q.status === 'waiting').length;
  const called  = queue.filter(q => q.status === 'called').length;
  const seen    = queue.filter(q => q.status === 'seen').length;

  // OPD status → DB appointment status
  const OPD_TO_DB = { waiting: 'scheduled', called: 'in_progress', seen: 'completed' };
  const persist = (id, opdStatus) => {
    if (String(id).includes('-')) {
      supabase.from('appointments').update({ status: OPD_TO_DB[opdStatus] }).eq('id', id).then(() => {}, () => {});
    }
  };

  const callNext = () => {
    const nextWaiting = queue.find(q => q.status === 'waiting');
    if (!nextWaiting) { Alert.alert('Queue clear', 'No more patients waiting.'); return; }
    setQueue(prev => prev.map(q => {
      if (q.id === nextWaiting.id) { persist(q.id, 'called'); return { ...q, status: 'called' }; }
      if (q.status === 'called') { persist(q.id, 'seen'); return { ...q, status: 'seen' }; }
      return q;
    }));
  };

  const markStatus = (id, status) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    persist(id, status);
  };

  const handleCheckIn = () => {
    if (!newPatient.name.trim() || !newPatient.phone.trim()) {
      Alert.alert('Missing info', 'Name and phone are required.');
      return;
    }
    const nextToken = Math.max(...queue.map(q => q.tokenNo), 0) + 1;
    const entry = {
      id: `q${Date.now()}`,
      tokenNo: nextToken,
      name: newPatient.name.trim(),
      age: parseInt(newPatient.age) || 0,
      gender: '?',
      doctor: newPatient.doctor,
      type: newPatient.type,
      time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      status: 'waiting',
    };
    // → await supabase.from('appointments').insert({ ...entry, hospital_id: user.hospitalId, is_walkin: true });
    setQueue(prev => [...prev, entry]);
    setShowCheckIn(false);
    setNewPatient({ name: '', age: '', phone: '', doctor: DOCTORS[0], type: 'OPD' });
    Alert.alert('Checked In', `${entry.name} added as Token #${nextToken}`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.role}>OPD Assistant</Text>
          <Text style={styles.hospitalName}>{user?.hospitalName || 'Hospital'}</Text>
        </View>
        <TouchableOpacity style={styles.callNextBtn} onPress={callNext}>
          <Ionicons name="megaphone" size={16} color={COLORS.white} />
          <Text style={styles.callNextText}>Call Next</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Waiting', value: waiting, color: '#c05621',      bg: COLORS.warningSoft },
          { label: 'Called',  value: called,  color: COLORS.primary, bg: COLORS.primarySoft },
          { label: 'Seen',    value: seen,    color: COLORS.success,  bg: COLORS.successSoft },
          { label: 'Total',   value: queue.length, color: COLORS.text, bg: COLORS.surface },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.m, gap: 10 }}>
        {/* Walk-in check-in */}
        {showCheckIn ? (
          <View style={styles.checkInCard}>
            <View style={styles.checkInHeader}>
              <Text style={styles.checkInTitle}>Walk-in Check-In</Text>
              <TouchableOpacity onPress={() => setShowCheckIn(false)}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {[
              { key: 'name',  label: 'Patient Name *', placeholder: 'Full name' },
              { key: 'phone', label: 'Phone *',         placeholder: '+91 XXXXX XXXXX', keyboard: 'phone-pad' },
              { key: 'age',   label: 'Age',              placeholder: '—',               keyboard: 'numeric' },
            ].map(f => (
              <View key={f.key}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={newPatient[f.key]}
                  onChangeText={v => setNewPatient(p => ({ ...p, [f.key]: v }))}
                  placeholder={f.placeholder}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType={f.keyboard || 'default'}
                />
              </View>
            ))}
            <Text style={styles.fieldLabel}>Doctor</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {DOCTORS.map(d => (
                  <TouchableOpacity key={d}
                    style={[styles.chip, newPatient.doctor === d && styles.chipActive]}
                    onPress={() => setNewPatient(p => ({ ...p, doctor: d }))}>
                    <Text style={[styles.chipText, newPatient.doctor === d && styles.chipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {['OPD', 'Follow-up', 'Emergency'].map(t => (
                <TouchableOpacity key={t}
                  style={[styles.chip, newPatient.type === t && styles.chipActive]}
                  onPress={() => setNewPatient(p => ({ ...p, type: t }))}>
                  <Text style={[styles.chipText, newPatient.type === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.checkInConfirmBtn} onPress={handleCheckIn}>
              <Ionicons name="person-add" size={18} color={COLORS.white} />
              <Text style={styles.checkInConfirmText}>Assign Token & Check In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addWalkInBtn} onPress={() => setShowCheckIn(true)}>
            <Ionicons name="person-add" size={18} color={COLORS.primary} />
            <Text style={styles.addWalkInText}>Check In Walk-in Patient</Text>
          </TouchableOpacity>
        )}

        {/* Queue */}
        <Text style={styles.queueTitle}>Today's Queue</Text>
        {queue.map(item => {
          const s = STATUS_CONFIG[item.status];
          return (
            <View key={item.id} style={styles.queueCard}>
              <View style={styles.tokenBox}>
                <Text style={styles.tokenNo}>{item.tokenNo}</Text>
              </View>
              <View style={styles.queueInfo}>
                <Text style={styles.queueName}>{item.name}</Text>
                <Text style={styles.queueMeta}>{item.age}y · {item.type} · {item.doctor}</Text>
                <Text style={styles.queueTime}>{item.time}</Text>
              </View>
              <View style={styles.queueRight}>
                <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon} size={12} color={s.text} />
                  <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                </View>
                {item.status !== 'seen' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, item.status === 'waiting' ? styles.callBtn : styles.seenBtn]}
                    onPress={() => markStatus(item.id, item.status === 'waiting' ? 'called' : 'seen')}>
                    <Text style={styles.actionBtnText}>{item.status === 'waiting' ? 'Call' : 'Mark Seen'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
