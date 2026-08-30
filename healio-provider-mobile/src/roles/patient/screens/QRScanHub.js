import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING } from '../constants/theme';
import { issueQrToken, resolveProviderQr, createProviderCheckin } from '../services/supabase';

// ── My-QR (check-in) constants ────────────────────────────────────────────────
const TTL_SECONDS = 90;               // matches the DB token expiry
const REFRESH_AT  = 15;               // re-issue when this many seconds remain
const QR_PREFIX   = 'healio:patient:'; // so the provider scanner recognises it

const KIND_LABEL = { hospital: 'Hospital', lab: 'Lab', pharmacy: 'Pharmacy', rmp: 'Healthcare Consultant' };

// One screen with two modes: show my check-in QR, or scan a provider's QR.
export default function QRScanHub({ navigation, route }) {
  const [mode, setMode] = useState(route?.params?.mode === 'scan' ? 'scan' : 'code');

  // ── My-QR state ─────────────────────────────────────────────────────────────
  const [token, setToken]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [remaining, setRemaining] = useState(TTL_SECONDS);
  const tickRef = useRef(null);

  const refresh = useCallback(async () => {
    setError('');
    const t = await issueQrToken();
    if (!t) { setError('Could not generate your code. Tap retry.'); setLoading(false); return; }
    setToken(t);
    setRemaining(TTL_SECONDS);
    setLoading(false);
  }, []);

  // Only generate / count down while the "My QR" tab is active.
  useEffect(() => {
    if (mode !== 'code') return;
    refresh();
    tickRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= REFRESH_AT) { refresh(); return TTL_SECONDS; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [mode, refresh]);

  // ── Scan state ────────────────────────────────────────────────────────────────
  const [permission, requestPermission] = useCameraPermissions();
  const handledRef = useRef(false);
  const [resolving, setResolving] = useState(false);
  const resetScan = () => { handledRef.current = false; };

  const handleScanned = async ({ data }) => {
    if (handledRef.current || resolving) return;
    handledRef.current = true;
    setResolving(true);
    try {
      const provider = await resolveProviderQr(data);
      if (!provider) {
        Alert.alert('Not a Healio provider code',
          'This QR isn\'t a valid Healio hospital, lab, pharmacy or health-worker code.',
          [{ text: 'Scan Again', onPress: resetScan }]);
        return;
      }
      if (provider.kind === 'rmp') {
        Alert.alert(provider.name || 'Health Worker',
          `Verified Healio Health Worker${provider.subtitle ? `\n${provider.subtitle}` : ''}`,
          [
            { text: 'Scan Again', style: 'cancel', onPress: resetScan },
            { text: 'Done', onPress: () => navigation.goBack() },
          ]);
        return;
      }

      // The scan is the check-in (migration-043): it shares the patient's
      // identity with the org so the front desk sees them in Patients.
      const checkedIn = provider.orgId
        ? await createProviderCheckin({
            orgId: provider.orgId,
            kind: provider.kind,
            doctorStaffId: provider.kind === 'doctor' ? provider.id : null,
          })
        : false;

      if (provider.kind === 'doctor') {
        Alert.alert(
          checkedIn ? 'Checked in ✓' : provider.name || 'Doctor',
          checkedIn
            ? `You're checked in with ${provider.name}${provider.subtitle ? ` at ${provider.subtitle}` : ''}. They can now see your details.`
            : `Verified Healio doctor${provider.subtitle ? `\n${provider.subtitle}` : ''}`,
          [
            { text: 'Scan Again', style: 'cancel', onPress: resetScan },
            { text: 'Done', onPress: () => navigation.goBack() },
          ]);
        return;
      }

      if (checkedIn && provider.kind === 'hospital') {
        Alert.alert(
          'Checked in ✓',
          `You're checked in at ${provider.name}. The front desk can now see your details and assign a doctor.`,
          [{
            text: 'OK',
            onPress: () => navigation.replace('HospitalDetail', {
              item: { id: provider.id, name: provider.name, city: provider.subtitle },
              category: KIND_LABEL[provider.kind] || 'Hospitals',
            }),
          }]);
        return;
      }

      navigation.replace('HospitalDetail', {
        item: { id: provider.id, name: provider.name, city: provider.subtitle },
        category: KIND_LABEL[provider.kind] || 'Hospitals',
      });
    } catch (e) {
      Alert.alert('Scan failed', e?.message || 'Please try again.',
        [{ text: 'Scan Again', onPress: resetScan }]);
    } finally {
      setResolving(false);
    }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────────
  const Toggle = () => (
    <View style={styles.toggleRow}>
      <TouchableOpacity
        style={[styles.toggleBtn, mode === 'code' && styles.toggleBtnActive]}
        onPress={() => setMode('code')}
      >
        <Ionicons name="qr-code-outline" size={16} color={mode === 'code' ? COLORS.white : COLORS.textSecondary} />
        <Text style={[styles.toggleText, mode === 'code' && styles.toggleTextActive]}>My QR</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.toggleBtn, mode === 'scan' && styles.toggleBtnActive]}
        onPress={() => { resetScan(); setMode('scan'); }}
      >
        <Ionicons name="scan-outline" size={16} color={mode === 'scan' ? COLORS.white : COLORS.textSecondary} />
        <Text style={[styles.toggleText, mode === 'scan' && styles.toggleTextActive]}>Scan</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{mode === 'code' ? 'My Check-in Code' : 'Scan Provider'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Toggle />

      {mode === 'code' ? (
        <View style={styles.body}>
          <Text style={styles.intro}>
            Show this code at the hospital, lab, or pharmacy. They'll scan it to pull up your visit instantly.
          </Text>
          <View style={styles.qrCard}>
            {loading ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={28} color={COLORS.error} />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <QRCode value={`${QR_PREFIX}${token}`} size={230} color={COLORS.text} backgroundColor="#ffffff" />
                <View style={styles.refreshRow}>
                  <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.refreshText}>Refreshes in {remaining}s</Text>
                </View>
              </>
            )}
          </View>
          <View style={styles.secureNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
            <Text style={styles.secureText}>
              For your safety this code rotates automatically and expires in 90 seconds. A screenshot won't work later.
            </Text>
          </View>
        </View>
      ) : !permission ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : !permission.granted ? (
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permText}>To scan a provider's QR code, allow camera access.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
              {resolving ? 'Looking up provider…' : 'Point at a hospital, lab, pharmacy or health-worker QR'}
            </Text>
            {resolving && <ActivityIndicator color={COLORS.white} style={{ marginTop: 10 }} />}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },

  toggleRow: {
    flexDirection: 'row', gap: 8,
    margin: SPACING.m, padding: 4,
    backgroundColor: COLORS.surface, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  toggleBtn: {
    flex: 1, flexDirection: 'row', gap: 6,
    alignItems: 'center', justifyContent: 'center',
    height: 42, borderRadius: 12,
  },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  toggleTextActive: { color: COLORS.white },

  // My-QR
  body: { flex: 1, alignItems: 'center', padding: SPACING.l, gap: SPACING.l },
  intro: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21 },
  qrCard: {
    width: 290, height: 290, borderRadius: 28, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  refreshText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  errorBox: { alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  errorText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: COLORS.white, fontWeight: '700' },
  secureNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.secondary, borderRadius: 14, padding: 14,
  },
  secureText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 18, fontWeight: '500' },

  // Scan
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  hint: { color: COLORS.white, fontSize: 14, fontWeight: '600', marginTop: 24, textAlign: 'center', paddingHorizontal: 32 },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.l, gap: 12 },
  permTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  permText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  permBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  permBtnText: { color: COLORS.white, fontWeight: '700' },
});
