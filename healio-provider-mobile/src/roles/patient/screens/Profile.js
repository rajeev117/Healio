import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useHomeData } from '../controllers/HomeController';
import { useLanguage } from '../context/LanguageContext';
import { useWallet } from '../context/WalletContext';
import { signOut, supabase } from '../services/supabase';
import { useAuth as useShellAuth } from '../../../context/AuthContext';

function computeAge(isoDate) {
  if (!isoDate) return null;
  const [y, mo, d] = isoDate.split('-').map(Number);
  const dob = new Date(y, mo - 1, d);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

function formatDob(isoDate) {
  if (!isoDate) return '';
  const [y, mo, d] = isoDate.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function Profile({ navigation }) {
  const { t } = useLanguage();
  const { loading: homeLoading, user } = useHomeData();
  const { balance } = useWallet();
  const { logout: shellLogout } = useShellAuth();

  const [extras, setExtras] = useState(null);
  const [stats, setStats] = useState({ visits: 0, reports: 0, medicines: 0 });
  const [extrasLoading, setExtrasLoading] = useState(true);

  const loadExtras = useCallback(() => {
    async function fetchData() {
      // Don't show full-page spinner on re-focus, just silently refresh
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) { setExtrasLoading(false); return; }

        const [profileRes, visitRes, reportRes, rxRes] = await Promise.all([
          // Use * so the query works before AND after migration-029 is applied.
          // New columns (city, height, weight, emergency_contact) will just be
          // undefined until the migration runs — the UI handles null gracefully.
          supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle(),
          supabase
            .from('appointments')
            .select('id', { count: 'exact', head: true })
            .eq('patient_id', authUser.id)
            .eq('status', 'completed'),
          supabase
            .from('health_records')
            .select('id', { count: 'exact', head: true })
            .eq('patient_id', authUser.id),
          supabase
            .from('prescriptions')
            .select('id', { count: 'exact', head: true })
            .eq('patient_id', authUser.id),
        ]);

        setExtras(profileRes.data || null);
        setStats({
          visits: visitRes.count ?? 0,
          reports: reportRes.count ?? 0,
          medicines: rxRes.count ?? 0,
        });
      } catch (e) {
        console.warn('Profile extras load error:', e);
      } finally {
        setExtrasLoading(false);
      }
    }
    fetchData();
  }, []);

  useFocusEffect(loadExtras);

  const doLogout = () => {
    // Reset navigation BEFORE signing out: on the shared client signOut() can
    // hang, and awaiting it first left the user stranded on this screen. Clear
    // the shell auth so RoleRouter drops the patient module, then reset the ROOT
    // navigator (the shell AppStack owns 'Welcome'). signOut runs fire-and-forget.
    shellLogout();
    let root = navigation;
    while (root.getParent && root.getParent()) root = root.getParent();
    try { root.reset({ index: 0, routes: [{ name: 'Welcome' }] }); } catch (_) {}
    signOut().catch(() => {});
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      doLogout();
    } else {
      Alert.alert('Log out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  if ((homeLoading && !user) || extrasLoading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const userInitials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('')
    : 'U';
  const hasAccess = balance >= 50;

  const email = extras?.email || user?.email || '';
  const blood = extras?.blood_group || user?.bloodType || '';
  const gender = extras?.gender || user?.gender || '';
  const dob = extras?.date_of_birth || '';
  const age = computeAge(dob);
  const city = extras?.city || '';
  const allergies = Array.isArray(extras?.allergies) ? extras.allergies : [];
  const conditions = Array.isArray(extras?.conditions) ? extras.conditions : [];
  const height = extras?.height ? `${extras.height} cm` : '';
  const weight = extras?.weight ? `${extras.weight} kg` : '';
  const ecPhone = extras?.emergency_contact || '';
  const ecName = extras?.emergency_contact_name || '';
  const avatarUrl = extras?.avatar_url || null;

  const metaParts = [
    age ? `${age} yrs` : null,
    gender || null,
    blood ? `Blood group: ${blood}` : null,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerTitleContainer}>
        {navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitleText}>{t('my_profile')}</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Identity card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitials}>{userInitials}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.editBadge}
              onPress={() => navigation.navigate('PersonalInformation')}
            >
              <Ionicons name="pencil" size={14} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{user?.name || ''}</Text>
          {email ? <Text style={styles.userEmail}>{email}</Text> : null}
          {metaParts.length > 0 && (
            <Text style={styles.userMetaText}>{metaParts.join(' · ')}</Text>
          )}
        </View>

        {/* Plus Banner */}
        <View style={styles.premiumBannerSection}>
          <TouchableOpacity
            style={[styles.premiumCard, !hasAccess && { backgroundColor: COLORS.secondary }]}
            onPress={() => navigation.navigate('HealioPlusPayment', { userName: user?.name })}
          >
            <View style={[styles.premiumIconWrapper, !hasAccess && { backgroundColor: COLORS.primary }]}>
              <Ionicons name="trophy" size={20} color={hasAccess ? COLORS.primary : COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.premiumTitle, !hasAccess && { color: COLORS.primary }]}>
                {hasAccess ? 'Healio Plus • Active' : 'Upgrade to Healio Plus'}
              </Text>
              <Text style={[styles.premiumSubtitle, !hasAccess && { color: COLORS.textSecondary }]}>
                {hasAccess
                  ? `Wallet Balance: ₹${balance} • Booking Unlocked`
                  : `Wallet Balance: ₹${balance} • Deposit ₹50 to unlock bookings`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Appointments')}>
            <Text style={styles.statValue}>{stats.visits}</Text>
            <Text style={styles.statLabel}>Visits</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('ReportsHub')}>
            <Text style={styles.statValue}>{stats.reports}</Text>
            <Text style={styles.statLabel}>Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} onPress={() => navigation.navigate('Prescriptions')}>
            <Text style={styles.statValue}>{stats.medicines}</Text>
            <Text style={styles.statLabel}>Prescriptions</Text>
          </TouchableOpacity>
        </View>

        {/* Personal Details */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal details</Text>
          <TouchableOpacity onPress={() => navigation.navigate('PersonalInformation')}>
            <Text style={styles.sectionActionText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.cardContainer}>
          <DetailRow icon="person-outline" label="Full name" value={user?.name} />
          {dob ? (
            <DetailRow
              icon="calendar-outline"
              label="Date of birth"
              value={`${formatDob(dob)}${age ? ` · ${age} yrs` : ''}`}
            />
          ) : (
            <DetailRow icon="calendar-outline" label="Date of birth" value="Not set" />
          )}
          {blood ? <DetailRow icon="water-outline" label="Blood group" value={blood} /> : null}
          {height ? <DetailRow icon="resize-outline" label="Height" value={height} /> : null}
          {weight ? <DetailRow icon="fitness-outline" label="Weight" value={weight} /> : null}
        </View>

        {/* Contact Info */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Contact info</Text>
        </View>
        <View style={styles.cardContainer}>
          {user?.phone ? (
            <DetailRow icon="call-outline" label="Phone" value={user.phone} onPress={() => Alert.alert('Call', `Calling ${user.phone}`)} />
          ) : null}
          {email ? <DetailRow icon="mail-outline" label="Email" value={email} /> : null}
          {city ? <DetailRow icon="map-outline" label="City" value={city} /> : null}
        </View>

        {/* Allergies & Conditions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Allergies & conditions</Text>
        </View>
        <View style={[styles.cardContainer, { padding: 16 }]}>
          <ChipList
            icon="alert-circle-outline"
            label="Allergies"
            items={allergies}
            tone="destructive"
            emptyText="No allergies recorded"
          />
          <View style={{ height: 16 }} />
          <ChipList
            icon="heart-outline"
            label="Conditions"
            items={conditions}
            tone="primary"
            emptyText="No conditions recorded"
          />
        </View>

        {/* Emergency Contact */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Emergency contact</Text>
        </View>
        <View style={[styles.cardContainer, { padding: 16 }]}>
          {ecPhone ? (
            <View style={styles.emergencyRow}>
              <View style={styles.emergencyIconBg}>
                <Ionicons name="shield-outline" size={20} color="#dc3545" />
              </View>
              <View style={{ flex: 1 }}>
                {ecName ? <Text style={styles.emergencyName}>{ecName}</Text> : null}
                <Text style={styles.emergencySub}>{ecPhone}</Text>
              </View>
              <TouchableOpacity
                style={styles.emergencyCallBtn}
                onPress={() => Alert.alert('Call', `Calling emergency contact: ${ecPhone}`)}
              >
                <Text style={styles.emergencyCallText}>Call</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addEmergencyBtn}
              onPress={() => navigation.navigate('PersonalInformation')}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addEmergencyText}>Add emergency contact</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Account */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Account</Text>
        </View>
        <View style={styles.cardContainer}>
          <DetailRow icon="people-outline" label="Switch profile" onPress={() => navigation.navigate('ProfileSelector')} chevron />
          <DetailRow icon="folder-outline" label="Health records" onPress={() => navigation.navigate('Records')} chevron />
          <DetailRow icon="cube-outline" label="My orders" onPress={() => navigation.navigate('Orders')} chevron />
          <DetailRow icon="document-text-outline" label="My complaints & refunds" onPress={() => navigation.navigate('MyRequests')} chevron />
          <DetailRow icon="notifications-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} chevron />
          <DetailRow icon="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} chevron />
          <DetailRow icon="help-circle-outline" label="Help & support" value="care@healio.app" onPress={() => Alert.alert('Support', 'Email: care@healio.app')} chevron />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>App Version 1.2.0 • Build 42</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const DetailRow = ({ icon, label, value, onPress, chevron }) => {
  const RowComponent = onPress ? TouchableOpacity : View;
  return (
    <RowComponent onPress={onPress} style={styles.row}>
      <View style={styles.rowIconBg}>
        <Ionicons name={icon} size={16} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {onPress && chevron && <Ionicons name="chevron-forward" size={16} color={COLORS.border} />}
    </RowComponent>
  );
};

const ChipList = ({ icon, label, items, tone, emptyText }) => {
  let tagBg = '#f1f3f5';
  let tagColor = COLORS.text;
  if (tone === 'destructive') { tagBg = '#FFE5E5'; tagColor = '#FF3B30'; }
  else if (tone === 'primary') { tagBg = COLORS.secondary; tagColor = COLORS.primary; }

  return (
    <View>
      <View style={styles.chipHeader}>
        <Ionicons name={icon} size={14} color={COLORS.textSecondary} style={{ marginRight: 6 }} />
        <Text style={styles.chipTitle}>{label}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyChipText}>{emptyText}</Text>
      ) : (
        <View style={styles.chipsContainer}>
          {items.map((item, i) => (
            <View key={i} style={[styles.chip, { backgroundColor: tagBg }]}>
              <Text style={[styles.chipText, { color: tagColor }]}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  headerTitleContainer: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { marginRight: 15 },
  headerTitleText: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  container: { flex: 1, backgroundColor: COLORS.surface },

  profileCard: {
    backgroundColor: COLORS.white, padding: SPACING.xl,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  avatarWrapper: {
    width: 80, height: 80, marginBottom: SPACING.m,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 80, height: 80 },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  editBadge: {
    position: 'absolute', right: -2, bottom: -2,
    backgroundColor: COLORS.primary, padding: 6, borderRadius: 15,
    borderWidth: 2, borderColor: COLORS.white,
  },
  userName: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  userEmail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  userMetaText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontWeight: '500' },

  premiumBannerSection: { paddingHorizontal: 20, marginTop: 16 },
  premiumCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderWidth: 1, borderColor: COLORS.primary + '30',
    borderRadius: 20, padding: 14,
  },
  premiumIconWrapper: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  premiumTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  premiumSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingVertical: 12,
    alignItems: 'center', marginHorizontal: 4,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2, fontWeight: '500' },

  sectionHeader: {
    marginTop: 24, marginBottom: 8, paddingHorizontal: 24,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  sectionActionText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  cardContainer: {
    backgroundColor: COLORS.white, borderRadius: 20,
    marginHorizontal: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  rowIconBg: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  rowValue: { fontSize: 14, color: COLORS.text, fontWeight: '600', marginTop: 2 },

  chipHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  chipTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  chipText: { fontSize: 12, fontWeight: '700' },
  emptyChipText: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic' },

  emergencyRow: { flexDirection: 'row', alignItems: 'center' },
  emergencyIconBg: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  emergencyName: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  emergencySub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  emergencyCallBtn: {
    backgroundColor: '#dc3545', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
  },
  emergencyCallText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  addEmergencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4,
  },
  addEmergencyText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.xl, padding: SPACING.m,
    backgroundColor: COLORS.white, marginHorizontal: SPACING.xl,
    borderRadius: 20, borderWidth: 1, borderColor: '#FF3B3030', gap: 8,
  },
  logoutText: { color: '#FF3B30', fontWeight: '700', fontSize: 15 },
  version: {
    textAlign: 'center', color: COLORS.textSecondary,
    fontSize: 12, marginTop: SPACING.l, marginBottom: SPACING.xl,
  },
});
