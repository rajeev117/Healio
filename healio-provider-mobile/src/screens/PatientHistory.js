import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import styles from './PatientHistory.styles';

const TYPE_FILTER = [
  { id: 'all', label: 'All' },
  { id: 'visit', label: 'Visits' },
  { id: 'lab', label: 'Labs' },
  { id: 'pharmacy', label: 'Pharmacy' },
];

const fmtDate = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return ''; }
};

const TYPE_STYLE = {
  visit:    { icon: 'medkit',  iconColor: COLORS.primary, iconBg: COLORS.primarySoft },
  lab:      { icon: 'flask',   iconColor: '#3b82f6',      iconBg: '#eef6ff' },
  pharmacy: { icon: 'bandage', iconColor: COLORS.warning, iconBg: COLORS.warningSoft },
  record:   { icon: 'document-text', iconColor: COLORS.success, iconBg: COLORS.successSoft },
};

export default function PatientHistory({ navigation, route }) {
  const patientId = route?.params?.patientId;
  const patient = useStore(state => state.patients?.find(p => p.id === patientId) || state.patients?.[0]) || {
    name: 'Patient', age: '—', gender: '—', bloodGroup: '—',
  };
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const pid = patient?.id;
    if (!pid) { setLoaded(true); return; }
    (async () => {
      try {
        const [appts, rx, labs, pharm] = await Promise.all([
          supabase.from('appointments').select('id, type, status, scheduled_at, doctor_notes, staff(name)').eq('patient_id', pid).order('scheduled_at', { ascending: false }),
          supabase.from('prescriptions').select('id, medicines, instructions, created_at, staff(name)').eq('patient_id', pid).order('created_at', { ascending: false }),
          supabase.from('lab_orders').select('id, tests, status, created_at').eq('patient_id', pid).order('created_at', { ascending: false }),
          supabase.from('pharmacy_orders').select('id, items, status, created_at').eq('patient_id', pid).order('created_at', { ascending: false }),
        ]);

        const events = [];
        (appts.data || []).forEach(a => events.push({
          id: `a-${a.id}`, type: 'visit', date: fmtDate(a.scheduled_at), ts: a.scheduled_at,
          title: a.type === 'video' ? 'Video Consultation' : a.type === 'homecare' ? 'Home Visit' : 'Clinic Visit',
          doctor: a.staff?.name || 'Doctor',
          diagnosis: null, notes: a.doctor_notes || `Status: ${a.status}`,
          prescriptions: [], labOrders: [], ...TYPE_STYLE.visit,
        }));
        (rx.data || []).forEach(p => events.push({
          id: `rx-${p.id}`, type: 'visit', date: fmtDate(p.created_at), ts: p.created_at,
          title: 'Prescription', doctor: p.staff?.name || 'Doctor',
          diagnosis: (p.instructions || '').split('\n')[0]?.replace(/^Diagnosis:\s*/, '') || null,
          notes: p.instructions || '',
          prescriptions: Array.isArray(p.medicines) ? p.medicines.map(m => `${m.name}${m.dosage ? ' · ' + m.dosage : ''}`) : [],
          labOrders: [], ...TYPE_STYLE.visit,
        }));
        (labs.data || []).forEach(l => events.push({
          id: `lab-${l.id}`, type: 'lab', date: fmtDate(l.created_at), ts: l.created_at,
          title: 'Lab Order', doctor: `Status: ${l.status}`, diagnosis: null, notes: '',
          prescriptions: [], labOrders: Array.isArray(l.tests) ? l.tests.map(t => t.name || t) : [], ...TYPE_STYLE.lab,
        }));
        (pharm.data || []).forEach(o => events.push({
          id: `ph-${o.id}`, type: 'pharmacy', date: fmtDate(o.created_at), ts: o.created_at,
          title: 'Pharmacy Order', doctor: `Status: ${o.status}`, diagnosis: null,
          notes: Array.isArray(o.items) ? o.items.map(i => `${i.name}${i.quantity ? ' x ' + i.quantity : ''}`).join(', ') : '',
          prescriptions: [], labOrders: [], ...TYPE_STYLE.pharmacy,
        }));

        events.sort((a, b) => new Date(b.ts || 0) - new Date(a.ts || 0));
        setHistory(events);
      } catch (e) {
        setHistory([]);
      } finally {
        setLoaded(true);
      }
    })();
  }, [patient?.id]);

  const filtered = filter === 'all' ? history : history.filter(h => h.type === filter);
  const initials = patient.name?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'P';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medical History</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('PatientRecords', { patientId: patient?.id, patientName: patient?.name })}
          style={styles.recordsBtn}
        >
          <Ionicons name="folder-open-outline" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Patient card */}
        <View style={styles.patientCard}>
          <View style={styles.patientAvatar}>
            <Text style={styles.patientInitials}>{initials}</Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{patient.name}</Text>
            <Text style={styles.patientMeta}>
              {patient.age} yrs · {patient.gender || 'Male'} · {patient.bloodGroup || 'B+'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addVisitBtn}
            onPress={() => navigation.navigate('PatientVisitDetail', { patientId: patient.id })}
          >
            <Ionicons name="add" size={16} color={COLORS.white} />
            <Text style={styles.addVisitText}>New Visit</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline filter */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Timeline</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {TYPE_FILTER.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
              onPress={() => setFilter(f.id)}
            >
              <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Timeline events */}
        <View style={styles.timeline}>
          {filtered.length === 0 && (
            <Text style={{ color: COLORS.textSecondary, fontSize: 13, paddingVertical: 8 }}>
              {loaded ? 'No history records for this patient yet.' : 'Loading…'}
            </Text>
          )}
          {filtered.map((event, index) => {
            const isExpanded = expandedId === event.id;
            const isLast = index === filtered.length - 1;
            return (
              <View key={event.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineIcon, { backgroundColor: event.iconBg }]}>
                    <Ionicons name={event.icon} size={14} color={event.iconColor} />
                  </View>
                  {!isLast && <View style={styles.timelineLine} />}
                </View>
                <TouchableOpacity
                  style={styles.timelineContent}
                  onPress={() => setExpandedId(isExpanded ? null : event.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.timelineContentHeader}>
                    <View style={styles.timelineContentLeft}>
                      <Text style={styles.timelineTitle}>{event.title}</Text>
                      <Text style={styles.timelineDoctor}>{event.doctor}</Text>
                      <Text style={styles.timelineDate}>{event.date}</Text>
                    </View>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
                  </View>

                  {isExpanded && (
                    <View style={styles.timelineExpanded}>
                      {event.diagnosis && (
                        <View style={styles.diagnosisRow}>
                          <Text style={styles.diagLabel}>Diagnosis: </Text>
                          <Text style={styles.diagValue}>{event.diagnosis}</Text>
                        </View>
                      )}
                      <Text style={styles.expandedNotes}>{event.notes}</Text>
                      {event.prescriptions.length > 0 && (
                        <View style={styles.expandedSection}>
                          <Text style={styles.expandedSectionTitle}>Prescriptions</Text>
                          {event.prescriptions.map(p => (
                            <View key={p} style={styles.expandedChipRow}>
                              <Ionicons name="medical" size={12} color={COLORS.primary} />
                              <Text style={styles.expandedChipText}>{p}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                      {event.labOrders.length > 0 && (
                        <View style={styles.expandedSection}>
                          <Text style={styles.expandedSectionTitle}>Lab Tests</Text>
                          {event.labOrders.map(l => (
                            <View key={l} style={styles.expandedChipRow}>
                              <Ionicons name="flask" size={12} color="#3b82f6" />
                              <Text style={styles.expandedChipText}>{l}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
