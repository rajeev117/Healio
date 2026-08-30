import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import { uploadFile, savePrescriptionDocument } from '../lib/careFlow';
import styles from './Prescriptions.styles';

export default function Prescriptions({ navigation, route }) {
  const storePatients       = useStore((s) => s.patients);
  const hydrateFromSupabase = useStore((s) => s.hydrateFromSupabase);

  // Ensure patients are loaded whenever this screen is focused
  useFocusEffect(
    React.useCallback(() => { hydrateFromSupabase(); }, [hydrateFromSupabase])
  );

  const [prescriptions, setPrescriptions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedRx, setSelectedRx] = useState(null);
  const [filter, setFilter] = useState('All');

  // Upload flow state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadPatient, setUploadPatient] = useState(
    route?.params?.patientId
      ? { id: route.params.patientId, name: route.params.patientName || 'Patient' }
      : null,
  );
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploading, setUploading] = useState(false);

  // Load real prescriptions from DB
  React.useEffect(() => {
    (async () => {
      try {
        const orgId = await useStore.getState().resolveOrgId();
        if (!orgId) { setLoaded(true); return; }
        const { data } = await supabase
          .from('prescriptions')
          .select('*, profiles(name)')
          .eq('organisation_id', orgId)
          .order('created_at', { ascending: false });
        setPrescriptions((data || []).map(rx => {
          const validUntil = rx.valid_until ? new Date(rx.valid_until) : null;
          const expired = validUntil && validUntil < new Date();
          return {
            id: rx.id,
            patientName: rx.profiles?.name || 'Patient',
            diagnosis: rx.instructions
              ? rx.instructions.split('\n')[0].replace(/^Diagnosis:\s*/, '')
              : (rx.file_url ? 'Uploaded prescription' : 'Consultation'),
            date: new Date(rx.created_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            }),
            status: expired ? 'expired' : 'active',
            fileUrl: rx.file_url || null,
          };
        }));
      } catch (e) { /* keep empty */ }
      finally { setLoaded(true); }
    })();
  }, []);

  const filtered = filter === 'All'
    ? prescriptions
    : prescriptions.filter(rx => rx.status === filter.toLowerCase());

  // ── Upload a photo or PDF ────────────────────────────────────────────────────
  const pickAndUpload = async (mode) => {
    if (!uploadPatient?.id) {
      Alert.alert('Select patient', 'Choose which patient this prescription is for.');
      return;
    }
    try {
      let asset;
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert('Permission needed', 'Allow camera access.'); return; }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (res.canceled) return;
        asset = res.assets[0];
      } else if (mode === 'image') {
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
        if (res.canceled) return;
        asset = res.assets[0];
      } else {
        const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'] });
        if (res.canceled) return;
        asset = res.assets[0];
      }

      setUploading(true);
      const url = await uploadFile('records', asset, uploadPatient.id);
      await savePrescriptionDocument({
        patientId: uploadPatient.id,
        fileUrl: url,
        title: uploadTitle.trim() || 'Prescription',
      });

      const newEntry = {
        id: `rx${Date.now()}`,
        patientName: uploadPatient.name,
        diagnosis: uploadTitle.trim() || 'Uploaded prescription',
        date: new Date().toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        }),
        status: 'active',
        fileUrl: url,
      };
      setPrescriptions(prev => [newEntry, ...prev]);
      setShowUpload(false);
      setUploadPatient(null);
      setUploadTitle('');
      Alert.alert('Uploaded ✓', 'Prescription saved and sent to the patient.');
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const promptSource = () => {
    Alert.alert('Upload Prescription', 'Choose a source', [
      { text: 'Take Photo',      onPress: () => pickAndUpload('camera') },
      { text: 'Choose Image',    onPress: () => pickAndUpload('image') },
      { text: 'Choose PDF/File', onPress: () => pickAndUpload('file') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prescriptions</Text>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => { setUploadPatient(null); setUploadTitle(''); setShowUpload(true); }}
        >
          <Ionicons name="add" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {['All', 'Active', 'Expired'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>
              {loaded ? 'No prescriptions yet.\nTap + to upload one.' : 'Loading…'}
            </Text>
          </View>
        )}
        {filtered.map(rx => {
          const isActive = rx.status === 'active';
          const initials = (rx.patientName || 'P')
            .split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
          return (
            <TouchableOpacity key={rx.id} style={styles.rxCard} onPress={() => setSelectedRx(rx)}>
              <View style={styles.rxHeader}>
                <View style={styles.patientAvatar}>
                  <Text style={styles.patientInitials}>{initials}</Text>
                </View>
                <View style={styles.rxInfo}>
                  <Text style={styles.rxPatientName}>{rx.patientName}</Text>
                  <Text style={styles.rxDiagnosis}>{rx.diagnosis}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: isActive ? COLORS.successSoft : COLORS.dangerSoft }]}>
                  <Text style={[styles.statusText, { color: isActive ? COLORS.success : COLORS.error }]}>
                    {isActive ? 'Active' : 'Expired'}
                  </Text>
                </View>
              </View>
              <View style={styles.rxMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{rx.date}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons
                    name={rx.fileUrl ? 'document-attach-outline' : 'document-text-outline'}
                    size={12}
                    color={rx.fileUrl ? COLORS.primary : COLORS.textSecondary}
                  />
                  <Text style={[styles.metaText, rx.fileUrl && { color: COLORS.primary }]}>
                    {rx.fileUrl ? 'Document' : 'Prescription'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* View Modal */}
      <Modal visible={!!selectedRx} animationType="slide" transparent onRequestClose={() => setSelectedRx(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Prescription</Text>
              <TouchableOpacity onPress={() => setSelectedRx(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {selectedRx && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.diagnosisBox}>
                  <Text style={styles.modalPatientName}>{selectedRx.patientName}</Text>
                  <Text style={styles.modalDiagnosis}>{selectedRx.diagnosis}</Text>
                  <Text style={styles.modalDate}>{selectedRx.date}</Text>
                </View>
                {selectedRx.fileUrl ? (
                  <TouchableOpacity
                    style={styles.viewDocBtn}
                    onPress={() => Linking.openURL(selectedRx.fileUrl)}
                  >
                    <Ionicons name="document-text" size={18} color={COLORS.primary} />
                    <Text style={styles.viewDocText}>View prescription document</Text>
                    <Ionicons name="open-outline" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noDocNote}>
                    <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.noDocText}>No document attached.</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Upload Modal */}
      <Modal
        visible={showUpload}
        animationType="slide"
        transparent
        onRequestClose={() => setShowUpload(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Prescription</Text>
              <TouchableOpacity onPress={() => setShowUpload(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Patient picker */}
              <Text style={styles.fieldLabel}>Patient *</Text>
              {storePatients?.length ? (
                <View style={styles.chipRow}>
                  {storePatients.map((p) => {
                    const sel = uploadPatient?.id === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.miniChip, sel && styles.miniChipActive]}
                        onPress={() => setUploadPatient({ id: p.id, name: p.name })}
                      >
                        <Text style={[styles.miniChipText, sel && styles.miniChipTextActive]}>{p.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyHint}>No patients yet. A patient must have booked first.</Text>
              )}

              {/* Title */}
              <Text style={styles.fieldLabel}>Title / Diagnosis (optional)</Text>
              <TextInput
                style={styles.fieldInput}
                value={uploadTitle}
                onChangeText={setUploadTitle}
                placeholder="e.g. Viral fever — 5 day course"
                placeholderTextColor={COLORS.textSecondary}
              />

              <TouchableOpacity
                style={[styles.uploadCta, (!uploadPatient || uploading) && { opacity: 0.5 }]}
                onPress={promptSource}
                disabled={!uploadPatient || uploading}
              >
                {uploading
                  ? <ActivityIndicator color={COLORS.white} />
                  : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color={COLORS.white} />
                      <Text style={styles.saveBtnText}>Pick Image / PDF & Upload</Text>
                    </>
                  )}
              </TouchableOpacity>

              <Text style={styles.uploadHint}>
                Saved to the patient's health records and visible in their app instantly.
              </Text>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
