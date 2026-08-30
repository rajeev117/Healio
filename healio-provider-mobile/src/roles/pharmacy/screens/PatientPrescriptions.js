import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { fetchPatientPrescriptions } from '../services/api';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export default function PatientPrescriptions({ route, navigation }) {
  const patient = route?.params?.patient;
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRx, setSelectedRx] = useState(null);

  useEffect(() => {
    if (!patient?.id) { setLoading(false); return; }
    fetchPatientPrescriptions(patient.id)
      .then(setPrescriptions)
      .catch(e => console.warn('PatientPrescriptions error:', e.message))
      .finally(() => setLoading(false));
  }, [patient?.id]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{patient?.name || 'Patient'}</Text>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => navigation.navigate('Checkout', { patient, prescription: selectedRx })}
        >
          <Text style={styles.checkoutBtnText}>Checkout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoStrip}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(patient?.name || '?').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.patientName}>{patient?.name}</Text>
          <Text style={styles.patientMeta}>
            {patient?.age ? `${patient.age} yrs · ` : ''}{patient?.gender || ''}{patient?.phone ? ` · ${patient.phone}` : ''}
          </Text>
        </View>
        <View style={styles.ordersBadge}>
          <Text style={styles.ordersBadgeText}>{patient?.orders?.length || 0} orders</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Prescriptions</Text>

          {prescriptions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-outline" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No prescriptions on file for this patient.</Text>
            </View>
          ) : prescriptions.map(rx => (
            <TouchableOpacity
              key={rx.id}
              style={[styles.rxCard, selectedRx?.id === rx.id && styles.rxCardSelected]}
              onPress={() => setSelectedRx(rx.id === selectedRx?.id ? null : rx)}
            >
              <View style={styles.rxCardTop}>
                <View style={styles.rxIcon}>
                  <Ionicons name="document-text" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rxDoctor}>{rx.appointment?.doctor?.name || 'Doctor'}</Text>
                  <Text style={styles.rxDate}>{fmtDate(rx.created_at)}</Text>
                </View>
                {selectedRx?.id === rx.id && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                    <Text style={styles.selectedBadgeText}>Selected</Text>
                  </View>
                )}
              </View>

              {rx.file_url ? (
                <Image source={{ uri: rx.file_url }} style={styles.rxImage} resizeMode="cover" />
              ) : (
                <View style={styles.rxImagePlaceholder}>
                  <Ionicons name="image-outline" size={32} color={COLORS.textSecondary} />
                  <Text style={styles.rxImagePlaceholderText}>No image</Text>
                </View>
              )}

              {rx.medicines && rx.medicines.length > 0 && (
                <View style={styles.rxMeds}>
                  <Text style={styles.rxMedsLabel}>Medicines:</Text>
                  <Text style={styles.rxMedsText}>{rx.medicines.map(m => m.name || m).join(', ')}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.checkoutFooterBtn}
            onPress={() => navigation.navigate('Checkout', { patient, prescription: selectedRx })}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} />
            <Text style={styles.checkoutFooterBtnText}>Proceed to Checkout</Text>
          </TouchableOpacity>

          <View style={{ height: SPACING.xl * 2 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  checkoutBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  checkoutBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  infoStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  patientName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  patientMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  ordersBadge: { backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  ordersBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  container: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginTop: SPACING.m, marginBottom: SPACING.s },
  rxCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  rxCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  rxCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  rxIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  rxDoctor: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rxDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectedBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  rxImage: { width: '100%', height: 180, borderRadius: 10, backgroundColor: COLORS.surface },
  rxImagePlaceholder: {
    height: 100, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
    borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  rxImagePlaceholderText: { fontSize: 12, color: COLORS.textSecondary },
  rxMeds: { marginTop: 10 },
  rxMedsLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 2 },
  rxMedsText: { fontSize: 13, color: COLORS.text },
  emptyState: { alignItems: 'center', paddingTop: 40, gap: 8 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  checkoutFooterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, marginTop: SPACING.m,
  },
  checkoutFooterBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
