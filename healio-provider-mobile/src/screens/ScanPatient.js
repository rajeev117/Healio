import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING } from '../constants/theme';
import { resolveQrToken } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import styles from './ScanPatient.styles';
import {
  fetchPatientVisitsForRange,
  createLabOrderFromVisit,
  createPharmacyOrderFromVisit,
} from '../lib/careFlow';

// Date range options shown to lab/pharmacy staff after scanning a patient.
const DATE_RANGES = [
  { label: 'Today',        days: 0 },
  { label: 'Last 3 days',  days: 3 },
  { label: 'Last 7 days',  days: 7 },
  { label: 'Last 30 days', days: 30 },
];

function fromDateForRange(days) {
  const d = new Date();
  if (days === 0) { d.setHours(0, 0, 0, 0); return d; }
  d.setDate(d.getDate() - days);
  return d;
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export default function ScanPatient({ navigation }) {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const handledRef = useRef(false);

  // 'scan' → 'date_query' → 'visit_list'
  const [phase, setPhase]         = useState('scan');
  const [resolving, setResolving] = useState(false);
  const [scanned, setScanned]     = useState(null); // { patientId, patientName }
  const [rangeIdx, setRangeIdx]   = useState(1);    // default "Last 3 days"
  const [visits, setVisits]       = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);
  const [creatingId, setCreatingId]       = useState(null); // appointment id being converted

  const isLabOrPharmacy = user?.role === 'lab_technician' || user?.role === 'pharmacy_assistant';

  const resetScan = () => {
    handledRef.current = false;
    setPhase('scan');
    setScanned(null);
    setVisits([]);
    setCreatingId(null);
  };

  // ── Step 1: QR scan ────────────────────────────────────────────────────────
  const handleScanned = async ({ data }) => {
    if (handledRef.current || resolving) return;
    handledRef.current = true;
    setResolving(true);
    try {
      const result = await resolveQrToken(data);
      if (!result) {
        Alert.alert(
          'Invalid or expired code',
          'Ask the patient to refresh their check-in code and try again.',
          [{ text: 'Scan Again', onPress: resetScan }]
        );
        return;
      }

      if (isLabOrPharmacy) {
        // Lab/pharmacy: move to date range picker — don't navigate yet.
        setScanned({ patientId: result.patientId, patientName: result.patientName });
        setPhase('date_query');
      } else if (user?.role === 'doctor') {
        // Doctor tabs have no Patients screen — open the shared patient records.
        navigation.replace('PatientRecords', { patientId: result.patientId, patientName: result.patientName });
      } else {
        // Hospital admin (and any role with a Patients tab): straight to patient dossier.
        navigation.replace('Main', { screen: 'Patients', params: { patientId: result.patientId } });
      }
    } catch (e) {
      Alert.alert('Scan failed', e?.message || 'Please try again.',
        [{ text: 'Scan Again', onPress: resetScan }]);
    } finally {
      setResolving(false);
    }
  };

  // ── Step 2: fetch visits for chosen date range ─────────────────────────────
  const handleFetchVisits = async () => {
    const fromDate = fromDateForRange(DATE_RANGES[rangeIdx].days);
    setLoadingVisits(true);
    try {
      const data = await fetchPatientVisitsForRange(scanned.patientId, fromDate);
      if (!data.length) {
        Alert.alert(
          'No visits found',
          `${scanned.patientName} has no appointments at this hospital in the selected window. Try a wider range.`
        );
        return;
      }
      setVisits(data);
      setPhase('visit_list');
    } catch (e) {
      Alert.alert('Could not load visits', e?.message || 'Please try again.');
    } finally {
      setLoadingVisits(false);
    }
  };

  // ── Step 3: staff picks a visit → create order → navigate to detail ────────
  const handleSelectVisit = async (appt) => {
    setCreatingId(appt.id);
    try {
      let order;
      if (user?.role === 'lab_technician') {
        await createLabOrderFromVisit({ patientId: scanned.patientId, appointmentId: appt.id });
      } else {
        await createPharmacyOrderFromVisit({ patientId: scanned.patientId, appointmentId: appt.id });
      }
      navigation.replace('Main');
    } catch (e) {
      Alert.alert('Could not create order', e?.message || 'Please try again.');
      setCreatingId(null);
    }
  };

  // ── Permission gates ───────────────────────────────────────────────────────
  if (!permission) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} /></SafeAreaView>;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header navigation={navigation} />
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permText}>To scan a patient's check-in QR code, allow camera access.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Phase: date_query ──────────────────────────────────────────────────────
  if (phase === 'date_query') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header navigation={navigation} onBack={resetScan} />
        <ScrollView contentContainerStyle={styles.body}>

          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <Ionicons name="person" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{scanned?.patientName || 'Patient'}</Text>
              <Text style={styles.patientSub}>QR verified — select visit window</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>How far back should we look?</Text>

          <View style={styles.rangeGrid}>
            {DATE_RANGES.map((r, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.rangeChip, rangeIdx === i && styles.rangeChipActive]}
                onPress={() => setRangeIdx(i)}
              >
                <Text style={[styles.rangeChipText, rangeIdx === i && styles.rangeChipTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.rangeHint}>
            Shows appointments from this hospital in the selected window.
          </Text>

          <TouchableOpacity style={styles.confirmBtn} onPress={handleFetchVisits} disabled={loadingVisits}>
            {loadingVisits
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.confirmBtnText}>Find Visits</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={resetScan}>
            <Text style={styles.cancelBtnText}>Scan a different patient</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Phase: visit_list ──────────────────────────────────────────────────────
  if (phase === 'visit_list') {
    const roleLabel = user?.role === 'lab_technician' ? 'lab order' : 'pharmacy order';
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header navigation={navigation} onBack={() => setPhase('date_query')} />
        <ScrollView contentContainerStyle={styles.body}>

          <View style={styles.patientRow}>
            <View style={styles.patientAvatar}>
              <Ionicons name="person" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{scanned?.patientName || 'Patient'}</Text>
              <Text style={styles.patientSub}>Tap a visit to create a {roleLabel}</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>{visits.length} visit{visits.length !== 1 ? 's' : ''} found</Text>

          {visits.map((appt) => {
            const isCreating = creatingId === appt.id;
            return (
              <TouchableOpacity
                key={appt.id}
                style={styles.visitCard}
                onPress={() => handleSelectVisit(appt)}
                disabled={!!creatingId}
              >
                <View style={styles.visitIconWrap}>
                  {isCreating
                    ? <ActivityIndicator color={COLORS.primary} />
                    : <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.visitDate}>{fmtDate(appt.scheduled_at)}</Text>
                  <Text style={styles.visitMeta}>{fmtTime(appt.scheduled_at)} · {appt.type || 'clinic'}</Text>
                  <Text style={styles.visitStatus}>{appt.status}</Text>
                </View>
                {!creatingId && <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setPhase('date_query')}>
            <Text style={styles.cancelBtnText}>Change date range</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Phase: scan (default) ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header navigation={navigation} />
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={resolving ? undefined : handleScanned}
        />
        <View style={styles.overlay}>
          <View style={styles.frame} />
          <Text style={styles.hint}>
            {resolving ? 'Looking up patient…' : 'Point the camera at the patient\'s QR code'}
          </Text>
          {resolving && <ActivityIndicator color={COLORS.white} style={{ marginTop: 10 }} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Header({ navigation, onBack }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack || (() => navigation.goBack())} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Scan Patient</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}
