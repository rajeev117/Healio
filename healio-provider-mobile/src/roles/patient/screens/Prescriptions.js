import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase } from '../services/supabase';
import { getActiveFamilyMemberId, fetchWithFamilyFallback } from '../services/activeProfile';

// ─────────────────────────────────────────────────────────────────────────────
// Prescriptions screen
// Sources:
//   1. `prescriptions` table  — file uploads (file_url) from doctors/provider app
//   2. `health_records` table — type='prescription', text-based prescription notes
// Both are merged and sorted by date (newest first).
// ─────────────────────────────────────────────────────────────────────────────

export default function Prescriptions({ navigation }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRx, setSelectedRx] = useState(null);
  const [filter, setFilter] = useState('All');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const familyId = getActiveFamilyMemberId();

      // 1. File-based prescriptions uploaded by doctors
      const filePrescriptions = await fetchWithFamilyFallback(() => supabase
        .from('prescriptions')
        .select('id, file_url, instructions, created_at')
        .eq('patient_id', user.id)
        .not('file_url', 'is', null)
        .order('created_at', { ascending: false }), familyId);

      // 2. Text prescriptions recorded in health_records
      const recordPrescriptions = await fetchWithFamilyFallback(() => supabase
        .from('health_records')
        .select('id, title, notes, recorded_at')
        .eq('patient_id', user.id)
        .eq('type', 'prescription')
        .order('recorded_at', { ascending: false }), familyId);

      const combined = [
        ...(filePrescriptions || []).map(p => {
          const d = new Date(p.created_at);
          const threeMonths = new Date(d);
          threeMonths.setMonth(threeMonths.getMonth() + 3);
          const isExpired = threeMonths < new Date();
          return {
            id: `file-${p.id}`,
            source: 'file',
            rawDate: p.created_at,
            date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            validUntil: threeMonths.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            title: 'Prescription Document',
            notes: p.instructions || '',
            fileUrl: p.file_url,
            status: isExpired ? 'expired' : 'active',
          };
        }),
        ...(recordPrescriptions || []).map(r => {
          const d = new Date(r.recorded_at);
          const threeMonths = new Date(d);
          threeMonths.setMonth(threeMonths.getMonth() + 3);
          const isExpired = threeMonths < new Date();
          // notes may be JSON with medicines array or plain text
          let medicines = [];
          let notesText = r.notes || '';
          try {
            const parsed = JSON.parse(r.notes);
            if (Array.isArray(parsed.medicines)) medicines = parsed.medicines;
            if (parsed.diagnosis) notesText = parsed.diagnosis;
          } catch (_) {}
          return {
            id: `rec-${r.id}`,
            source: 'record',
            rawDate: r.recorded_at,
            date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            validUntil: threeMonths.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            title: r.title || 'Prescription',
            notes: notesText,
            medicines,
            fileUrl: null,
            status: isExpired ? 'expired' : 'active',
          };
        }),
      ].sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

      setPrescriptions(combined);
    } catch (e) {
      console.warn('Prescriptions load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(load);

  const filtered = filter === 'All'
    ? prescriptions
    : prescriptions.filter(rx => rx.status === filter.toLowerCase());

  const openFile = (url) => {
    Linking.openURL(url).catch(() =>
      Alert.alert('Cannot open file', 'Unable to open the prescription document.')
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Prescriptions</Text>
        <View style={{ width: 40 }} />
      </View>

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

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={56} color={COLORS.border} />
          <Text style={styles.emptyTitle}>No prescriptions yet</Text>
          <Text style={styles.emptySubtitle}>
            Prescriptions added by your doctor will appear here after your consultation.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {filtered.map((rx) => {
            const isActive = rx.status === 'active';
            return (
              <TouchableOpacity
                key={rx.id}
                style={styles.rxCard}
                onPress={() => rx.fileUrl ? openFile(rx.fileUrl) : setSelectedRx(rx)}
              >
                <View style={styles.rxCardHeader}>
                  <View style={styles.doctorAvatar}>
                    <Ionicons
                      name={rx.source === 'file' ? 'document-attach' : 'medical'}
                      size={20}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={styles.rxDocInfo}>
                    <Text style={styles.rxDoctorName}>{rx.title}</Text>
                    {!!rx.notes && (
                      <Text style={styles.rxSpec} numberOfLines={1}>{rx.notes}</Text>
                    )}
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
                    <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>Valid till {rx.validUntil}</Text>
                  </View>
                  {rx.medicines?.length > 0 && (
                    <View style={styles.metaItem}>
                      <Ionicons name="medkit-outline" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.metaText}>{rx.medicines.length} medicine{rx.medicines.length !== 1 ? 's' : ''}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.viewRow}>
                  {rx.fileUrl ? (
                    <>
                      <Ionicons name="open-outline" size={14} color={COLORS.primary} />
                      <Text style={styles.viewText}>View document</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.viewText}>View details</Text>
                      <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Detail modal for text-based (record) prescriptions */}
      <Modal visible={!!selectedRx} animationType="slide" transparent>
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
                <View style={styles.modalDocRow}>
                  <View style={styles.modalAvatar}>
                    <Ionicons name="medical" size={26} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalDocName}>{selectedRx.title}</Text>
                    <Text style={styles.modalDate}>{selectedRx.date}</Text>
                  </View>
                </View>

                {!!selectedRx.notes && (
                  <View style={styles.diagnosisBox}>
                    <Text style={styles.diagBoxLabel}>Notes / Diagnosis</Text>
                    <Text style={styles.diagBoxValue}>{selectedRx.notes}</Text>
                  </View>
                )}

                {selectedRx.medicines?.length > 0 && (
                  <>
                    <Text style={styles.modalSectionTitle}>Medicines</Text>
                    {selectedRx.medicines.map((med, i) => (
                      <View key={i} style={styles.medCard}>
                        <View style={styles.medNum}>
                          <Text style={styles.medNumText}>{i + 1}</Text>
                        </View>
                        <View style={styles.medInfo}>
                          <Text style={styles.medName}>{med.name || med}</Text>
                          {!!med.dosage && (
                            <Text style={styles.medDetail}>{med.dosage}{med.frequency ? ` · ${med.frequency}` : ''}</Text>
                          )}
                          {(med.duration || med.timing) && (
                            <View style={styles.medTagRow}>
                              {!!med.duration && <View style={styles.medTag}><Text style={styles.medTagText}>{med.duration}</Text></View>}
                              {!!med.timing && <View style={styles.medTag}><Text style={styles.medTagText}>{med.timing}</Text></View>}
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </>
                )}

                <View style={{ height: 24 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  filterRow: { flexDirection: 'row', padding: SPACING.m, paddingBottom: 4, gap: 10 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  filterTextActive: { color: COLORS.white },
  listContent: { padding: SPACING.m, paddingTop: 10, gap: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: 12, marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  emptySubtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  rxCard: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  rxCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  doctorAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  rxDocInfo: { flex: 1 },
  rxDoctorName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  rxSpec: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  rxMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  viewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  viewText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%', padding: SPACING.m,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  modalDocRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  modalAvatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  modalDocName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  modalDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  diagnosisBox: {
    backgroundColor: COLORS.infoSoft, borderRadius: 10, padding: 12, marginBottom: 16,
  },
  diagBoxLabel: { fontSize: 11, fontWeight: '700', color: '#3b82f6', marginBottom: 4 },
  diagBoxValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, lineHeight: 20 },
  modalSectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  medCard: {
    flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8,
  },
  medNum: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  medNumText: { color: COLORS.white, fontWeight: '800', fontSize: 12 },
  medInfo: { flex: 1 },
  medName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  medDetail: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginTop: 2 },
  medTagRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  medTag: {
    backgroundColor: COLORS.background, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: COLORS.border,
  },
  medTagText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
});
