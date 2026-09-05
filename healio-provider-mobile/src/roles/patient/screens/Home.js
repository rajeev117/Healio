import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image, Modal, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { COLORS, SPACING } from '../constants/theme';
import { Card } from '../components/Card';
import { useHomeData } from '../controllers/HomeController';
import { Logo } from '../components/Logo';
import { useWallet } from '../context/WalletContext';
import { usePlatformConfig } from '../context/PlatformConfigContext';
import { useNotificationCenter } from '../context/NotificationContext';
import { ApiService } from '../services/ApiService';
import { detectCurrentLocation, reverseGeocode } from '../services/location';
import { saveMyProfile, supabase } from '../services/supabase';
import MapPickerModal from '../components/MapPickerModal';
import { STATUS, listRequests, subscribe } from '../../../lib/orderRequests';
import styles from './Home.styles';

// A confirmed order stays on the dashboard for a few days after payment, then
// drops off — anything older lives in My Orders.
const CONFIRMED_VISIBLE_MS = 3 * 24 * 60 * 60 * 1000;

// Needs-your-approval first, then still-being-priced, then recently confirmed.
const ORDER_RANK = {
  [STATUS.QUOTED]: 0,
  [STATUS.AWAITING_REVIEW]: 1,
  [STATUS.CONFIRMED]: 2,
};

function orderStrip(request) {
  if (request.status === STATUS.QUOTED) {
    return {
      label: 'Invoice ready to approve',
      hint: `Approve ₹${request.invoice?.total ?? ''} to confirm this order`,
      icon: 'receipt-outline',
      action: true,
    };
  }
  if (request.status === STATUS.CONFIRMED) {
    return {
      label: 'Order confirmed',
      hint: `₹${request.invoice?.total ?? ''} paid · tap to view`,
      icon: 'checkmark-circle-outline',
    };
  }
  return {
    label: request.kind === 'lab' ? 'Lab request placed' : 'Medicine order placed',
    hint: 'Waiting for the provider to send the invoice',
    icon: 'hourglass-outline',
  };
}

// Fixed dashboard shortcuts. Each navigates to the Services screen with the
// category query the Services list already understands ('Medicine' = pharmacy).
// Emergency is deliberately bright red and jumps straight to the Emergency screen.
// Morning until noon, afternoon until 5pm, evening after — same boundaries the
// doctor dashboard uses (roles/doctor/screens/Home.js).
const getGreeting = (t) => {
  const h = new Date().getHours();
  if (h < 12) return t('good_morning');
  if (h < 17) return t('good_afternoon');
  return t('good_evening');
};

// Icons come from MaterialCommunityIcons so a shortcut here shows the same
// glyph as its tile on the Services grid.
const QUICK_ACTIONS = [
  { key: 'Doctors',   label: 'Doctors',   query: 'Doctors',    icon: 'stethoscope',       bg: '#FFF9E6', color: '#B8860B' },
  { key: 'Hospitals', label: 'Hospitals', query: 'Hospitals',  icon: 'hospital-building', bg: '#E3F2FD', color: '#1D4ED8' },
  { key: 'Emergency', label: 'Emergency', screen: 'Emergency', icon: 'alarm-light',       bg: '#B02A37', color: '#FFFFFF', danger: true },
  { key: 'Pharmacy',  label: 'Pharmacy',  query: 'Medicine',   icon: 'pill',              bg: '#EBF8FF', color: '#3182CE' },
  { key: 'Lab',       label: 'Lab',       query: 'Labs',       icon: 'test-tube',         bg: '#E6FFFA', color: '#319795' },
];

export default function Home({ navigation, route }) {
  const { t } = useLanguage();
  const { isFlagOn, isEnabled, reload } = usePlatformConfig();
  // Admin can hide this banner by turning off the "Healio Plus" feature flag.
  const healioPlusOn = isFlagOn('Healio Plus');
  // A quick-action tile is hidden when admin turns its service off in Features.
  // Doctors and Hospitals are core (always shown); Records is internal.
  const SERVICE_FEATURE = { Medicine: 'Medicine', Labs: 'Labs', 'Home Care': 'Home Care' };
  const serviceVisible = (name) => {
    const f = SERVICE_FEATURE[name];
    return !f || isEnabled(f);
  };
  // Refresh admin config each time Home opens so toggles show live.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => reload());
    return unsub;
  }, [navigation, reload]);

  // The status bar sits on this screen's maroon header, so its icons must be
  // light — and must go back to dark when leaving, or they vanish against the
  // white screens everywhere else.
  useEffect(() => {
    setStatusBarStyle('light');
    const onFocus = navigation.addListener('focus', () => setStatusBarStyle('light'));
    const onBlur = navigation.addListener('blur', () => setStatusBarStyle('dark'));
    return () => { onFocus(); onBlur(); setStatusBarStyle('dark'); };
  }, [navigation]);
  const { balance } = useWallet();
  const { unreadCount, banner, dismissBanner } = useNotificationCenter();
  const hasAccess = balance >= 50;
  const {
    loading,
    user,
    upcomingAppointment,
    services,
    locations,
    currentLocation,
    topDoctors,
    topHospitals,
    bookedDoctorNames,
    selectLocation,
  } = useHomeData();

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [savedCoords, setSavedCoords] = useState(null);

  const handleMapConfirm = async ({ latitude, longitude, address: picked, city: pickedCity }) => {
    setShowMap(false);
    // A Places search result already names the spot; only fall back to a
    // reverse-geocode round trip when the pin was dragged instead.
    const loc = (picked && pickedCity)
      ? { name: picked, city: pickedCity, area: null }
      : await reverseGeocode(latitude, longitude);
    selectLocation({ id: 'map', name: loc.name });
    setSavedCoords({ latitude, longitude });
    await persistCity(loc.city || loc.name, { area: loc.area || null, latitude, longitude });
    setShowLocationModal(false);
  };

  // Real health summary (replaces the old hardcoded vitals).
  const [health, setHealth] = useState({ records: 0, upcoming: 0, prescriptions: 0 });
  useEffect(() => {
    const loadHealth = async () => {
      try {
        const [records, appts] = await Promise.all([
          ApiService.getRecords(),
          ApiService.getAppointments(),
        ]);
        setHealth({
          records: records.length,
          prescriptions: records.filter(r => r.category === 'Prescriptions').length,
          upcoming: appts.filter(a => a.status === 'Upcoming').length,
        });
      } catch (e) { /* keep zeros */ }
    };
    loadHealth();
    const unsub = navigation.addListener('focus', loadHealth);
    return unsub;
  }, [navigation]);

  // Live order strip — pharmacy/lab orders that are still in flight or were
  // just confirmed, shown on the dashboard next to the upcoming appointment.
  const [activeOrders, setActiveOrders] = useState([]);
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const all = await listRequests();
      const live = all.filter((r) => {
        if (r.status === STATUS.QUOTED || r.status === STATUS.AWAITING_REVIEW) return true;
        return r.status === STATUS.CONFIRMED
          && Date.now() - (r.paidAt || r.updatedAt || 0) < CONFIRMED_VISIBLE_MS;
      });
      live.sort((a, b) => (ORDER_RANK[a.status] - ORDER_RANK[b.status]) || (b.createdAt - a.createdAt));
      if (alive) setActiveOrders(live);
    };
    sync();
    const unsub = subscribe(sync);
    return () => { alive = false; unsub(); };
  }, []);

  // Open My Orders on the tab the top order belongs to, so a lab request
  // doesn't land the patient on the pharmacy tab.
  const ordersTab = activeOrders[0]?.kind === 'lab' ? 'lab' : 'pharmacy';

  // Load the patient's saved city on mount so the header shows it.
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('city, area, latitude, longitude').eq('id', user.id).maybeSingle();
        const label = [data?.area, data?.city].filter(Boolean).join(', ');
        if (label) selectLocation({ id: 'saved', name: label });
        if (data?.latitude != null && data?.longitude != null) {
          setSavedCoords({ latitude: Number(data.latitude), longitude: Number(data.longitude) });
        }
      } catch (e) { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistCity = async (city, extra = {}) => {
    try { await saveMyProfile({ city, ...extra }); } catch (e) { /* offline ok */ }
  };

  const handleUseCurrentLocation = async () => {
    setDetectingLocation(true);
    try {
      const loc = await detectCurrentLocation();
      selectLocation({ id: 'current', name: loc.name });
      await persistCity(loc.city || loc.name, {
        area: loc.area || null,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      setShowLocationModal(false);
    } catch (e) {
      Alert.alert('Location', e?.message || 'Could not get your location.');
    } finally {
      setDetectingLocation(false);
    }
  };

  if (loading && !user) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    // The app draws edge-to-edge (android/gradle.properties: edgeToEdgeEnabled),
    // so the status-bar strip is ours to paint. `edges={['top']}` with a maroon
    // background lets the curved header run all the way up instead of sitting
    // under a white band; the bottom is the tab bar's job, not this screen's.
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {banner && (
        <TouchableOpacity
          style={styles.referralBanner}
          onPress={() => { dismissBanner(); navigation.navigate('Notifications'); }}
        >
          <View style={styles.referralBannerIcon}>
            <Ionicons name={banner.icon} size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.referralBannerTitle}>{banner.title}</Text>
            <Text style={styles.referralBannerBody}>{banner.body}</Text>
          </View>
          <TouchableOpacity onPress={dismissBanner} style={{ padding: 4 }}>
            <Ionicons name="close" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Curved Header Section in Primary Color */}
        <View style={styles.primaryHeader}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity style={styles.userInfoBtn} onPress={() => navigation.navigate('Profile')}>
              <View style={styles.avatarMiniWrapper}>
                {user?.avatar ? (
                  <Image source={{ uri: user?.avatar }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={20} color={COLORS.primary} />
                )}
              </View>
              <View style={styles.welcomeTextCol}>
                <Text style={styles.headerGoodMorning}>{getGreeting(t)}</Text>
                <Text style={styles.headerUserName}>
                  {route?.params?.userName?.split(' ')[0] || user?.name?.split(' ')[0] || t('there')}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={styles.notificationBtn}
                onPress={() => setShowLocationModal(true)}
              >
                <Ionicons name="location" size={20} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('QRScanHub')}>
                <Ionicons name="qr-code-outline" size={20} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('Wallet')}>
                <Ionicons name="wallet-outline" size={20} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.notificationBtn} onPress={() => navigation.navigate('Notifications')}>
                <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
                {unreadCount > 0 && <View style={styles.notificationDot} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>How are you feeling today?</Text>
            <Text style={styles.headerSubtitle}>
              Quick care, trusted doctors, all your records — in one place.
            </Text>
          </View>

          {/* Next Appointment Banner inside primary header */}
          {upcomingAppointment && (
            <TouchableOpacity
              style={styles.headerAppointmentCard}
              onPress={() => navigation.navigate('AppointmentDetail', { appointment: upcomingAppointment })}
            >
              <View style={styles.headerApptLeft}>
                <Text style={styles.headerApptLabel}>Upcoming appointment</Text>
                <Text style={styles.headerApptValue}>
                  {upcomingAppointment.doctorName} · {upcomingAppointment.date.split(' ').slice(0, 2).join(' ')}, {upcomingAppointment.time}
                </Text>
                <View style={styles.headerApptHintRow}>
                  <Ionicons name="qr-code-outline" size={11} color="rgba(255,255,255,0.65)" />
                  <Text style={styles.headerApptHint}>Tap to start your journey</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.white} opacity={0.9} />
            </TouchableOpacity>
          )}

          {/* Live orders — same treatment as the appointment banner */}
          {activeOrders.slice(0, 2).map((order, i) => {
            const strip = orderStrip(order);
            return (
              <TouchableOpacity
                key={order.id}
                style={[
                  styles.headerAppointmentCard,
                  (upcomingAppointment || i > 0) && styles.headerOrderCard,
                  strip.action && styles.headerOrderCardAction,
                ]}
                onPress={() => navigation.navigate('OrderApproval', { requestId: order.id })}
              >
                <View style={styles.headerApptLeft}>
                  <Text style={styles.headerApptLabel}>{strip.label}</Text>
                  <Text style={styles.headerApptValue}>
                    {order.providerName} · {order.orderNumber}
                  </Text>
                  <View style={styles.headerApptHintRow}>
                    <Ionicons name={strip.icon} size={11} color="rgba(255,255,255,0.65)" />
                    <Text style={styles.headerApptHint}>{strip.hint}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.white} opacity={0.9} />
              </TouchableOpacity>
            );
          })}

          {activeOrders.length > 2 && (
            <TouchableOpacity
              style={styles.headerMoreOrders}
              onPress={() => navigation.navigate('Orders', { tab: ordersTab })}
            >
              <Text style={styles.headerMoreOrdersText}>
                View all {activeOrders.length} active orders
              </Text>
              <Ionicons name="arrow-forward" size={13} color={COLORS.white} />
            </TouchableOpacity>
          )}
        </View>

        {/* Floating Quick Actions Section */}
        <View style={styles.quickActionsSection}>
          <View style={styles.quickActionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.quickActionCard}
                onPress={() => action.screen
                  ? navigation.navigate(action.screen)
                  : navigation.navigate('Services', { query: action.query })}
              >
                <View style={[styles.quickActionIconContainer, { backgroundColor: action.bg }]}>
                  <MaterialCommunityIcons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={[styles.quickActionLabel, action.danger && styles.emergencyQuickLabel]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Upgrade to Healio Plus Banner — hidden when admin turns off the "Healio Plus" flag */}
        {healioPlusOn && (
        <View style={styles.premiumSection}>
          <TouchableOpacity
            style={[styles.premiumCard, !hasAccess && { backgroundColor: COLORS.secondary, borderColor: COLORS.primary, borderWidth: 1 }]}
            onPress={() => navigation.navigate('HealioPlusPayment', { userName: route?.params?.userName || user?.name })}
          >
            <View style={[styles.premiumIconContainer, !hasAccess && { backgroundColor: COLORS.primary }]}>
              <Ionicons name="trophy" size={20} color={hasAccess ? COLORS.white : COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.premiumTitle, !hasAccess && { color: COLORS.primary }]}>
                {hasAccess ? "Healio Plus • Active" : "Upgrade to Healio Plus"}
              </Text>
              <Text style={[styles.premiumSubtitle, !hasAccess && { color: COLORS.textSecondary }]}>
                {hasAccess 
                  ? `Wallet Balance: ₹${balance} • Booking Unlocked` 
                  : `Wallet Balance: ₹${balance} • Deposit ₹50 to unlock bookings`
                }
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={hasAccess ? COLORS.white : COLORS.primary} opacity={0.8} />
          </TouchableOpacity>
        </View>
        )}

        {/* Health Summary Section (real data) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your health</Text>
            <TouchableOpacity onPress={() => navigation.navigate('HealthInsights')}>
              <Text style={styles.seeAllText}>{t('see_all')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vitalsScrollContent}
          >
            <VitalCard
              label="Records"
              value={String(health.records)}
              unit=""
              icon="document-text"
              tint="#007bff"
              bgColor="#F0F7FF"
              onPress={() => navigation.navigate('ReportsHub')}
            />
            <VitalCard
              label="Upcoming"
              value={String(health.upcoming)}
              unit="visits"
              icon="calendar"
              tint="#28a745"
              bgColor="#F3FAF4"
              onPress={() => navigation.navigate('Appointments')}
            />
            <VitalCard
              label="Orders"
              value={String(activeOrders.length)}
              unit="active"
              icon="cube"
              tint="#B45309"
              bgColor="#FFF7EA"
              onPress={() => navigation.navigate('Orders', { tab: ordersTab })}
            />
            <VitalCard
              label="Prescriptions"
              value={String(health.prescriptions)}
              unit=""
              icon="medical"
              tint="#673AB7"
              bgColor="#F5F0FF"
              onPress={() => navigation.navigate('ReportsHub')}
            />
          </ScrollView>
        </View>

        {/* Search / Find Healthcare Section */}
        <View style={[styles.section, { marginTop: SPACING.s }]}>
          <Text style={styles.searchSectionTitle}>{t('find_healthcare')}</Text>
          <TouchableOpacity 
            activeOpacity={0.8}
            style={styles.searchBarPlaceholder}
            onPress={() => navigation.navigate('Services', { focusSearch: true })}
          >
            <Ionicons name="search-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.searchPlaceholderText}>{t('search_hint')}</Text>
          </TouchableOpacity>
        </View>

        {/* Top Doctors Section (hospital doctors — core MVP, always shown) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('top_doctors')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Services', { query: 'Doctors' })}>
              <Text style={styles.seeAllText}>{t('view_all')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.verticalList}>
            {topDoctors.map(doctor => (
              <DoctorCard
                key={doctor.id}
                name={doctor.name}
                specialty={doctor.specialty}
                rating={doctor.rating}
                distance={doctor.distance}
                isBooked={bookedDoctorNames.has(doctor.name)}
                onPress={() => navigation.navigate('DoctorDetail', { item: doctor, category: 'Doctors' })}
              />
            ))}
          </View>
        </View>

        {/* Nearby Hospitals Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Hospitals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Services', { query: 'Hospitals' })}>
              <Text style={styles.seeAllText}>{t('view_all')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.verticalList}>
            {topHospitals.map(hospital => (
              <HospitalCard
                key={hospital.id}
                name={hospital.name}
                type={hospital.type}
                rating={hospital.rating}
                distance={hospital.distance}
                onPress={() => navigation.navigate('HospitalDetail', { item: hospital, category: 'Hospitals' })}
              />
            ))}
          </View>
        </View>

        {/* Bottom spacing before the modals */}
        <View style={{ marginBottom: SPACING.xl * 1.5 }} />

        {/* Location Selection Modal */}
        <Modal
          visible={showLocationModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowLocationModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('select_city')}</Text>
                <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={styles.currentLocationBtn}
                onPress={handleUseCurrentLocation}
                disabled={detectingLocation}
              >
                <View style={styles.currentLocIcon}>
                  {detectingLocation ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Ionicons name="navigate" size={20} color={COLORS.primary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentLocTitle}>{t('use_current_location')}</Text>
                  <Text style={styles.currentLocSub}>{t('gps_precise')}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.currentLocationBtn}
                onPress={() => { setShowLocationModal(false); setShowMap(true); }}
              >
                <View style={styles.currentLocIcon}>
                  <Ionicons name="map" size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentLocTitle}>Pick on map</Text>
                  <Text style={styles.currentLocSub}>Drag the pin to your exact spot</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.modalSectionTitle}>{t('popular_cities')}</Text>
              <FlatList
                data={locations}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={[
                      styles.locationItem,
                      currentLocation?.id === item.id && styles.activeLocationItem
                    ]}
                    onPress={() => {
                      selectLocation(item);
                      persistCity(item.name);
                      setShowLocationModal(false);
                    }}
                  >
                    <Ionicons 
                      name="business-outline" 
                      size={20} 
                      color={currentLocation?.id === item.id ? COLORS.primary : COLORS.textSecondary} 
                    />
                    <Text style={[
                      styles.locationItemText,
                      currentLocation?.id === item.id && styles.activeLocationItemText
                    ]}>{item.name}</Text>
                    {currentLocation?.id === item.id && (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>

        <MapPickerModal
          visible={showMap}
          initialLat={savedCoords?.latitude}
          initialLng={savedCoords?.longitude}
          onClose={() => setShowMap(false)}
          onConfirm={handleMapConfirm}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const VitalCard = ({ label, value, unit, icon, tint, bgColor, onPress }) => (
  <TouchableOpacity style={styles.vitalCard} onPress={onPress} disabled={!onPress} activeOpacity={0.8}>
    <View style={[styles.vitalIconContainer, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={18} color={tint} />
    </View>
    <Text style={styles.vitalLabel}>{label}</Text>
    <Text style={styles.vitalValue}>
      {value}
      {unit ? <Text style={styles.vitalUnit}> {unit}</Text> : null}
    </Text>
  </TouchableOpacity>
);

const DoctorCard = ({ name, specialty, rating, distance, isBooked, onPress }) => {
  const { t } = useLanguage();
  return (
    <TouchableOpacity style={styles.fullWidthDoctorCard} onPress={onPress}>
      <View style={styles.doctorImgPlaceholder}>
        <Text style={styles.doctorInitials}>
          {name.split(' ').map(n => n[0]).slice(0, 2).join('')}
        </Text>
      </View>
      <View style={styles.docInfoCol}>
        <Text style={styles.docName}>{name}</Text>
        <Text style={styles.docSpec}>{[t(specialty.toLowerCase()), distance].filter(Boolean).join(' · ')}</Text>
        {rating ? (
          <View style={styles.docRatingRow}>
            <Ionicons name="star" size={12} color="#FFB800" />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        ) : null}
      </View>
      {isBooked ? (
        <View style={[styles.bookBtnSmall, styles.bookBtnBooked]}>
          <Ionicons name="checkmark-circle" size={11} color="#065f46" style={{ marginRight: 3 }} />
          <Text style={[styles.bookBtnTextSmall, styles.bookBtnTextBooked]}>Booked</Text>
        </View>
      ) : (
        <View style={styles.bookBtnSmall}>
          <Text style={styles.bookBtnTextSmall}>Book</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const HospitalCard = ({ name, type, rating, distance, onPress }) => {
  return (
    <TouchableOpacity style={styles.fullWidthDoctorCard} onPress={onPress}>
      <View style={[styles.doctorImgPlaceholder, { backgroundColor: '#FFF3E0' }]}>
        <MaterialCommunityIcons name="hospital-building" size={22} color="#b45309" />
      </View>
      <View style={styles.docInfoCol}>
        <Text style={styles.docName}>{name}</Text>
        {[type, distance].filter(Boolean).length > 0 && (
          <Text style={styles.docSpec}>{[type, distance].filter(Boolean).join(' · ')}</Text>
        )}
        {rating ? (
          <View style={styles.docRatingRow}>
            <Ionicons name="star" size={12} color="#FFB800" />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.bookBtnSmall}>
        <Text style={styles.bookBtnTextSmall}>View</Text>
      </View>
    </TouchableOpacity>
  );
};

