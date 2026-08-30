import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../../../context/AuthContext';
import { signOut } from '../../../lib/supabase';
import { fetchOrgInfo } from '../services/api';

export default function Profile({ navigation }) {
  const { user, logout } = useAuth();
  const { hospitalId, hospitalName, name: staffName, staffId } = user || {};
  const [org, setOrg]       = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    fetchOrgInfo(hospitalId)
      .then(setOrg)
      .catch(e => console.warn('Lab Profile error:', e.message))
      .finally(() => setLoading(false));
  }, [hospitalId]));

  const doLogout = async () => {
    try { await signOut(); } catch (_) {}
    logout();
    const rootNav = navigation.getParent() ?? navigation;
    rootNav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') { doLogout(); return; }
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: doLogout },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="flask" size={30} color={COLORS.white} />
          </View>
          <Text style={styles.name}>{org?.name || hospitalName}</Text>
          <Text style={styles.specialty}>{org?.city || ''}</Text>
          <Text style={styles.hospital}>Lab Technician · {staffName}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Staff Info</Text>
          {staffName && <InfoRow icon="person-outline"     label="Name"     value={staffName} />}
          {staffId   && <InfoRow icon="id-card-outline"   label="Staff ID" value={staffId} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lab Info</Text>
          {org?.name        && <InfoRow icon="business-outline"  label="Name"    value={org.name} />}
          {org?.city        && <InfoRow icon="location-outline"  label="City"    value={org.city} />}
          {org?.address     && <InfoRow icon="map-outline"       label="Address" value={org.address} />}
          {org?.admin_phone && <InfoRow icon="call-outline"      label="Phone"   value={org.admin_phone} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Settings</Text>
          <MenuItem icon="qr-code-outline"       label="My QR Code"               onPress={() => navigation.navigate('LabQR')} />
          <MenuItem icon="wallet-outline"        label="Earnings"                 onPress={() => navigation.navigate('Earnings')} />
          <MenuItem icon="notifications-outline" label="Notification Preferences" onPress={() => {}} />
          <MenuItem icon="help-circle-outline"   label="Help & Support"           onPress={() => {}} />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}><Ionicons name={icon} size={16} color={COLORS.primary} /></View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const MenuItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <View style={styles.menuIcon}><Ionicons name={icon} size={18} color={COLORS.primary} /></View>
    <Text style={styles.menuLabel}>{label}</Text>
    <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    backgroundColor: COLORS.primary, borderBottomLeftRadius: SIZES.header, borderBottomRightRadius: SIZES.header,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, alignItems: 'center',
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  specialty: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '600' },
  hospital: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  card: { backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginHorizontal: 20, marginBottom: 12, marginTop: 16, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.hairline, gap: 10 },
  infoIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  infoLabel: { width: 80, fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  infoValue: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'right' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.hairline, gap: 12 },
  menuIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.dangerSoft, borderRadius: SIZES.radius, padding: 16,
    marginHorizontal: 20, marginBottom: 12, gap: 10, borderWidth: 1, borderColor: '#FEB2B2',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: COLORS.error },
});
