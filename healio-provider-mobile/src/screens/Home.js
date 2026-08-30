import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StatusBar, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, CATEGORY } from '../constants/theme';
import { useStore } from '../lib/store';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Logo } from '../components/Logo';
import { Alert } from 'react-native';
import { getGreeting } from '../utils/greeting';
import styles from './Home.styles';

// Chip colour comes from CATEGORY by position - fixed order, never cycled.
const quickActions = [
  { to: "Doctors", labelKey: "hosp_qa_doctors", icon: "medkit-outline" },
  { to: "Patients", labelKey: "hosp_qa_patients", icon: "people-outline" },
  { to: "Operations", labelKey: "hosp_qa_pharmacy", icon: "bag-handle-outline", tabIndex: 0 },
  { to: "Operations", labelKey: "hosp_qa_labs", icon: "flask-outline", tabIndex: 1 },
  { to: "Operations", labelKey: "hosp_qa_homecare", icon: "home-outline", tabIndex: 2 },
  { to: "Operations", labelKey: "hosp_qa_admissions", icon: "bed-outline", tabIndex: 4 },
  { to: "StaffManagement", labelKey: "hosp_qa_staff", icon: "id-card-outline" },
  { to: "HospitalQR", labelKey: "hosp_qa_myqr", icon: "qr-code-outline" },
].map((a, i) => ({ ...a, color: CATEGORY[i].chip, iconColor: CATEGORY[i].ink }));

// Consultation journey status (from the store) → translation key.
const HOME_STATUS_KEYS = { arrived: 'hosp_status_arrived', examining: 'hosp_status_examining', completed: 'status_completed' };

export default function Home({ navigation }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const doctorsCount = useStore(state => state.doctors.length);
  const activePharmacyCount = useStore(state => state.pharmacy.filter(p => p.status === 'Pending').length);
  const businessProfile = useStore(state => state.businessProfile);
  const homeToday = useStore(state => state.homeToday);
  const homeTrend = useStore(state => state.homeTrend);
  const homeAppointments = useStore(state => state.homeAppointments);
  const pendingAdmits = useStore(state => state.pendingAdmits);
  const loadHomeDashboard = useStore(state => state.loadHomeDashboard);

  useFocusEffect(
    React.useCallback(() => { loadHomeDashboard(); }, [loadHomeDashboard])
  );

  const trend = (homeTrend && homeTrend.length) ? homeTrend : [0, 0, 0, 0, 0, 0, 1];
  const earningsMax = Math.max(...trend, 1);
  // Real day-over-day trend (yesterday vs today from the 7-day window)
  const prevDay = trend[5] || 0;
  const currDay = trend[6] || 0;
  const trendPct = prevDay > 0
    ? Math.round(((currDay - prevDay) / prevDay) * 100)
    : (currDay > 0 ? 100 : 0);
  // A percentage needs a baseline: with no prior day there is nothing to
  // compare against, and the old fallback claimed a flat +100%.
  const hasTrendData = prevDay > 0;
  const trendPositive = trendPct >= 0;
  const todayRevenueLabel = `₹${Number(homeToday || 0).toLocaleString('en-IN')}`;
  const profileName = user?.hospitalName || businessProfile.name || 'Hospital';
  const profileCity = user?.hospitalCity || businessProfile.city || '';
  const profileDepartments = businessProfile.departments?.length ?? 0;
  const profileBeds = businessProfile.beds ? `${businessProfile.beds}` : '—';
  const profileLogoUri = businessProfile.logoUri;
  // Colour is reserved for state, not decoration: a card only warms up when its
  // number actually wants attention. Everything else sits neutral so the one
  // that matters is the one you see.
  // t() does plain {var} substitution with no plural rules, so the call site
  // picks the key.
  const pharmacyWaitingLabel = activePharmacyCount === 1
    ? t('hosp_pharmacy_waiting_one')
    : t('hosp_pharmacy_waiting', { count: activePharmacyCount });

  const overviewCards = [
    {
      label: t('hosp_ov_doctors'), value: doctorsCount, sublabel: t('hosp_ov_doctors_sub'),
      icon: 'medkit-outline', to: 'Doctors',
    },
    {
      label: t('hosp_ov_pending_pharmacy'), value: activePharmacyCount, sublabel: t('hosp_ov_pending_pharmacy_sub'),
      icon: 'bag-handle-outline', to: 'Operations', tabIndex: 0, alert: activePharmacyCount > 0,
    },
    {
      label: t('hosp_ov_departments'), value: profileDepartments, sublabel: t('hosp_ov_departments_sub'),
      icon: 'business-outline', to: 'Profile',
    },
    {
      label: t('hosp_ov_beds'), value: profileBeds, sublabel: t('hosp_ov_beds_sub'),
      icon: 'bed-outline', to: 'Operations', tabIndex: 4,
    },
  ];

  const handleQuickAction = (action) => {
    if (action.to === 'Operations' && action.tabIndex !== undefined) {
      navigation.navigate('Operations', { initialTab: action.tabIndex });
    } else {
      navigation.navigate(action.to);
    }
  };

  // Consultation journey: Arrived (checked in) → Examining (with the doctor) → Completed.
  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed':
        return { backgroundColor: COLORS.tintGreen };
      case 'examining':
        return { backgroundColor: COLORS.tintGold };
      case 'arrived':
        return { backgroundColor: COLORS.tintBlue };
      default:
        return { backgroundColor: COLORS.surface };
    }
  };

  const getStatusTextStyle = (status) => {
    switch (status) {
      case 'completed':
        return { color: COLORS.tintGreenInk };
      case 'examining':
        return { color: COLORS.tintGoldInk };
      case 'arrived':
        return { color: COLORS.tintBlueInk };
      default:
        return { color: COLORS.textSecondary };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.bgBlobOne} />
      <View style={styles.bgBlobTwo} />
      <ScrollView style={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Brand Header & Hero Area */}
        <View style={styles.heroCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerBrandRow}>
              <View style={styles.logoBubble}>
                {profileLogoUri ? (
                  <Image source={{ uri: profileLogoUri }} style={styles.logoImage} />
                ) : (
                  <Logo size={44} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.welcomeText}>{getGreeting(t)}</Text>
                <Text style={styles.hospitalName} numberOfLines={1}>{profileName}</Text>
                <View style={styles.hospitalIdRow}>
                  <Ionicons name="location-sharp" size={11} color="rgba(255, 255, 255, 0.7)" />
                  <Text style={styles.hospitalId}>{profileCity}</Text>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.bellBtn}
                onPress={() => navigation.navigate('Notifications')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={t('hosp_notifications_a11y')}
              >
                <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
                <View style={styles.bellDot} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Premium Earnings Card */}
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <View>
                <Text style={styles.earningsLabel}>{t('hosp_todays_revenue')}</Text>
                <Text style={styles.earningsValue}>{todayRevenueLabel}</Text>
              </View>
              {hasTrendData && (
                <View style={[styles.trendingBadge, !trendPositive && { backgroundColor: COLORS.tintRose }]}>
                  <Ionicons
                    name={trendPositive ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={trendPositive ? COLORS.tintGreenInk : COLORS.tintRoseInk}
                    style={{ marginRight: 3 }}
                  />
                  <Text style={[styles.trendingText, !trendPositive && { color: COLORS.tintRoseInk }]}>
                    {trendPositive ? '+' : ''}{trendPct}%
                  </Text>
                </View>
              )}
            </View>

            {/* Sparkline trend representation */}
            <View style={styles.sparklineContainer}>
              {trend.map((val, i) => {
                // Keep a visible stub on zero-revenue days so the 7-day rhythm reads.
                const heightPercent = Math.max((val / earningsMax) * 100, 8);
                return (
                  <View key={i} style={styles.sparkBarWrapper}>
                    <View style={[styles.sparkBar, { height: `${heightPercent}%` }, val === 0 && styles.sparkBarEmpty]} />
                  </View>
                );
              })}
            </View>
            <View style={styles.sparkBaseline} />
            <View style={styles.sparkMetaRow}>
              <Text style={styles.sparkMetaText}>{t('hosp_last_7_days')}</Text>
              <Text style={styles.sparkMetaText}>{t('hosp_today')}</Text>
            </View>
          </View>
        </View>

        {/* Today's Appointments */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('hosp_todays_consultations')}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Appointments')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('hosp_view_all')}
            >
              <Text style={styles.viewAllLink}>{t('hosp_view_all')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.appointmentList}>
            {homeAppointments.length === 0 ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBox}>
                  <Ionicons name="calendar-clear-outline" size={20} color={COLORS.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.emptyTitle}>{t('hosp_no_consultations')}</Text>
                  <Text style={styles.emptySub}>{t('hosp_new_bookings_hint')}</Text>
                </View>
              </View>
            ) : homeAppointments.map((a) => {
              // Split on any whitespace — toLocaleTimeString often puts a narrow
              // no-break space (U+202F) before am/pm, which a plain ' ' split misses.
              const [hourPart, ...rest] = (a.time || '').trim().split(/\s+/);
              return (
                <TouchableOpacity
                  key={a.id}
                  style={styles.appointmentItem}
                  onPress={() => navigation.navigate('Appointments')}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.time}, ${a.patient}, ${a.doctor}, ${a.type}`}
                >
                  <View style={styles.timeBadge}>
                    <Text style={styles.timeHour}>{hourPart}</Text>
                    {rest.length > 0 ? <Text style={styles.timeSub}>{rest.join(' ')}</Text> : null}
                  </View>
                  <View style={styles.appointmentDetails}>
                    <Text style={styles.patientName}>{a.patient}</Text>
                    <Text style={styles.doctorName}>{a.doctor} · {a.type}</Text>
                  </View>
                  <View style={[styles.statusPill, getStatusStyle(a.status)]}>
                    <Text style={[styles.statusText, getStatusTextStyle(a.status)]}>
                      {HOME_STATUS_KEYS[a.status] ? t(HOME_STATUS_KEYS[a.status]) : a.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Quick Actions Matrix */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>{t('hosp_quick_actions')}</Text>
          <View style={styles.grid}>
            {quickActions.map((action, i) => {
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.gridItem}
                  onPress={() => handleQuickAction(action)}
                  accessibilityRole="button"
                  accessibilityLabel={t(action.labelKey)}
                >
                  <View style={[styles.iconBox, { backgroundColor: action.color }]}>
                    <Ionicons name={action.icon} size={22} color={action.iconColor} />
                  </View>
                  <Text style={styles.gridLabel}>{t(action.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* At a glance */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('hosp_at_a_glance')}</Text>
            <Text style={styles.sectionCaption}>{t('hosp_live_metrics')}</Text>
          </View>
          <View style={styles.overviewGrid}>
            {overviewCards.map((card) => (
              <TouchableOpacity
                key={card.label}
                style={[styles.overviewCard, card.alert && styles.overviewCardAlert]}
                onPress={() => handleQuickAction(card)}
                accessibilityRole="button"
                accessibilityLabel={`${card.value} ${card.label}, ${card.sublabel}`}
              >
                <View style={styles.overviewCardTop}>
                  <View style={[styles.overviewIcon, card.alert && styles.overviewIconAlert]}>
                    <Ionicons
                      name={card.icon}
                      size={17}
                      color={card.alert ? COLORS.primary : COLORS.textSecondary}
                    />
                  </View>
                  <Text style={styles.overviewValue} numberOfLines={1}>{card.value}</Text>
                </View>
                <Text style={styles.overviewLabel}>{card.label}</Text>
                <Text style={styles.overviewSubLabel}>{card.sublabel}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Needs attention ──────────────────────────────────────────────
            Only rendered when something actually wants the admin, so the section
            disappears entirely on a clear day rather than showing empty rows. */}
        {(pendingAdmits > 0 || activePharmacyCount > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('hosp_needs_attention')}</Text>
            <View style={styles.attentionList}>
              {pendingAdmits > 0 && (
                <TouchableOpacity
                  style={styles.attentionRow}
                  onPress={() => navigation.navigate('Operations', { initialTab: 2 })}
                  accessibilityRole="button"
                  accessibilityLabel={t('hosp_homecare_pending', { count: pendingAdmits })}
                >
                  <View style={styles.attentionIcon}>
                    <Ionicons name="alert-circle-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionTitle}>
                      {t('hosp_homecare_pending', { count: pendingAdmits })}
                    </Text>
                    <Text style={styles.attentionSub}>{t('hosp_homecare_pending_sub')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.borderStrong} />
                </TouchableOpacity>
              )}
              {activePharmacyCount > 0 && (
                <TouchableOpacity
                  style={styles.attentionRow}
                  onPress={() => navigation.navigate('Operations', { initialTab: 0 })}
                  accessibilityRole="button"
                  accessibilityLabel={pharmacyWaitingLabel}
                >
                  <View style={styles.attentionIcon}>
                    <Ionicons name="bag-handle-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attentionTitle}>{pharmacyWaitingLabel}</Text>
                    <Text style={styles.attentionSub}>{t('hosp_pharmacy_waiting_sub')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.borderStrong} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={{ height: 35 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

