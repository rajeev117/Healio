import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Alert,
  Modal, TextInput, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING } from '../constants/theme';
import { useStore } from '../lib/store';
import { supabase, emailFromPhone, resolveQrToken } from '../lib/supabase';
import { PHARMACY_STATUSES, LAB_STATUSES, HOMECARE_STATUSES } from '../constants/mock-data';
import { Ionicons } from '@expo/vector-icons';
import ProtectedScreen from '../components/ProtectedScreen';
import styles from './Operations.styles';

const tabs = [
  { id: 0, label: "Pharmacy", icon: "bandage" },
  { id: 1, label: "Labs", icon: "flask" },
  { id: 2, label: "Home Care", icon: "home" },
  { id: 3, label: "Billing", icon: "card" },
  { id: 4, label: "Admissions", icon: "bed" },
];

// Admissions tab has two sub-views: walk-in emergencies and planned (IPD) admissions.
const ADMIT_SUBTABS = [
  { key: 'emergency', label: 'Emergency admission' },
  { key: 'planned',   label: 'Planned admission' },
];

// Triage priority for emergency admissions (colour-coded like the order statuses).
const TRIAGE = [
  { key: 'critical', label: 'Critical', bg: '#fdf2f2', color: COLORS.error },
  { key: 'urgent',   label: 'Urgent',   bg: '#fdf6e2', color: '#c05621' },
  { key: 'stable',   label: 'Stable',   bg: '#ebfaf0', color: '#2f855a' },
];
const triageOf = (key) => TRIAGE.find(t => t.key === key) || TRIAGE[2];

// Age (whole years) from an ISO date of birth; '' when unknown/invalid.
function ageFromDob(dob) {
  if (!dob) return '';
  const d = new Date(dob);
  if (isNaN(d)) return '';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? String(age) : '';
}

const INITIAL_EMERGENCY = [
  { id: 'EM-1042', name: 'Ravi Kumar',  age: 54, bed: 'ER-3', triage: 'critical', complaint: 'Chest pain, breathlessness', time: '10 min ago' },
  { id: 'EM-1041', name: 'Sunita Devi', age: 39, bed: 'ER-1', triage: 'urgent',   complaint: 'Road accident — leg fracture', time: '35 min ago' },
];
const INITIAL_PLANNED = [
  { id: 'IP-2210', name: 'Aarav Shah', age: 12, bed: 'Ward B-7', dept: 'Pediatrics', complaint: 'Scheduled tonsillectomy', time: 'Today · 2:00 PM' },
];

// Each service is "set up" for a hospital when it has an active staff member in
// the controlling role. Setting up a service = adding that assistant.
const SERVICE_SETUP = {
  0: { role: 'pharmacy_assistant', idPrefix: 'PH', label: 'Pharmacy',  noun: 'pharmacy assistant',
       icon: 'bandage', uiRole: 'Pharmacy Assistant',
       blurb: 'Connect your pharmacy by adding the assistant(s) who will manage medicine orders.' },
  1: { role: 'lab_technician',     idPrefix: 'LT', label: 'Lab',       noun: 'lab technician',
       icon: 'flask', uiRole: 'Lab Technician',
       blurb: 'Add your lab service by assigning a technician to process and report test orders. Give each lab a distinct name (e.g. "Pathology Lab", "Radiology Lab") and add as many technicians as you need under each.' },
  2: { role: 'nurse',              idPrefix: 'NR', label: 'Home Care', noun: 'home-care nurse',
       icon: 'home', uiRole: 'Nurse',
       blurb: 'Add home care by assigning a nurse to manage home visits and packages.' },
};
const CONTROLLED_ROLES = ['pharmacy_assistant', 'lab_technician', 'nurse'];

// Lab departments a technician can be assigned to.
const LAB_DEPARTMENTS = ['Pathology', 'Radiology', 'Biochemistry', 'Microbiology', 'Hematology', 'Imaging (CT/MRI)', 'ECG / Cardiology'];

export default function Operations({ route, navigation }) {
  const initialTab = route?.params?.initialTab ?? 0;
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (route?.params?.initialTab !== undefined) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  const pharmacy = useStore(state => state.pharmacy);
  const labs = useStore(state => state.labs);
  const homecare = useStore(state => state.homecare);
  
  const setPharmacyStatus = useStore(state => state.setPharmacyStatus);
  const setLabStatus = useStore(state => state.setLabStatus);
  const setHomeStatus = useStore(state => state.setHomeStatus);

  // Notification banner — the hospital had no realtime signal at all when a
  // lab report became ready or medicines were dispensed; only the patient
  // (and now the requesting doctor) got notified.
  const [banner, setBanner] = useState(null); // { message, type }
  const bannerTimer = useRef(null);
  const showBanner = useCallback((message, type = 'info') => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ message, type });
    bannerTimer.current = setTimeout(() => setBanner(null), 4500);
  }, []);

  useEffect(() => {
    let channel; let cancelled = false;
    (async () => {
      const orgId = await useStore.getState().resolveOrgId();
      if (!orgId || cancelled) return;
      channel = supabase
        .channel(`hospital-orders-${orgId}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'lab_orders', filter: `organisation_id=eq.${orgId}` },
          (payload) => {
            if (payload.new?.status === 'completed' && payload.old?.status !== 'completed') {
              showBanner('🧪 A lab report is ready.', 'success');
            }
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'pharmacy_orders', filter: `organisation_id=eq.${orgId}` },
          (payload) => {
            const s = payload.new?.status;
            if ((s === 'completed' || s === 'dispensed') && payload.old?.status !== s) {
              showBanner('💊 A pharmacy order has been dispensed.', 'success');
            }
          }
        )
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [showBanner]);

  // ── Per-hospital service setup (controllers grouped by role) ────────────────
  const [controllers, setControllers] = useState({ pharmacy_assistant: [], lab_technician: [], nurse: [] });
  const [svcLoading, setSvcLoading] = useState(true);
  const [addCfg, setAddCfg] = useState(null);   // SERVICE_SETUP entry being added
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDept, setNewDept] = useState('');   // lab department (Pathology, Radiology…)
  const [saving, setSaving] = useState(false);

  // ── Admissions tab state ────────────────────────────────────────────────────
  const [admitTab, setAdmitTab] = useState('emergency');           // 'emergency' | 'planned'
  const [emergencyAdmissions, setEmergencyAdmissions] = useState(INITIAL_EMERGENCY);
  const [plannedAdmissions, setPlannedAdmissions] = useState(INITIAL_PLANNED);
  const [admitModal, setAdmitModal] = useState(null);              // null | 'emergency' | 'planned'
  const [admitName, setAdmitName] = useState('');
  const [admitAge, setAdmitAge] = useState('');
  const [admitBed, setAdmitBed] = useState('');
  const [admitTriage, setAdmitTriage] = useState('critical');
  const [admitDept, setAdmitDept] = useState('');                  // planned only
  const [admitSchedule, setAdmitSchedule] = useState('');          // planned only
  const [admitComplaint, setAdmitComplaint] = useState('');

  // Emergency QR scan — resolve the patient's Healio QR to pre-fill the form.
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [admitScanOpen, setAdmitScanOpen] = useState(false);
  const [admitResolving, setAdmitResolving] = useState(false);
  const [admitPatient, setAdmitPatient] = useState(null);          // resolved { patientId, patientName, … }
  const admitScanHandled = useRef(false);

  const resetAdmitForm = () => {
    setAdmitName(''); setAdmitAge(''); setAdmitBed(''); setAdmitTriage('critical');
    setAdmitDept(''); setAdmitSchedule(''); setAdmitComplaint('');
    setAdmitPatient(null);
  };

  const openAdmitScan = async () => {
    if (!camPermission?.granted) {
      const res = await requestCamPermission();
      if (!res.granted) {
        return Alert.alert('Camera access needed', "Allow camera access to scan the patient's QR code.");
      }
    }
    admitScanHandled.current = false;
    setAdmitScanOpen(true);
  };

  const handleAdmitScan = async ({ data }) => {
    if (admitScanHandled.current || admitResolving) return;
    admitScanHandled.current = true;
    setAdmitResolving(true);
    try {
      const p = await resolveQrToken(data);
      if (!p) {
        Alert.alert(
          'Invalid or expired code',
          'Ask the patient to refresh their check-in code and try again.',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setAdmitScanOpen(false) },
            { text: 'Scan Again', onPress: () => { admitScanHandled.current = false; } },
          ]
        );
        return;
      }
      setAdmitPatient(p);
      setAdmitName(p.patientName || '');
      const age = ageFromDob(p.dateOfBirth);
      if (age) setAdmitAge(age);
      setAdmitScanOpen(false);
    } catch (e) {
      Alert.alert('Scan failed', e?.message || 'Please try again.',
        [{ text: 'OK', onPress: () => { admitScanHandled.current = false; } }]);
    } finally {
      setAdmitResolving(false);
    }
  };

  const handleAddAdmission = () => {
    if (!admitName.trim()) return Alert.alert('Error', 'Patient name is required.');
    const isEmergency = admitModal === 'emergency';
    const base = {
      name: admitName.trim(),
      age: admitAge.replace(/\D/g, '') || '—',
      bed: admitBed.trim() || 'Unassigned',
      complaint: admitComplaint.trim() || 'Not specified',
    };
    if (isEmergency) {
      setEmergencyAdmissions(prev => [{
        ...base,
        id: `EM-${Date.now().toString().slice(-4)}`,
        triage: admitTriage,
        time: 'Just now',
        // Linked Healio identity when the QR was scanned (null for manual entry).
        patientId: admitPatient?.patientId || null,
        phone: admitPatient?.phone || null,
        bloodGroup: admitPatient?.bloodGroup || null,
      }, ...prev]);
    } else {
      setPlannedAdmissions(prev => [{
        ...base,
        id: `IP-${Date.now().toString().slice(-4)}`,
        dept: admitDept.trim() || 'General',
        time: admitSchedule.trim() || 'Unscheduled',
      }, ...prev]);
    }
    setAdmitModal(null);
    resetAdmitForm();
  };

  const loadControllers = useCallback(async () => {
    setSvcLoading(true);
    try {
      const orgId = await useStore.getState().resolveOrgId();
      if (!orgId) { setSvcLoading(false); return; }
      const { data } = await supabase
        .from('staff')
        .select('id, name, role, phone, department, status')
        .eq('organisation_id', orgId)
        .in('role', CONTROLLED_ROLES)
        .eq('status', 'active');
      const grouped = { pharmacy_assistant: [], lab_technician: [], nurse: [] };
      (data || []).forEach(s => { if (grouped[s.role]) grouped[s.role].push(s); });
      setControllers(grouped);
    } catch (e) { /* keep empty — setup state will show */ }
    finally { setSvcLoading(false); }
  }, []);

  useEffect(() => { loadControllers(); }, [loadControllers]);

  // Refresh on tab focus so newly-added staff / services appear immediately
  useFocusEffect(useCallback(() => {
    loadControllers();
    useStore.getState().hydrateFromSupabase();
  }, [loadControllers]));

  const openAdd = (cfg) => {
    setNewName('');
    setNewPhone('');
    setNewDept(cfg.role === 'lab_technician' ? LAB_DEPARTMENTS[0] : '');
    setAddCfg(cfg);
  };

  const handleAddController = async () => {
    if (!addCfg) return;
    const phone10 = newPhone.replace(/\D/g, '').slice(-10);
    const isLab = addCfg.role === 'lab_technician';
    if (!newName.trim()) return Alert.alert('Error', 'Name is required.');
    if (phone10.length !== 10) return Alert.alert('Error', 'A valid 10-digit phone number is required.');
    if (isLab && !newDept) return Alert.alert('Error', 'Please select a lab department.');
    setSaving(true);
    try {
      const orgId = await useStore.getState().resolveOrgId();
      if (!orgId) { Alert.alert('Error', 'No hospital context. Please re-login.'); return; }
      const { error } = await supabase.from('staff').insert({
        staff_id: `${addCfg.idPrefix}-${Date.now().toString().slice(-5)}`,
        organisation_id: orgId,
        name: newName.trim(),
        role: addCfg.role,
        department: isLab ? newDept : addCfg.label,
        phone: `+91${phone10}`,
        email: emailFromPhone(phone10),   // deterministic login email
        status: 'active',
        verified_at: new Date().toISOString(),
        is_test: false,
      });
      if (error) throw error;
      setAddCfg(null);
      await loadControllers();
      Alert.alert(
        `${addCfg.label} connected ✓`,
        `${newName.trim()} can now log into the Provider app with phone ${phone10} + any OTP to manage ${addCfg.label.toLowerCase()}.`
      );
    } catch (e) {
      Alert.alert('Could not connect', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Gate a service tab: show a loader, a setup prompt, or the connected list.
  const renderServiceTab = (tabId, listElement) => {
    const cfg = SERVICE_SETUP[tabId];
    if (svcLoading) {
      return <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />;
    }
    const team = controllers[cfg.role] || [];
    if (team.length === 0) {
      return (
        <View style={styles.setupContainer}>
          <View style={styles.setupIcon}>
            <Ionicons name={`${cfg.icon}-outline`} size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.setupTitle}>{cfg.label} isn't set up yet</Text>
          <Text style={styles.setupBlurb}>{cfg.blurb}</Text>
          <TouchableOpacity style={styles.setupBtn} onPress={() => openAdd(cfg)}>
            <Ionicons name="add-circle" size={18} color={COLORS.white} />
            <Text style={styles.setupBtnText}>Add {cfg.noun}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const isLab = cfg.role === 'lab_technician';
    return (
      <>
        <View style={styles.connectedBanner}>
          <Ionicons name="checkmark-circle" size={16} color="#2f855a" />
          <Text style={styles.connectedText}>
            {cfg.label} run by {team.length} {team.length === 1 ? cfg.noun : `${cfg.noun}s`}
          </Text>
        </View>

        {/* Each team member — tap the pencil to edit their details */}
        <View style={styles.teamList}>
          {team.map(m => (
            <View key={m.id} style={styles.teamRow}>
              <View style={styles.teamAvatar}>
                <Ionicons name={cfg.icon} size={14} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.teamName}>{m.name}</Text>
                {isLab && !!m.department && <Text style={styles.teamSub}>{m.department}</Text>}
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('StaffManagement', { filterRole: cfg.uiRole, openStaffId: m.id })}
                style={styles.teamEditBtn}
              >
                <Ionicons name="create-outline" size={15} color={COLORS.primary} />
                <Text style={styles.teamEditText}>Edit</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addAnotherBtn} onPress={() => openAdd(cfg)}>
            <Ionicons name="add-circle" size={16} color={COLORS.primary} />
            <Text style={styles.addAnotherText}>Add another {cfg.noun}</Text>
          </TouchableOpacity>
        </View>

        {listElement}
      </>
    );
  };

  const cyclePharmacyStatus = (id, currentStatus) => {
    const currentIndex = PHARMACY_STATUSES.indexOf(currentStatus);
    const nextStatus = PHARMACY_STATUSES[(currentIndex + 1) % PHARMACY_STATUSES.length];
    setPharmacyStatus(id, nextStatus);
  };

  const cycleLabStatus = (id, currentStatus) => {
    const currentIndex = LAB_STATUSES.indexOf(currentStatus);
    const nextStatus = LAB_STATUSES[(currentIndex + 1) % LAB_STATUSES.length];
    setLabStatus(id, nextStatus);
  };

  const cycleHomeStatus = (id, currentStatus) => {
    const currentIndex = HOMECARE_STATUSES.indexOf(currentStatus);
    const nextStatus = HOMECARE_STATUSES[(currentIndex + 1) % HOMECARE_STATUSES.length];
    setHomeStatus(id, nextStatus);
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Pending':
      case 'Sample pending':
      case 'Scheduled':
        return { backgroundColor: '#fdf6e2', color: '#c05621' };
      case 'Processing':
      case 'Dispatched':
      case 'Active':
        return { backgroundColor: '#eef6ff', color: '#2b6cb0' };
      case 'Delivered':
      case 'Report ready':
      case 'Completed':
        return { backgroundColor: '#ebfaf0', color: '#2f855a' };
      default:
        return { backgroundColor: COLORS.surface, color: COLORS.textSecondary };
    }
  };

  // ── Admissions panel (Emergency / Planned sub-tabs) ─────────────────────────
  const renderAdmissions = () => {
    const isEmergency = admitTab === 'emergency';
    const list = isEmergency ? emergencyAdmissions : plannedAdmissions;
    return (
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {/* Sub-tabs */}
        <View style={styles.subTabsRow}>
          {ADMIT_SUBTABS.map(st => {
            const active = admitTab === st.key;
            return (
              <TouchableOpacity
                key={st.key}
                style={[styles.subTab, active && styles.subTabActive]}
                onPress={() => setAdmitTab(st.key)}
              >
                <Text style={[styles.subTabText, active && styles.subTabTextActive]}>{st.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Add patient — label matches the active sub-tab */}
        <TouchableOpacity style={styles.setupBtn} onPress={() => { resetAdmitForm(); setAdmitModal(admitTab); }}>
          <Ionicons name="add-circle" size={18} color={COLORS.white} />
          <Text style={styles.setupBtnText}>
            {isEmergency ? 'New emergency admission' : 'Add patient'}
          </Text>
        </TouchableOpacity>

        {list.length === 0 ? (
          <View style={[styles.setupContainer, { paddingBottom: 40 }]}>
            <View style={styles.setupIcon}>
              <Ionicons name={isEmergency ? 'pulse-outline' : 'bed-outline'} size={40} color={COLORS.primary} />
            </View>
            <Text style={styles.setupTitle}>No {isEmergency ? 'emergency' : 'planned'} admissions</Text>
            <Text style={styles.setupBlurb}>
              {isEmergency
                ? 'Walk-in and casualty admissions will appear here. Tap “New emergency admission” to record one.'
                : 'Scheduled (IPD) admissions will appear here. Tap “Add patient” to book one.'}
            </Text>
          </View>
        ) : list.map(a => {
          const t = triageOf(a.triage);
          return (
            <View key={a.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Ionicons name={isEmergency ? 'pulse' : 'bed'} size={18} color={COLORS.primary} />
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardTitle}>
                    {a.name} · {a.age}y
                    {a.patientId ? <Text>  <Ionicons name="checkmark-circle" size={12} color="#2f855a" /></Text> : null}
                  </Text>
                  <Text style={styles.cardSub}>
                    {a.id} · Bed {a.bed}{a.dept ? ` · ${a.dept}` : ''} · {a.time}
                    {a.phone ? ` · ${a.phone}` : ''}{a.bloodGroup ? ` · ${a.bloodGroup}` : ''}
                  </Text>
                </View>
                {isEmergency ? (
                  <View style={[styles.statusBadge, { backgroundColor: t.bg }]}>
                    <Text style={[styles.statusText, { color: t.color }]}>{t.label}</Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: '#eef6ff' }]}>
                    <Text style={[styles.statusText, { color: '#2b6cb0' }]}>Planned</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.footerLabel} numberOfLines={1}>
                  Complaint: <Text style={styles.footerVal}>{a.complaint}</Text>
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <ProtectedScreen navigation={navigation}>
    <SafeAreaView style={styles.container} edges={['top']}>
      {banner && (
        <View style={styles.notifBanner}>
          <Text style={styles.notifBannerText}>{banner.message}</Text>
          <TouchableOpacity onPress={() => setBanner(null)}>
            <Ionicons name="close" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hospital Operations</Text>

        {/* Tab Segments */}
        <View style={styles.tabsContainer}>
          {tabs.map((t) => {
            const isSelected = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.tab,
                  isSelected && styles.tabActive
                ]}
                onPress={() => setActiveTab(t.id)}
              >
                <Ionicons name={isSelected ? t.icon : `${t.icon}-outline`} size={16} color={isSelected ? COLORS.white : COLORS.textSecondary} />
                <Text numberOfLines={1} style={[styles.tabLabel, isSelected && styles.tabLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {activeTab === 0 && renderServiceTab(0, (
        <FlatList
          data={pharmacy}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => null}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Ionicons name="bandage-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardTitle}>{item.id}</Text>
                  <Text style={styles.cardSub}>Patient: {item.patient}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}
                  onPress={() => cyclePharmacyStatus(item.id, item.status)}
                >
                  <Text style={[styles.statusText, { color: getStatusBadgeStyle(item.status).color }]}>
                    {item.status}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.footerLabel}>Items: <Text style={styles.footerVal}>{item.items}</Text></Text>
                <Text style={styles.footerLabel}>Total: <Text style={[styles.footerVal, { color: COLORS.text }]}>{item.total}</Text></Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ))}

      {activeTab === 1 && renderServiceTab(1, (
        <FlatList
          data={labs}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => null}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Ionicons name="flask-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardTitle}>{item.id} · {item.test}</Text>
                  <Text style={styles.cardSub}>
                    Patient: {item.patient}{item.department ? ` · ${item.department}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}
                  onPress={() => cycleLabStatus(item.id, item.status)}
                >
                  <Text style={[styles.statusText, { color: getStatusBadgeStyle(item.status).color }]}>
                    {item.status}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      ))}

      {activeTab === 2 && renderServiceTab(2, (
        <FlatList
          data={homecare}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('HomeCareOrderDetail', { orderId: item.id, order: item })}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.cardDetails}>
                  <Text style={styles.cardTitle}>{item.id} · {item.package}</Text>
                  <Text style={styles.cardSub}>Patient: {item.patient} · Duration: {item.days} days</Text>
                </View>
                <TouchableOpacity
                  style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}
                  onPress={() => cycleHomeStatus(item.id, item.status)}
                >
                  <Text style={[styles.statusText, { color: getStatusBadgeStyle(item.status).color }]}>
                    {item.status}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      ))}

      {activeTab === 3 && (
        <ScrollView contentContainerStyle={styles.billingContent} showsVerticalScrollIndicator={false}>
          {/* Summary Card */}
          <TouchableOpacity style={styles.billingSummaryCard} onPress={() => navigation.navigate('Billing')}>
            <View style={styles.ledgerHeader}>
              <Ionicons name="clipboard-outline" size={18} color={COLORS.white} />
              <Text style={styles.ledgerTitle}>Financial Ledger</Text>
            </View>
            <Text style={styles.summaryValue}>₹3,15,200</Text>
            <Text style={styles.summarySub}>Total Billings Collected This Month</Text>
          </TouchableOpacity>

          {/* Ledger logs */}
          <View style={styles.ledgerSection}>
            <Text style={styles.ledgerSectionTitle}>Recent Transactions</Text>
            
            {[
              { id: "TXN-9011", date: "Today · 02:40 PM", desc: "Consultation Fee - Dr. Mehra", amt: "₹800", status: "success" },
              { id: "TXN-9010", date: "Today · 11:15 AM", desc: "CBC Lab Test - Sneha Roy", amt: "₹650", status: "success" },
              { id: "TXN-9009", date: "Yesterday", desc: "OPD Partner Registration - Fee", amt: "₹4,999", status: "success" },
              { id: "TXN-9008", date: "Yesterday", desc: "Pharmacy Order #RX-3403", amt: "₹2,180", status: "success" },
            ].map((txn) => (
              <View key={txn.id} style={styles.txnItem}>
                <View style={styles.txnIcon}>
                  <Ionicons name="cash-outline" size={16} color={COLORS.primary} />
                </View>
                <View style={styles.txnDetails}>
                  <Text style={styles.txnDesc}>{txn.desc}</Text>
                  <Text style={styles.txnMeta}>{txn.id} · {txn.date}</Text>
                </View>
                <View style={styles.txnAmtContainer}>
                  <Text style={styles.txnAmt}>{txn.amt}</Text>
                  <View style={styles.txnStatusBadge}>
                    <Ionicons name="checkmark-circle" size={10} color="#2f855a" style={{ marginRight: 2 }} />
                    <Text style={styles.txnStatusText}>PAID</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {activeTab === 4 && renderAdmissions()}

      {/* Add service controller (assistant) */}
      <Modal animationType="slide" transparent visible={!!addCfg} onRequestClose={() => setAddCfg(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add {addCfg?.noun}</Text>
              <TouchableOpacity onPress={() => setAddCfg(null)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalBlurb}>{addCfg?.blurb}</Text>

              <Text style={styles.formLabel}>Full Name</Text>
              <View style={styles.formInputRow}>
                <Ionicons name="person-outline" size={16} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Riya Sen"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newName}
                  onChangeText={setNewName}
                />
              </View>

              <Text style={styles.formLabel}>Phone Number</Text>
              <View style={styles.formInputRow}>
                <Ionicons name="call-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.ccPrefix}>+91</Text>
                <TextInput
                  style={styles.formInput}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="98300 12345"
                  placeholderTextColor={COLORS.textSecondary}
                  value={newPhone}
                  onChangeText={val => setNewPhone(val.replace(/\D/g, '').slice(0, 10))}
                />
              </View>

              {/* Lab department — only for lab technicians */}
              {addCfg?.role === 'lab_technician' && (
                <>
                  <Text style={styles.formLabel}>Lab Department</Text>
                  <View style={styles.deptWrap}>
                    {LAB_DEPARTMENTS.map(dept => (
                      <TouchableOpacity
                        key={dept}
                        style={[styles.deptChip, newDept === dept && styles.deptChipActive]}
                        onPress={() => setNewDept(dept)}
                      >
                        <Text style={[styles.deptChipText, newDept === dept && styles.deptChipTextActive]}>{dept}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Custom department */}
                  <View style={[styles.formInputRow, { marginTop: 10 }]}>
                    <Ionicons name="create-outline" size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.formInput}
                      placeholder="Or type a custom department"
                      placeholderTextColor={COLORS.textSecondary}
                      value={LAB_DEPARTMENTS.includes(newDept) ? '' : newDept}
                      onChangeText={setNewDept}
                    />
                  </View>
                </>
              )}
              <Text style={styles.formHint}>Used for their Provider-app login (10-digit Indian mobile).</Text>

              <TouchableOpacity
                style={[styles.setupBtn, { marginTop: 20 }, saving && { opacity: 0.6 }]}
                onPress={handleAddController}
                disabled={saving}
              >
                <Text style={styles.setupBtnText}>{saving ? 'Connecting…' : `Connect ${addCfg?.label}`}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* New admission (emergency or planned) */}
      <Modal animationType="slide" transparent visible={!!admitModal} onRequestClose={() => setAdmitModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {admitModal === 'planned' ? 'Add patient — planned admission' : 'New emergency admission'}
              </Text>
              <TouchableOpacity onPress={() => setAdmitModal(null)} style={styles.closeModalBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalBlurb}>
                {admitModal === 'planned'
                  ? 'Book a scheduled (IPD) admission. It appears instantly in the Planned list.'
                  : 'Record a walk-in / casualty admission. It appears instantly in the Emergency list.'}
              </Text>

              {/* Emergency: scan the patient's Healio QR to pre-fill name/age */}
              {admitModal === 'emergency' && (admitPatient ? (
                <View style={styles.scannedRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#2f855a" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.scannedName}>{admitPatient.patientName}</Text>
                    <Text style={styles.scannedMeta}>
                      Healio patient verified
                      {admitPatient.phone ? ` · ${admitPatient.phone}` : ''}
                      {admitPatient.gender ? ` · ${admitPatient.gender}` : ''}
                      {admitPatient.bloodGroup ? ` · ${admitPatient.bloodGroup}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setAdmitPatient(null)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.scanQrBtn} onPress={openAdmitScan}>
                  <Ionicons name="qr-code-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.scanQrText}>Scan patient's QR to auto-fill</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.formLabel}>Patient Name</Text>
              <View style={styles.formInputRow}>
                <Ionicons name="person-outline" size={16} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Ravi Kumar"
                  placeholderTextColor={COLORS.textSecondary}
                  value={admitName}
                  onChangeText={setAdmitName}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Age</Text>
                  <View style={styles.formInputRow}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.formInput}
                      keyboardType="number-pad"
                      maxLength={3}
                      placeholder="e.g. 54"
                      placeholderTextColor={COLORS.textSecondary}
                      value={admitAge}
                      onChangeText={val => setAdmitAge(val.replace(/\D/g, '').slice(0, 3))}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Ward / Bed</Text>
                  <View style={styles.formInputRow}>
                    <Ionicons name="bed-outline" size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. ER-3"
                      placeholderTextColor={COLORS.textSecondary}
                      value={admitBed}
                      onChangeText={setAdmitBed}
                    />
                  </View>
                </View>
              </View>

              {admitModal === 'planned' ? (
                <>
                  <Text style={styles.formLabel}>Department</Text>
                  <View style={styles.formInputRow}>
                    <Ionicons name="layers-outline" size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. Pediatrics"
                      placeholderTextColor={COLORS.textSecondary}
                      value={admitDept}
                      onChangeText={setAdmitDept}
                    />
                  </View>

                  <Text style={styles.formLabel}>Scheduled For</Text>
                  <View style={styles.formInputRow}>
                    <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                    <TextInput
                      style={styles.formInput}
                      placeholder="e.g. Tomorrow · 10:00 AM"
                      placeholderTextColor={COLORS.textSecondary}
                      value={admitSchedule}
                      onChangeText={setAdmitSchedule}
                    />
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.formLabel}>Triage Priority</Text>
                  <View style={styles.deptWrap}>
                    {TRIAGE.map(t => (
                      <TouchableOpacity
                        key={t.key}
                        style={[styles.deptChip, admitTriage === t.key && styles.deptChipActive]}
                        onPress={() => setAdmitTriage(t.key)}
                      >
                        <Text style={[styles.deptChipText, admitTriage === t.key && styles.deptChipTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.formLabel}>{admitModal === 'planned' ? 'Reason for Admission' : 'Chief Complaint'}</Text>
              <View style={styles.formInputRow}>
                <Ionicons name="document-text-outline" size={16} color={COLORS.textSecondary} />
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Chest pain, breathlessness"
                  placeholderTextColor={COLORS.textSecondary}
                  value={admitComplaint}
                  onChangeText={setAdmitComplaint}
                />
              </View>

              <TouchableOpacity style={[styles.setupBtn, { marginTop: 20 }]} onPress={handleAddAdmission}>
                <Text style={styles.setupBtnText}>
                  {admitModal === 'planned' ? 'Book admission' : 'Admit patient'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Emergency admission — patient QR scanner */}
      <Modal animationType="slide" visible={admitScanOpen} onRequestClose={() => setAdmitScanOpen(false)}>
        <SafeAreaView style={styles.scanSafe} edges={['top', 'bottom']}>
          <View style={styles.scanHeader}>
            <TouchableOpacity onPress={() => setAdmitScanOpen(false)} style={styles.closeModalBtn}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.scanTitle}>Scan Patient QR</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.scanCameraWrap}>
            {admitScanOpen && (
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={admitResolving ? undefined : handleAdmitScan}
              />
            )}
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame} />
              <Text style={styles.scanHint}>
                {admitResolving ? 'Looking up patient…' : "Point the camera at the patient's Healio QR code"}
              </Text>
              {admitResolving && <ActivityIndicator color={COLORS.white} style={{ marginTop: 10 }} />}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </ProtectedScreen>
  );
}
