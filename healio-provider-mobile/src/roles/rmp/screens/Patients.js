import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { fetchRmpPatients } from '../services/api';

export default function Patients({ navigation }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const rmpId = user?.userId;
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
      console.warn('Patients load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [rmpId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = patients.filter(p =>
    p.name?.toLowerCase().includes(query.toLowerCase()) || p.phone?.includes(query)
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('rmp_my_patients')} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('rmp_search_patients')}
            placeholderTextColor={COLORS.textSecondary}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('NewPatient')} activeOpacity={0.8}>
          <Text style={styles.addBtnText}>+  {t('rmp_add_new_patient')}</Text>
        </TouchableOpacity>

        {filtered.map(patient => (
          <TouchableOpacity
            key={patient.id}
            style={styles.patientCard}
            onPress={() => navigation.navigate('ManagePatient', { patient })}
            activeOpacity={0.8}
          >
            <Avatar name={patient.name} />
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{patient.name}</Text>
              <Text style={styles.patientMeta}>
                {patient.phone} {patient.age ? `· ${patient.age} ${t('yrs')}` : ''} {patient.gender ? `· ${patient.gender}` : ''}
              </Text>
            </View>
            <StatusPill label={patient.status} />
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => navigation.navigate('ManagePatient', { patient })}
            >
              <Text style={styles.bookBtnText}>{t('rmp_book')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 15, marginTop: 18, gap: 8 },
  searchInput: { flex: 1, fontSize: 14.5, color: COLORS.text },
  addBtn: { height: 52, borderRadius: 14, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 8 },
  addBtnText: { fontSize: 14.5, fontWeight: '700', color: COLORS.primary },
  patientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginTop: 12 },
  patientInfo: { flex: 1, marginLeft: 12 },
  patientName: { fontSize: 14.5, fontWeight: '600', color: COLORS.text },
  patientMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  bookBtn: { marginLeft: 8, paddingHorizontal: 14, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  bookBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
});
