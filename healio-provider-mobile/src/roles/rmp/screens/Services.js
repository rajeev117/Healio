import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { SERVICE_LIST } from '../constants/services';
import { ScreenHeader } from '../components/ScreenHeader';

const SERVICE_FILTERS = ['All', ...SERVICE_LIST.map(s => s.label)];

export default function Services({ navigation }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

  const q = query.trim().toLowerCase();
  const categories = SERVICE_LIST.filter(c =>
    (filter === 'All' || c.label === filter) &&
    (c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Find Healthcare" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search doctors, labs, pharmacies, hospitals..."
            placeholderTextColor={COLORS.textSecondary}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {SERVICE_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipSelected]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextSelected]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Every category books on a patient's behalf, so each one starts by
            picking the patient — LinkPatient carries the service through. */}
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.catCard, cat.comingSoon && styles.catCardMuted]}
            activeOpacity={0.8}
            onPress={() => (cat.comingSoon
              ? Alert.alert('Coming soon', `${cat.label} bookings are not live yet. You'll be able to arrange them for your patients here shortly.`)
              : navigation.navigate('LinkPatient', { service: cat.key }))}
          >
            <View style={[styles.catIcon, { backgroundColor: cat.tint }]}>
              <MaterialCommunityIcons name={cat.icon} size={24} color={cat.iconColor} />
            </View>
            <View style={styles.catInfo}>
              <View style={styles.catNameRow}>
                <Text style={styles.catName}>{cat.label}</Text>
                {cat.comingSoon && (
                  <View style={styles.soonPill}><Text style={styles.soonText}>Coming soon</Text></View>
                )}
              </View>
              <Text style={styles.catDesc}>{cat.description}</Text>
              {!cat.comingSoon && <Text style={styles.catAction}>{cat.action} for a patient</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ))}

        {categories.length === 0 && (
          <Text style={styles.empty}>No service matches that search.</Text>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 15,
    marginTop: 14,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  chipScroll: { marginTop: 16, marginBottom: 4, flexGrow: 0 },
  chip: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  chipTextSelected: { color: COLORS.white },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  catCardMuted: { backgroundColor: COLORS.surface },
  catIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catInfo: { flex: 1, marginLeft: 16 },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  catDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  catAction: { fontSize: 11.5, fontWeight: '600', color: COLORS.primary, marginTop: 6 },
  soonPill: { backgroundColor: COLORS.mutedSoft, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 },
  soonText: { fontSize: 9.5, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.3 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 40, fontSize: 13.5 },
});
