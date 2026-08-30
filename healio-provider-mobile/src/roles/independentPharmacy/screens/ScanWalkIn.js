// Scan a walk-in patient's Healio QR to start an order.
//
// Deliberately NOT src/screens/ScanPatient.js: that screen's date-range flow
// calls fetchPatientVisitsForRange, which looks for appointments at the scanning
// org. An independent pharmacy never has appointments, so it would always
// report "no visits found". Here the scan resolves identity and goes straight to
// the quote.
//
// Note the asymmetry with the counter's own QR: resolve_qr_token gives us the
// patient's identity but does not create a qr_checkins row, so it does not
// unlock their prescriptions. For those, the patient has to scan the counter's
// code — which is what RxPreview's empty state asks for.
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { resolveQrToken } from '../../../lib/supabase';
import AppBar from '../components/AppBar';

export default function ScanWalkIn({ navigation }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [resolving, setResolving] = useState(false);
  const handled = useRef(false);

  const onScanned = useCallback(async ({ data }) => {
    if (handled.current) return;
    handled.current = true;
    setResolving(true);
    try {
      const patient = await resolveQrToken(data);
      if (!patient) {
        Alert.alert('Not recognised', "That code isn't a valid Healio patient code, or it has expired.", [
          { text: 'Try again', onPress: () => { handled.current = false; setResolving(false); } },
        ]);
        return;
      }
      navigation.replace('OrderRequestQuote', {
        patientId: patient.patientId,
        patientName: patient.patientName,
        phone: patient.phone,
        gender: patient.gender,
        dateOfBirth: patient.dateOfBirth,
      });
    } catch (e) {
      Alert.alert('Something went wrong', e.message || 'Could not read that code.', [
        { text: 'Try again', onPress: () => { handled.current = false; setResolving(false); } },
      ]);
    }
  }, [navigation]);

  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <AppBar title="Scan patient" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <View style={styles.permIcon}><Ionicons name="camera-outline" size={28} color={COLORS.primary} /></View>
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permBody}>
            The counter uses the camera to read a patient's Healio QR code. Nothing is recorded.
          </Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Allow camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar
        title="Scan patient"
        subtitle="Point at the patient's Healio code"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={resolving ? undefined : onScanned}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame} />
          <Text style={styles.hint}>
            {resolving ? 'Reading…' : 'Line the QR up inside the frame'}
          </Text>
        </View>
        {resolving && (
          <View style={styles.busy}>
            <ActivityIndicator size="large" color={COLORS.white} />
          </View>
        )}
      </View>

      <View style={[styles.footer, { marginBottom: 20 + insets.bottom }]}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
        <Text style={styles.footerText}>
          To see the patient's prescriptions, ask them to scan your counter QR instead — that is what shares them.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  cameraWrap: { flex: 1, margin: 20, borderRadius: SIZES.radiusXl, overflow: 'hidden', backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 20 },
  frame: {
    width: 230, height: 230, borderRadius: 24,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent',
  },
  hint: { color: COLORS.white, fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32 },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  permIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: COLORS.primarySoft, justifyContent: 'center', alignItems: 'center' },
  permTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  permBody: { fontSize: 12.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 19 },
  permBtn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radius, paddingHorizontal: 22, paddingVertical: 13, marginTop: 8 },
  permBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  footer: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: COLORS.primarySoft, margin: 20, marginTop: 0,
    borderRadius: SIZES.radiusLg, padding: 14,
  },
  footerText: { flex: 1, fontSize: 11.5, color: '#a1736a', lineHeight: 17 },
});
