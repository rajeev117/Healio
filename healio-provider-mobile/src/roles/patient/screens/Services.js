import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { ApiService } from '../services/ApiService';
import { useLanguage } from '../context/LanguageContext';
import { usePlatformConfig } from '../context/PlatformConfigContext';
import ProviderAvatar from '../components/ProviderAvatar';

// Map a service tile to the admin Kill Switch that controls it.
const SERVICE_KILL = { Labs: 'Lab Orders', Medicine: 'Pharmacy Orders', 'Home Care': 'Home Care Booking' };

export default function Services({ route, navigation }) {
  const { t } = useLanguage();
  const { categories: enabledCats, loaded: cfgLoaded, isLive, isEnabled, reload } = usePlatformConfig();
  const individualOn = isEnabled('individual_doctors');
  // Refresh admin config every time this screen opens (so toggles show live)
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => reload());
    return unsub;
  }, [navigation, reload]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(route.params?.query || null);
  const [data, setData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [doctorSource, setDoctorSource] = useState('All'); // All | Hospital | Individual
  const searchInputRef = useRef(null);

  // Domain icons from MaterialCommunityIcons — the same professional set the
  // registration picker (screens/RegisterSelect) already uses. `tint` colours
  // each glyph so the grid is scannable at a glance.
  const allCategories = [
    { id: 'Doctors',   icon: 'stethoscope',       color: '#E3F2FD', tint: '#1565c0' },
    { id: 'Hospitals', icon: 'hospital-building', color: '#FFF3E0', tint: '#b45309' },
    { id: 'Medicine',  icon: 'pill',              color: '#E8F5E9', tint: '#1b7a3d' },
    { id: 'Labs',      icon: 'test-tube',         color: '#F3E5F5', tint: '#7b2d8e' },
    { id: 'Home Care', icon: 'home-heart',        color: '#E0F2F1', tint: '#0f766e', comingSoon: true },
    { id: 'Emergency', icon: 'alarm-light',       color: '#FFEBEE', tint: '#dc2626' },
    { id: 'Ambulance', icon: 'ambulance',         color: '#EFEBE9', tint: '#5d4037' },
    { id: 'Insurance', icon: 'shield-check',      color: '#F1F8E9', tint: '#558b2f' },
  ];

  // Admin-controlled: a tile shows only if its Service Category is enabled
  // AND its Kill Switch (if any) is live. Falls back to all if config not loaded.
  // Doctors & Hospitals are core (always shown). Other tiles follow their toggle.
  const CORE_CATEGORIES = ['Doctors', 'Hospitals'];
  const enabledNames = enabledCats.map(c => (c.name || '').toLowerCase());
  const categories = allCategories.filter(c => {
    // A coming-soon tile advertises the service rather than serving it, so the
    // admin toggle and kill switch that gate real bookings don't apply.
    if (c.comingSoon) return true;
    const catOk = CORE_CATEGORIES.includes(c.id)
      || ((cfgLoaded && enabledCats.length) ? enabledNames.includes(c.id.toLowerCase()) : true);
    const killName = SERVICE_KILL[c.id];
    const killOk = killName ? isLive(killName) : true;
    return catOk && killOk;
  });

  const filters = ['All', 'Top Rated', 'Nearest'];

  useEffect(() => {
    if (activeCategory) {
      fetchCategoryData();
    }
  }, [activeCategory]);

  useEffect(() => {
    if (route.params?.query) {
      setActiveCategory(route.params.query);
    }
  }, [route.params?.query]);

  const fetchCategoryData = async () => {
    setLoading(true);
    try {
      let result = [];
      if (activeCategory === 'Doctors') result = await ApiService.getDoctors();
      else if (activeCategory === 'Labs') result = await ApiService.getLabs();
      else if (activeCategory === 'Medicine') result = await ApiService.getPharmacies();
      else if (activeCategory === 'Hospitals') result = await ApiService.getHospitals();
      else if (activeCategory === 'Home Care') result = await ApiService.getHomeCare();
      else if (activeCategory === 'Emergency') result = await ApiService.getEmergency();
      else if (activeCategory === 'Ambulance') result = await ApiService.getAmbulance();
      else if (activeCategory === 'Insurance') result = await ApiService.getInsurance();
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getDetailRoute = (item) => {
    // DoctorDetail & HospitalDetail read route.params.item
    if (activeCategory === 'Doctors')    return { screen: 'DoctorDetail',   params: { item, category: activeCategory } };
    if (activeCategory === 'Hospitals')  return { screen: 'HospitalDetail', params: { item, category: activeCategory } };
    if (activeCategory === 'Labs')       return { screen: 'LabBooking',      params: { lab: item } };
    if (activeCategory === 'Medicine')   return { screen: 'PharmacyOrder',   params: { pharmacy: item } };
    if (activeCategory === 'Home Care')  return { screen: 'HomeCareBooking', params: {} };
    return { screen: 'ServiceDetail', params: { item, category: activeCategory } };
  };

  // Categories that have dedicated screens — tap goes directly, no list view
  const DIRECT_SCREENS = {
    Emergency: () => navigation.navigate('Emergency'),
    Ambulance:  () => navigation.navigate('Emergency'), // Emergency handles ambulance too
  };

  // Single entry point for opening a category, used by the grid and by the
  // horizontal pills — so a coming-soon tile can't be walked into sideways.
  const openCategory = (cat) => {
    if (cat.comingSoon) {
      Alert.alert(
        'Coming soon',
        `${t(cat.id.toLowerCase().replace(' ', '_'))} isn't available yet. We're working on it — you'll be able to book it here shortly.`
      );
      return;
    }
    if (DIRECT_SCREENS[cat.id]) {
      DIRECT_SCREENS[cat.id]();
      return;
    }
    setActiveCategory(cat.id);
    setSearchQuery('');
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.specialty && item.specialty.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;
    // When individual doctors are off, only ever show hospital doctors.
    if (activeCategory === 'Doctors' && !individualOn && (item.source || 'hospital') === 'individual') {
      return false;
    }
    // Doctors can be filtered by where they practise (hospital vs individual).
    if (activeCategory === 'Doctors' && individualOn && doctorSource !== 'All') {
      if ((item.source || 'hospital') !== doctorSource.toLowerCase()) return false;
    }
    if (filter === 'Top Rated') return item.rating >= 4.8;
    if (filter === 'Nearest') return parseFloat(item.distance || '10') <= 2;
    return true;
  });

  useEffect(() => {
    if (route.params?.focusSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [route.params]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header with Back and Search */}
      <View style={styles.topHeader}>
        <View style={styles.headerRow}>
          {activeCategory && (
            <TouchableOpacity onPress={() => setActiveCategory(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={COLORS.textSecondary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder={activeCategory ? `${t('search_in_cat')} ${t(activeCategory.toLowerCase().replace(' ', '_'))}...` : t('search_services')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={COLORS.textSecondary}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      {!activeCategory ? (
        <ScrollView contentContainerStyle={styles.categoryGridContainer}>
          <Text style={styles.gridTitle}>{t('all_services')}</Text>
          <View style={styles.grid}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, cat.comingSoon && styles.categoryCardSoon]}
                onPress={() => openCategory(cat)}
                activeOpacity={0.85}
              >
                <View style={[styles.categoryIconCircle, { backgroundColor: cat.color }]}>
                  <MaterialCommunityIcons name={cat.icon} size={32} color={cat.tint} />
                </View>
                <Text style={styles.categoryLabel}>{t(cat.id.toLowerCase().replace(' ', '_'))}</Text>
                {cat.comingSoon && (
                  <View style={styles.soonPill}><Text style={styles.soonText}>Coming soon</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <>
          {/* Category Navigation (Horizontal) */}
          <View style={styles.horizontalNav}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.smallCatPill, activeCategory === cat.id && styles.activeCatPill]}
                  onPress={() => openCategory(cat)}
                >
                  <Text style={[styles.smallCatText, activeCategory === cat.id && styles.activeCatText]}>{t(cat.id.toLowerCase().replace(' ', '_'))}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Doctor source: hospital vs individual practitioners (only when individual doctors are enabled) */}
          {activeCategory === 'Doctors' && individualOn && (
            <View style={styles.filterSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.m }}>
                {['All', 'Hospital', 'Individual'].map(src => (
                  <TouchableOpacity
                    key={src}
                    style={[styles.smallCatPill, doctorSource === src && styles.activeCatPill]}
                    onPress={() => setDoctorSource(src)}
                  >
                    <Text style={[styles.smallCatText, doctorSource === src && styles.activeCatText]}>
                      {src === 'All' ? 'All doctors' : src === 'Hospital' ? 'Hospital doctors' : 'Individual doctors'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Filters */}
          <View style={styles.filterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: SPACING.m }}>
              {filters.map(f => (
                <TouchableOpacity 
                  key={f} 
                  style={[styles.filterChip, filter === f && styles.activeFilterChip]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterChipText, filter === f && styles.activeFilterChipText]}>{t(f.toLowerCase().replace(' ', '_'))}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
          ) : (
            <FlatList
              data={filteredData}
              keyExtractor={item => item.id}
              numColumns={1}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.fullWidthCard}
                  onPress={() => {
                    const route = getDetailRoute(item);
                    navigation.navigate(route.screen, route.params);
                  }}
                >
                  <View style={styles.cardMainRow}>
                    {/* Doctors get their initials, places get their domain
                        glyph — see components/ProviderAvatar. */}
                    <ProviderAvatar
                      kind={activeCategory}
                      name={item.name}
                      uri={item.image}
                      size={56}
                      style={{ marginRight: 15 }}
                    />
                    <View style={styles.cardInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                        {item.rating ? (
                          <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={10} color="#FFD700" />
                            <Text style={styles.ratingValue}>{item.rating}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.itemSubText} numberOfLines={1}>
                        {item.specialty ? t(item.specialty.toLowerCase()) : (item.type || item.availability)}
                      </Text>
                      <View style={styles.cardFooterRow}>
                        {item.distance ? (
                          <View style={styles.locRow}>
                            <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                            <Text style={styles.distanceText}>{item.distance}</Text>
                          </View>
                        ) : <View />}
                        <Text style={styles.priceValue}>{item.fee || 'View'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={60} color={COLORS.border} />
                  <Text style={styles.emptyText}>{t('no_results')}</Text>
                </View>
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  topHeader: { padding: SPACING.m, backgroundColor: COLORS.white },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 12, padding: 4 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    paddingHorizontal: SPACING.m,
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: COLORS.text, fontWeight: '500' },
  categoryGridContainer: { padding: SPACING.m },
  gridTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryCard: { 
    width: '48%', 
    backgroundColor: COLORS.white, 
    borderRadius: 24, 
    padding: SPACING.l, 
    alignItems: 'center', 
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  categoryIconCircle: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  categoryCardSoon: { backgroundColor: COLORS.surface },
  categoryLabel: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  soonPill: {
    marginTop: 6, borderRadius: 8,
    paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: COLORS.border,
  },
  soonText: { fontSize: 10, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.3 },
  horizontalNav: { paddingBottom: SPACING.m, paddingHorizontal: SPACING.m },
  smallCatPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, marginRight: 10, borderWidth: 1, borderColor: COLORS.border },
  activeCatPill: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  smallCatText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  activeCatText: { color: COLORS.white },
  filterSection: { marginBottom: SPACING.m },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, backgroundColor: COLORS.white, marginRight: 8, borderWidth: 1, borderColor: COLORS.border },
  activeFilterChip: { backgroundColor: COLORS.secondary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  activeFilterChipText: { color: COLORS.primary },
  listContent: { padding: SPACING.m },
  
  fullWidthCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.m,
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardMainRow: { flexDirection: 'row', alignItems: 'center' },
  itemIconBox: { 
    width: 60, 
    height: 60, 
    borderRadius: 16, 
    backgroundColor: COLORS.secondary, 
    justifyContent: 'center', 
    alignItems: 'center',
    marginRight: 15
  },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9E6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  ratingValue: { fontSize: 11, fontWeight: '800', color: '#FFB800', marginLeft: 2 },
  itemSubText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locRow: { flexDirection: 'row', alignItems: 'center' },
  distanceText: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 4 },
  priceValue: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 10, color: COLORS.textSecondary, fontSize: 16 }
});

