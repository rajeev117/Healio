// ─────────────────────────────────────────────────────────────────────────────
// FindFacility — pick the lab, pharmacy or hospital a booking goes to.
//
// One screen for all three: `service` (see constants/services) says which
// organisations.type to list and where Continue leads —
//   lab      → RmpLabBooking      (prescription order, patient-app style)
//   pharmacy → RmpPharmacyOrder   (prescription order, patient-app style)
//   hospital → FindProvider       (that hospital's doctors, then the slot flow)
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getService } from '../constants/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { CustomButton } from '../components/CustomButton';
import { fetchFacilities } from '../services/api';

export default function FindFacility({ navigation, route }) {
  const { patient } = route.params;
  const service = getService(route.params?.service);

  const [query, setQuery] = useState('');
  const [facilities, setFacilities] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setFacilities(await fetchFacilities(service.key));
    } catch (e) {
      setError(e.message || 'Could not load. Pull to try again.');
    } finally {
      setLoading(false);
    }
  }, [service.key]);

  useEffect(() => { load(); }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = facilities.filter(f =>
    f.name.toLowerCase().includes(q) || f.city.toLowerCase().includes(q)
  );
  const hasUnits = facilities.some(f => f.source === 'hospital');
  const selected = facilities.find(f => f.id === selectedId) || null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title={service.listTitle} onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.patientBar}>
          <Ionicons name="person-outline" size={15} color={COLORS.primary} />
          <Text style={styles.patientBarText}>
            Booking for <Text style={styles.patientBarName}>{patient.name}</Text>
            {!!patient.accountName && (
              <Text>{` (${patient.relation}) · account: ${patient.accountName}`}</Text>
            )}
          </Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={service.searchPlaceholder}
            placeholderTextColor={COLORS.textSecondary}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
        ) : error ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={load}><Text style={styles.retry}>Try again</Text></TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="business-outline" size={34} color={COLORS.border} />
            <Text style={styles.emptyText}>{q ? 'No match for that search.' : service.emptyText}</Text>
          </View>
        ) : filtered.map(facility => {
          const isSelected = facility.id === selectedId;
          return (
            <TouchableOpacity
              key={facility.id}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => setSelectedId(facility.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: service.tint }]}>
                <MaterialCommunityIcons name={service.icon} size={22} color={service.iconColor} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{facility.name}</Text>
                <Text style={styles.meta} numberOfLines={2}>
                  {[facility.address, facility.city].filter(Boolean).join(', ') || service.label}
                </Text>
                {/* Only worth calling out when both kinds are on the list. */}
                {hasUnits && (
                  <Text style={styles.sourceTag}>
                    {facility.source === 'hospital' ? `Inside ${facility.orgName}` : 'Standalone provider'}
                  </Text>
                )}
              </View>
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <CustomButton
          title="Continue"
          disabled={!selected}
          onPress={() => navigation.navigate(service.bookingScreen, {
            patient,
            facility: selected,
            service: service.key,
          })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  patientBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primarySoft, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 18,
  },
  patientBarText: { fontSize: 12.5, color: COLORS.textSecondary },
  patientBarName: { fontWeight: '700', color: COLORS.text },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', height: 48,
    backgroundColor: COLORS.surface, borderRadius: 14,
    paddingHorizontal: 15, marginTop: 14, marginBottom: 6, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14.5, color: COLORS.text },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginTop: 12,
  },
  cardSelected: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  iconBox: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, marginLeft: 14 },
  name: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, lineHeight: 16 },
  sourceTag: { fontSize: 11, fontWeight: '600', color: COLORS.primary, marginTop: 4 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 50 },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  retry: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
