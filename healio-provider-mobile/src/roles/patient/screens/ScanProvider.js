import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING } from '../constants/theme';
import { resolveProviderQr } from '../services/supabase';

const KIND_LABEL = { hospital: 'Hospital', lab: 'Lab', pharmacy: 'Pharmacy', rmp: 'Healthcare Consultant' };

export default function ScanProvider({ navigation }) {
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
        Alert.alert(
          'Not a Healio provider code',
          'This QR code isn\'t a valid Healio hospital, lab, pharmacy or health-worker code.',
          [{ text: 'Scan Again', onPress: resetScan }],
        );
        return;
      }

      if (provider.kind === 'rmp') {
        Alert.alert(
          provider.name || 'Health Worker',
          `Verified Healio Health Worker${provider.subtitle ? `\n${provider.subtitle}` : ''}`,
          [
            { text: 'Scan Again', style: 'cancel', onPress: resetScan },
            { text: 'Done', onPress: () => navigation.goBack() },
          ],
        );
        return;
      }

      // hospital / lab / pharmacy → open the hospital's detail page
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

  // ── Permission gates ─────────────────────────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header navigation={navigation} />
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header navigation={navigation} />
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permText}>To scan a provider's QR code, allow camera access.</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>Grant Access</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            {resolving ? 'Looking up provider…' : 'Point at a hospital, lab, pharmacy or health-worker QR'}
          </Text>
          {resolving && <ActivityIndicator color={COLORS.white} style={{ marginTop: 10 }} />}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Header({ navigation }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Scan Provider</Text>
      <View style={{ width: 40 }} />
    </View>
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
  cameraWrap: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 240, height: 240, borderRadius: 24,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'transparent',
  },
  hint: { color: COLORS.white, fontSize: 14, fontWeight: '600', marginTop: 24, textAlign: 'center', paddingHorizontal: 32 },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.l, gap: 12 },
  permTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  permText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  permBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  permBtnText: { color: COLORS.white, fontWeight: '700' },
});
