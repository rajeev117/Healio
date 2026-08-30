import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { fetchLabPatients } from '../services/api';

export default function Prescriptions({ navigation }) {
  const { user } = useAuth();
  const { hospitalId, hospitalName } = user || {};
  const [patients, setPatients] = useState([]);
  const [search, setSearch]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await fetchLabPatients(hospitalId);
      setPatients(data);
    } catch (e) {
      console.warn('Lab Prescriptions error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hospitalId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = patients.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Lab orders</Text>
            <Text style={styles.labName}>{hospitalName}</Text>
          </View>
          <View style={styles.ordersBadge}>
            <Ionicons name="people-outline" size={14} color={COLORS.white} />
            <Text style={styles.ordersBadgeText}>{patients.length} patients</Text>
          </View>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patient"
            placeholderTextColor={COLORS.textSecondary}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        style={styles.container}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: SPACING.m }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.primary} />}
        renderItem={({ item: p }) => {
          const pendingCount = p.orders.filter(o => o.status === 'pending').length;
          return (
            <TouchableOpacity
              style={styles.patientCard}
              onPress={() => navigation.navigate('PatientPrescriptions', { patient: p })}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(p.name || 'P').charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.patientName}>{p.name}</Text>
                  {pendingCount > 0 && (
                    <View style={styles.newTag}>
                      <Text style={styles.newTagText}>{pendingCount} PENDING</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.patientMeta}>{p.age ? `${p.age} yrs · ` : ''}{p.gender || ''}</Text>
              </View>
              <View style={styles.cardRight}>
                <View style={styles.countPill}>
                  <Text style={styles.countText}>{p.orders.length} orders</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={COLORS.border} />
            <Text style={styles.emptyText}>No patients found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.header, borderBottomRightRadius: SIZES.header,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.m },
  greeting: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '500' },
  labName: { color: COLORS.white, fontSize: 20, fontWeight: '800', marginTop: 2, letterSpacing: -0.3 },
  ordersBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
  },
  ordersBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text },
  container: { flex: 1, backgroundColor: COLORS.surface },
  patientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.white, borderRadius: 16, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  patientName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  newTag: { backgroundColor: COLORS.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newTagText: { fontSize: 10, fontWeight: '800', color: COLORS.white, letterSpacing: 0.5 },
  patientMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countPill: { backgroundColor: COLORS.secondary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  countText: { fontSize: 11, fontWeight: '800', color: COLORS.primary },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
});
