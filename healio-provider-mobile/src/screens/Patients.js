import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, ScrollView,
  ActivityIndicator, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { assignDoctor } from '../lib/careFlow';
import { Ionicons } from '@expo/vector-icons';
import ProtectedScreen from '../components/ProtectedScreen';
import styles from './Patients.styles';

const categories = ["All", "Today", "Checked in", "Admitted", "Discharged"];

const APPT_STATUS_LABEL = {
  scheduled:   { label: 'Pending Confirmation', bg: '#fef3c7', text: '#92400e', icon: 'time-outline' },
  in_progress: { label: 'Confirmed',            bg: '#d1fae5', text: '#065f46', icon: 'checkmark-circle-outline' },
  suggested:   { label: 'New Time Suggested',   bg: '#dbeafe', text: '#1e40af', icon: 'calendar-outline' },
  completed:   { label: 'Completed',            bg: '#f0fdf4', text: '#166534', icon: 'checkmark-done-outline' },
  cancelled:   { label: 'Cancelled',            bg: '#fee2e2', text: '#991b1b', icon: 'close-circle-outline' },
};

export default function Patients({ route, navigation }) {
  const paramPatientId = route?.params?.patientId;
  const initialSelectedPatient = useStore(state => 
    paramPatientId ? state.patients.find(p => p.id === paramPatientId) : null
  );

  const patients           = useStore(state => state.patients);
  const doctors            = useStore(state => state.doctors);
  const acceptAppointment  = useStore(state => state.acceptAppointment);
  const declineAppointment = useStore(state => state.declineAppointment);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedPatient, setSelectedPatient] = useState(initialSelectedPatient);
  const [actingAppt, setActingAppt] = useState(null); // id of appointment being actioned
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);
  const [patientProfile, setPatientProfile] = useState(null); // real profile from DB
  const [admitLoading, setAdmitLoading] = useState(false);
  const [admitStatus, setAdmitStatus] = useState(null); // 'admitted' | 'discharged' | null
  const [assignModal, setAssignModal] = useState(false);
  const [assigningId, setAssigningId] = useState(null); // doctor staff id being assigned

  // Live walk-ins: a patient scanning the hospital QR inserts a qr_checkins
  // row (migration-043) — re-hydrate so they pop into this list immediately.
  useEffect(() => {
    let channel; let cancelled = false;
    (async () => {
      const orgId = await useStore.getState().resolveOrgId();
      if (!orgId || cancelled) return;
      useStore.getState().hydrateFromSupabase();
      channel = supabase
        .channel(`patients-checkins-${orgId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'qr_checkins', filter: `organisation_id=eq.${orgId}` },
          () => { useStore.getState().hydrateFromSupabase(); }
        )
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, []);

  // Reusable: load this patient's appointments from the DB
  const loadPatientAppointments = useCallback(async (patientId) => {
    const { data } = await supabase
      .from('appointments')
      .select('id, type, status, scheduled_at, doctor:staff!doctor_staff_id(name)')
      .eq('patient_id', patientId)
      .order('scheduled_at', { ascending: false });
    setPatientAppointments((data || []).map(a => ({
      id: a.id,
      date: new Date(a.scheduled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: new Date(a.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      doctor: a.doctor?.name || 'Doctor',
      type: a.type === 'video' ? 'Video Consultation' : a.type === 'homecare' ? 'Home Visit' : 'Clinic Visit',
      status: a.status,
    })));
  }, []);

  // Load appointments + subscribe to live updates when a patient is selected
  useEffect(() => {
    if (!selectedPatient?.id) { setPatientAppointments([]); setPatientProfile(null); return; }
    const pid = selectedPatient.id;

    // 1. Initial load
    setLoadingAppts(true);
    loadPatientAppointments(pid).catch(() => setPatientAppointments([])).finally(() => setLoadingAppts(false));

    // 1b. Realtime: re-fetch whenever this patient's appointments change
    const channel = supabase
      .channel(`patient-dossier-${pid}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `patient_id=eq.${pid}` },
        () => { loadPatientAppointments(pid).catch(() => {}); }
      )
      .subscribe();

    // 2. Full profile + health records in parallel
    Promise.all([
      supabase.from('profiles')
        .select('blood_group, gender, phone, email, city, name, status')
        .eq('id', selectedPatient.id).maybeSingle(),
      supabase.from('health_records')
        .select('*')
        .eq('patient_id', selectedPatient.id)
        .order('recorded_at', { ascending: false }),
    ]).then(([{ data: prof }, { data: recs }]) => {
      const records = recs || [];
      const allergies  = records.filter(r => r.type === 'allergy').map(r => r.title || r.notes || 'Unknown');
      const conditions = records.filter(r => r.type === 'condition').map(r => r.title || r.notes || 'Unknown');
      const history    = records
        .filter(r => !['allergy','condition'].includes(r.type))
        .map(r => ({
          date:   r.recorded_at ? new Date(r.recorded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
          doctor: r.uploaded_by || 'Doctor',
          note:   r.notes || r.title || '',
        }));

      setAdmitStatus(prof?.status === 'admitted' ? 'admitted' : prof?.status === 'discharged' ? 'discharged' : null);
      setPatientProfile({
        bloodGroup: prof?.blood_group || selectedPatient.bloodGroup || '—',
        gender:     prof?.gender      || selectedPatient.gender     || '—',
        phone:      prof?.phone       || selectedPatient.phone      || '—',
        email:      prof?.email       || selectedPatient.email      || '',
        address:    prof?.city        || selectedPatient.address    || '',
        name:       prof?.name        || selectedPatient.name,
        admitStatus: prof?.status,
        allergies, conditions, history,
      });
    }).catch(() => setPatientProfile(null));

    return () => { supabase.removeChannel(channel); };
  }, [selectedPatient?.id, loadPatientAppointments]);

  const handleAcceptAppt = async (apptId) => {
    setActingAppt(apptId);
    await acceptAppointment(apptId);
    await loadPatientAppointments(selectedPatient.id).catch(() => {});
    setActingAppt(null);
  };

  const handleDeclineAppt = async (apptId) => {
    setActingAppt(apptId);
    await declineAppointment(apptId);
    await loadPatientAppointments(selectedPatient.id).catch(() => {});
    setActingAppt(null);
  };

  // Assign a doctor to this (checked-in) patient — creates a confirmed walk-in
  // appointment via the hospital_assign_doctor RPC, which then appears in the
  // patient's and the doctor's apps in real time.
  const handleAssignDoctor = async (doc) => {
    setAssigningId(doc.id);
    try {
      await assignDoctor({ patientId: selectedPatient.id, doctorStaffId: doc.id });
      setAssignModal(false);
      await loadPatientAppointments(selectedPatient.id).catch(() => {});
      useStore.getState().hydrateFromSupabase();
      Alert.alert('Doctor assigned ✓',
        `${selectedPatient.name} is now with ${doc.name}. The visit shows in the patient's and doctor's apps.`);
    } catch (e) {
      Alert.alert('Could not assign', e?.message || 'Please try again.');
    } finally {
      setAssigningId(null);
    }
  };

  const handleAdmitDischarge = () => {
    const pid = selectedPatient?.id;
    if (!pid) return;
    const isAdmitted = admitStatus === 'admitted';
    const action = isAdmitted ? 'Discharge' : 'Admit';
    const newStatus = isAdmitted ? 'discharged' : 'admitted';
    Alert.alert(
      `${action} Patient`,
      `${action} ${selectedPatient.name} ${isAdmitted ? 'from hospital' : 'to hospital'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action,
          style: isAdmitted ? 'destructive' : 'default',
          onPress: async () => {
            setAdmitLoading(true);
            try {
              const { error } = await supabase
                .from('profiles')
                .update({ status: newStatus })
                .eq('id', pid);
              if (error) throw error;
              setAdmitStatus(newStatus);
              Alert.alert(`${action}d ✓`, `${selectedPatient.name} has been ${action.toLowerCase()}d.`);
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not update patient status.');
            } finally {
              setAdmitLoading(false);
            }
          },
        },
      ]
    );
  };

  const filteredPatients = patients.filter(p => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q
      || p.name.toLowerCase().includes(q)
      || (p.id || '').toLowerCase().includes(q)
      || (p.phone || '').replace(/\D/g, '').includes(q.replace(/\D/g, ''));
    if (!matchesSearch) return false;

    if (activeCategory === "All") return true;
    if (activeCategory === "Today") return p.lastVisit === "Today";
    if (activeCategory === "Checked in") return p.status === "Checked in";
    if (activeCategory === "Admitted") return p.status === "Admitted";
    if (activeCategory === "Discharged") return p.status === "Discharged";
    return true;
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Pending Confirmation': return { backgroundColor: '#fef3c7', color: '#92400e' };
      case 'Confirmed':            return { backgroundColor: '#d1fae5', color: '#065f46' };
      case 'Time Suggested':
      case 'New Time Suggested':   return { backgroundColor: '#dbeafe', color: '#1e40af' };
      case 'Completed':            return { backgroundColor: '#f0fdf4', color: '#166534' };
      case 'Cancelled':            return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'Checked in':           return { backgroundColor: '#ebfaf0', color: '#2f855a' };
      case 'Emergency':            return { backgroundColor: '#fdf2f2', color: COLORS.error };
      case 'Admitted':             return { backgroundColor: '#fdf2f2', color: COLORS.error };
      case 'Discharged':           return { backgroundColor: '#ebfaf0', color: '#2f855a' };
      case 'Follow-up':            return { backgroundColor: '#fdf6e2', color: '#c05621' };
      case 'OPD':
      default:                     return { backgroundColor: '#eef6ff', color: '#2b6cb0' };
    }
  };

  const getBloodGroupColor = (bg) => {
    return COLORS.primarySoft;
  };

  if (selectedPatient) {
    // Use real data from DB when loaded, fall back to store data
    const p = patientProfile || selectedPatient;
    const gender = p.gender === 'M' ? 'Male' : p.gender === 'F' ? 'Female' : p.gender || '—';
    const bloodGroup = p.bloodGroup || '—';
    // Derive the status badge from the LIVE latest appointment so it updates
    // in real time; fall back to the store value before appointments load.
    const latestAppt = patientAppointments[0];
    const status = latestAppt
      ? (APPT_STATUS_LABEL[latestAppt.status]?.label || selectedPatient.status)
      : selectedPatient.status;

    return (
      <ProtectedScreen navigation={navigation}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedPatient(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            <Text style={styles.backBtnText}>Back to Patients</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator={false}>
          {/* Patient Card Top */}
          <View style={styles.profileHeaderCard}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.detailName}>{p.name || selectedPatient.name}</Text>
            <Text style={styles.detailId}>{`#${selectedPatient.id.slice(-8).toUpperCase()} · ${gender}`}</Text>

            <View style={styles.metaRow}>
              {bloodGroup !== '—' && (
                <View style={[styles.metaBadge, { backgroundColor: COLORS.primarySoft }]}>
                  <Text style={styles.metaBadgeText}>{bloodGroup} Blood</Text>
                </View>
              )}
              <View style={[styles.metaBadge, getStatusStyle(status)]}>
                <Text style={[styles.metaBadgeText, { color: getStatusStyle(status).color }]}>{status}</Text>
              </View>
            </View>

            <View style={styles.detailActionRow}>
              <TouchableOpacity style={styles.detailActionBtn} onPress={() => navigation.navigate('PatientActions', { patientId: selectedPatient.id })}>
                <Ionicons name="flash-outline" size={16} color={COLORS.white} />
                <Text style={styles.detailActionText}>Quick Actions</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.admitBtn, admitStatus === 'admitted' && styles.dischargeBtn]}
                onPress={handleAdmitDischarge}
                disabled={admitLoading}
              >
                {admitLoading
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <>
                      <Ionicons name={admitStatus === 'admitted' ? 'exit-outline' : 'enter-outline'} size={16} color={COLORS.white} />
                      <Text style={styles.detailActionText}>{admitStatus === 'admitted' ? 'Discharge' : 'Admit'}</Text>
                    </>}
              </TouchableOpacity>
            </View>

            {/* Assign a doctor — the follow-through on a QR check-in */}
            <TouchableOpacity style={styles.assignDoctorBtn} onPress={() => setAssignModal(true)}>
              <Ionicons name="medkit-outline" size={16} color={COLORS.primary} />
              <Text style={styles.assignDoctorText}>Assign Doctor</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Details */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>Contact & Demographics</Text>
            {!!p.phone && (
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.contactValue}>{p.phone}</Text>
              </View>
            )}
            {!!p.email && (
              <View style={styles.contactRow}>
                <Ionicons name="mail-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.contactValue}>{p.email}</Text>
              </View>
            )}
            {!!p.address && (
              <View style={styles.contactRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.contactValue}>{p.address}</Text>
              </View>
            )}
            {!p.phone && !p.email && !p.address && (
              <Text style={styles.clinicalEmpty}>No contact info on record</Text>
            )}
          </View>

          {/* Clinical Summaries */}
          <View style={styles.clinicalGrid}>
            <View style={[styles.clinicalCard, { flex: 1 }]}>
              <View style={styles.clinicalHeader}>
                <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
                <Text style={styles.clinicalTitle}>Allergies</Text>
              </View>
              {p.allergies?.length > 0 ? (
                p.allergies.map((a, i) => (
                  <Text key={i} style={styles.clinicalBullet}>• {a}</Text>
                ))
              ) : (
                <Text style={styles.clinicalEmpty}>None recorded</Text>
              )}
            </View>

            <View style={[styles.clinicalCard, { flex: 1 }]}>
              <View style={styles.clinicalHeader}>
                <Ionicons name="heart" size={16} color={COLORS.primary} />
                <Text style={styles.clinicalTitle}>Conditions</Text>
              </View>
              {p.conditions?.length > 0 ? (
                p.conditions.map((c, i) => (
                  <Text key={i} style={styles.clinicalBullet}>• {c}</Text>
                ))
              ) : (
                <Text style={styles.clinicalEmpty}>None recorded</Text>
              )}
            </View>
          </View>

          {/* Visit History */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionTitleWithIcon}>
              <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionCardTitle}>Clinical History</Text>
            </View>
            {p.history?.length > 0 ? (
              <View style={styles.timeline}>
                {p.history.map((h, i) => (
                  <View key={i} style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeaderRow}>
                        <Text style={styles.timelineDate}>{h.date}</Text>
                        <Text style={styles.timelineDoc}>by {h.doctor}</Text>
                      </View>
                      <Text style={styles.timelineNote}>{h.note}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.clinicalEmpty}>No records yet</Text>
            )}
          </View>

          {/* Appointment History — real data from DB */}
          <View style={[styles.sectionCard, { marginBottom: 35 }]}>
            <View style={styles.sectionTitleWithIcon}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.sectionCardTitle}>Appointments Timeline</Text>
            </View>
            {loadingAppts ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
            ) : patientAppointments.length > 0 ? (
              <View style={styles.timeline}>
                {patientAppointments.map((ap) => {
                  const cfg = APPT_STATUS_LABEL[ap.status] || APPT_STATUS_LABEL.scheduled;
                  const isPending = ap.status === 'scheduled';
                  const isActing  = actingAppt === ap.id;
                  return (
                    <View key={ap.id} style={[styles.timelineItem, { flexDirection: 'column', gap: 8 }]}>
                      {/* Header row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={[styles.timelineDot, { backgroundColor: cfg.text }]} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.timelineHeaderRow}>
                            <Text style={styles.timelineDate}>{ap.date} · {ap.time}</Text>
                            <View style={[styles.apptStatusPill, { backgroundColor: cfg.bg }]}>
                              <Ionicons name={cfg.icon} size={10} color={cfg.text} style={{ marginRight: 3 }} />
                              <Text style={[styles.apptStatusText, { color: cfg.text }]}>{cfg.label}</Text>
                            </View>
                          </View>
                          <Text style={styles.timelineNote}>{ap.doctor} · {ap.type}</Text>
                        </View>
                      </View>
                      {/* Action buttons for pending appointments */}
                      {isPending && (
                        <View style={styles.apptActions}>
                          {isActing ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                          ) : (
                            <>
                              <TouchableOpacity style={styles.apptBtnAccept} onPress={() => handleAcceptAppt(ap.id)}>
                                <Ionicons name="checkmark" size={13} color={COLORS.white} />
                                <Text style={styles.apptBtnAcceptText}>Confirm</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.apptBtnDecline} onPress={() => handleDeclineAppt(ap.id)}>
                                <Ionicons name="close" size={13} color="#dc2626" />
                                <Text style={styles.apptBtnDeclineText}>Decline</Text>
                              </TouchableOpacity>
                              <TouchableOpacity style={styles.apptBtnSuggest}
                                onPress={() => navigation.navigate('Appointments')}>
                                <Ionicons name="calendar-outline" size={13} color={COLORS.primary} />
                                <Text style={styles.apptBtnSuggestText}>Suggest Time</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.clinicalEmpty}>No appointments yet</Text>
            )}
          </View>
        </ScrollView>

        {/* Assign-doctor picker */}
        <Modal animationType="slide" transparent visible={assignModal} onRequestClose={() => setAssignModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Assign Doctor</Text>
                <TouchableOpacity onPress={() => setAssignModal(false)} style={styles.closeModalBtn}>
                  <Ionicons name="close" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSub}>
                Pick a doctor for {selectedPatient.name}. A confirmed walk-in visit is created and appears in the patient's and doctor's apps.
              </Text>
              <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
                {doctors.filter(d => d.active).map(doc => {
                  const isAssigning = assigningId === doc.id;
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      style={styles.docRow}
                      onPress={() => handleAssignDoctor(doc)}
                      disabled={!!assigningId}
                    >
                      <View style={styles.docAvatar}>
                        {isAssigning
                          ? <ActivityIndicator size="small" color={COLORS.primary} />
                          : <Ionicons name="medkit" size={16} color={COLORS.primary} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.docName}>{doc.name}</Text>
                        <Text style={styles.docSub}>{doc.speciality} · {doc.fee}</Text>
                      </View>
                      {!assigningId && <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />}
                    </TouchableOpacity>
                  );
                })}
                {doctors.filter(d => d.active).length === 0 && (
                  <Text style={styles.docEmpty}>
                    No active doctors yet. Add doctors from the Doctors tab first.
                  </Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
      </ProtectedScreen>
    );
  }

  return (
    <ProtectedScreen navigation={navigation}>
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Patients</Text>
          <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('ScanPatient')}>
            <Ionicons name="qr-code-outline" size={16} color={COLORS.white} />
            <Text style={styles.scanBtnText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone or ID..."
            placeholderTextColor="#a0a0a0"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.tab,
                activeCategory === cat && styles.tabActive
              ]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.tabText, activeCategory === cat && styles.tabTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredPatients}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="person-outline" size={44} color={COLORS.border} />
            <Text style={styles.emptyText}>No patient files found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.patientCard}
            onPress={() => setSelectedPatient(item)}
          >
            <View style={styles.patientCardHeader}>
              <View style={styles.patientAvatar}>
                <Ionicons name="person" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.patientBasicInfo}>
                <Text style={styles.patientNameText}>{item.name}</Text>
                <Text style={styles.patientMetaText}>
                  #{item.id.slice(-8).toUpperCase()} · {item.gender || '—'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
            </View>

            <View style={styles.patientCardFooter}>
              <View style={styles.visitBadge}>
                <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} style={{ marginRight: 3 }} />
                <Text style={styles.visitText}>Last visit: {item.lastVisit}</Text>
              </View>
              <View style={[styles.statusPillSmall, getStatusStyle(item.status)]}>
                <Text style={[styles.statusTextSmall, { color: getStatusStyle(item.status).color }]}>
                  {item.status}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
    </ProtectedScreen>
  );
}
