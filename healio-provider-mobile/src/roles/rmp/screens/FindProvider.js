import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { CustomButton } from '../components/CustomButton';
import { fetchProviders, fetchSpecialties } from '../services/api';

export default function FindProvider({ navigation, route }) {
  const { patient } = route.params;
  // Set when the RMP came through the hospital flow (FindFacility) — the list
  // then shows only that hospital's doctors.
  const hospital = route.params?.facility || null;

  const [query, setQuery] = useState('');
  const [specialties, setSpecialties] = useState(['All']);
  const [specialty, setSpecialty] = useState('All');
  const [providers, setProviders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSpecialties(hospital?.id).then(s => setSpecialties(s)).catch(() => {});
  }, [hospital?.id]);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProviders(specialty, hospital?.id);
      setProviders(data);
    } catch (e) {
      console.warn('FindProvider error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [specialty, hospital?.id]);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  const filtered = providers.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  const selected = providers.find(p => p.id === selectedId);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={hospital ? 'Choose a Doctor' : 'Find Provider'} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.contextBar}>
          <Ionicons name={hospital ? 'business-outline' : 'person-outline'} size={15} color={COLORS.primary} />
          <Text style={styles.contextText} numberOfLines={2}>
            {hospital ? `${hospital.name} · for ` : 'Booking for '}
            <Text style={styles.contextName}>{patient.name}</Text>
          </Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search providers"
            placeholderTextColor={COLORS.textSecondary}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <View style={styles.chipRow}>
          {specialties.map(s => (
            <TouchableOpacity key={s} style={[styles.chip, specialty === s && styles.chipSelected]} onPress={() => { setSpecialty(s); setSelectedId(null); }}>
              <Text style={[styles.chipText, specialty === s && styles.chipTextSelected]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : filtered.length === 0 ? (
          <Text style={styles.empty}>
            {hospital
              ? `${hospital.name} has no doctors listed for this filter yet.`
              : 'No doctors match this search.'}
          </Text>
        ) : filtered.map(provider => {
          const isSelected = provider.id === selectedId;
          return (
            <TouchableOpacity key={provider.id} style={[styles.providerCard, isSelected && styles.providerCardSelected]} onPress={() => setSelectedId(provider.id)} activeOpacity={0.8}>
              <Avatar name={provider.name.replace('Dr ', '')} size={48} />
              <View style={styles.providerInfo}>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
                <Text style={styles.providerMeta}>★ {provider.rating} · {provider.hospitalName}</Text>
              </View>
              <View style={styles.providerRight}>
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
                </View>
                <Text style={styles.serviceCharge}>₹{provider.serviceCharge} service</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <CustomButton
          title="Continue"
          disabled={!selected}
          onPress={() => navigation.navigate('SlotSelection', { patient, provider: selected })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  contextBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primarySoft, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 18,
  },
  contextText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary },
  contextName: { fontWeight: '700', color: COLORS.text },
  empty: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 13, marginTop: 40, lineHeight: 19 },
  searchBar: { flexDirection: 'row', alignItems: 'center', height: 48, backgroundColor: COLORS.surface, borderRadius: 14, paddingHorizontal: 15, marginTop: 14, gap: 8 },
  searchInput: { flex: 1, fontSize: 14.5, color: COLORS.text },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 18, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 18, height: 34, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipTextSelected: { color: COLORS.white },
  providerCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 16, marginBottom: 12 },
  providerCardSelected: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  providerInfo: { flex: 1, marginLeft: 14 },
  providerName: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  providerSpecialty: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 4 },
  providerMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },
  providerRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  serviceCharge: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
