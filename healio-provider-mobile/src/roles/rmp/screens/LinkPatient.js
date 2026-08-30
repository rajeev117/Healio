import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { getService } from '../constants/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../../../context/AuthContext';
import { fetchRmpPatients } from '../services/api';

export default function LinkPatient({ navigation, route }) {
  const { user } = useAuth();
  const rmpId = user?.userId;
  // Which service the RMP is booking — set by the Services grid, defaults to a
  // doctor consultation (the Dashboard's "New booking" shortcut).
  const service = getService(route?.params?.service);
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!rmpId) return;
    setLoading(true);
    try {
      const data = await fetchRmpPatients(rmpId);
      setPatients(data);
    } catch (e) {
      console.warn('LinkPatient load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [rmpId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = patients.filter(p =>
    p.name?.toLowerCase().includes(query.toLowerCase()) || p.phone?.includes(query)
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={service.action} onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={[styles.serviceBar, service.urgent && styles.serviceBarUrgent]}>
          <MaterialCommunityIcons name={service.icon} size={16} color={service.urgent ? '#dc2626' : COLORS.primary} />
          <Text style={styles.serviceBarText}>
            Choose the patient you are {service.consentNote} for
          </Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by phone or name"
            placeholderTextColor={COLORS.textSecondary}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewPatient')} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+  Add new patient</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>LINKED PATIENTS</Text>

        {filtered.map(patient => (
          <TouchableOpacity
            key={patient.id}
            style={styles.patientCard}
            onPress={() => navigation.navigate('ConsentOTP', { patient, service: service.key })}
            activeOpacity={0.8}
          >
            <Avatar name={patient.name} />
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{patient.name}</Text>
              <Text style={styles.patientPhone}>{patient.phone}</Text>
            </View>
            <StatusPill label={patient.status} />
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} style={styles.chevron} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  serviceBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primarySoft, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 18,
  },
  serviceBarUrgent: { backgroundColor: '#fff7f7', borderWidth: 1, borderColor: '#fecaca' },
  serviceBarText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 15, marginTop: 14, gap: 8 },
  searchInput: { flex: 1, fontSize: 14.5, color: COLORS.text },
  addBtn: { height: 52, borderRadius: 14, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  addBtnText: { fontSize: 14.5, fontWeight: '700', color: COLORS.primary },
  sectionLabel: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.6, marginTop: 26, marginBottom: 10 },
  patientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginBottom: 12 },
  patientInfo: { flex: 1, marginLeft: 12 },
  patientName: { fontSize: 14.5, fontWeight: '600', color: COLORS.text },
  patientPhone: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  chevron: { marginLeft: 8 },
});
