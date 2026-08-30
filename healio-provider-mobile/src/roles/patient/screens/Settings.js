import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { supabase, signOut } from '../services/supabase';
import { useActiveProfile } from '../context/ActiveProfileContext';
import { useAuth as useShellAuth } from '../../../context/AuthContext';

// Default preferences — used when DB has nothing yet
const DEFAULT_PREFS = {
  appointment_reminders: true,
  medicine_reminders:    true,
  emergency_alerts:      true,
  location_sharing:      false,
  biometric_lock:        false,
};

export default function Settings({ navigation }) {
  const { profile: activeProfile } = useActiveProfile();
  const { logout: shellLogout } = useShellAuth();
  const [prefs,   setPrefs]   = useState(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);   // key currently being saved

  // ── Load from DB ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles').select('preferences').eq('id', user.id).maybeSingle();
      if (data?.preferences) {
        setPrefs(prev => ({ ...prev, ...data.preferences }));
      }
    } catch (e) { /* keep defaults */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Persist a single toggle change immediately ─────────────────────────────
  const updatePref = async (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('profiles').update({ preferences: next }).eq('id', user.id);
    } catch (e) {
      // revert on failure
      setPrefs(prefs);
      Alert.alert('Could not save', 'Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────────────────
  const doLogout = () => {
    // Reset navigation BEFORE signing out (signOut() can hang on the shared
    // client). Clear shell auth, then reset the ROOT navigator (shell AppStack
    // owns 'Welcome'); signOut runs fire-and-forget.
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSub}>Keep care preferences in one place</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <SectionCard title="Account">
          <ActionRow
            icon="swap-horizontal-outline"
            label="Switch profile"
            value={activeProfile?.type === 'family' ? activeProfile.name : 'Me'}
            onPress={() => navigation.navigate('ProfileSelector')}
          />
          <ActionRow icon="person-outline"   label="Personal information" onPress={() => navigation.navigate('PersonalInformation')} />
          <ActionRow icon="people-outline"   label="Family profiles"      onPress={() => navigation.navigate('FamilyProfiles')} />
          <ActionRow icon="location-outline" label="Manage addresses"     onPress={() => navigation.navigate('ManageAddresses')} />
          <ActionRow icon="language-outline" label="Language" value="English" onPress={() => navigation.navigate('LanguageSelect')} />
        </SectionCard>

        {/* Notifications — toggles persist to DB */}
        <SectionCard title="Notifications">
          <ToggleRow
            icon="calendar-outline"
            label="Appointment reminders"
            value={prefs.appointment_reminders}
            saving={saving === 'appointment_reminders'}
            onValueChange={(v) => updatePref('appointment_reminders', v)}
          />
          <ToggleRow
            icon="medkit-outline"
            label="Medicine reminders"
            value={prefs.medicine_reminders}
            saving={saving === 'medicine_reminders'}
            onValueChange={(v) => updatePref('medicine_reminders', v)}
          />
          <ToggleRow
            icon="alert-circle-outline"
            label="Emergency alerts"
            value={prefs.emergency_alerts}
            saving={saving === 'emergency_alerts'}
            onValueChange={(v) => updatePref('emergency_alerts', v)}
          />
          <ToggleRow
            icon="navigate-outline"
            label="Location sharing"
            value={prefs.location_sharing}
            saving={saving === 'location_sharing'}
            onValueChange={(v) => updatePref('location_sharing', v)}
          />
        </SectionCard>

        {/* Security */}
        <SectionCard title="Security & privacy">
          <ToggleRow
            icon="lock-closed-outline"
            label="Biometric lock"
            value={prefs.biometric_lock}
            saving={saving === 'biometric_lock'}
            onValueChange={(v) => updatePref('biometric_lock', v)}
          />
          <ActionRow icon="notifications-outline" label="Notification center" onPress={() => navigation.navigate('Notifications')} />
          <ActionRow icon="card-outline"          label="Payments & records"   onPress={() => navigation.navigate('Records', { category: 'Payments' })} />
        </SectionCard>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const SectionCard = ({ title, children }) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const ActionRow = ({ icon, label, value, onPress }) => (
  <TouchableOpacity style={styles.row} onPress={onPress}>
    <View style={styles.rowIconBg}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={16} color={COLORS.border} />
  </TouchableOpacity>
);

const ToggleRow = ({ icon, label, value, saving, onValueChange }) => (
  <View style={styles.row}>
    <View style={styles.rowIconBg}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    {saving
      ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 4 }} />
      : <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#ddd', true: COLORS.primary }}
          thumbColor={COLORS.white}
        />}
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.m,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  headerSub:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  content: { padding: SPACING.m, paddingBottom: SPACING.xl },
  sectionCard: {
    backgroundColor: COLORS.white, borderRadius: 24,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.m, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 14, fontWeight: '900', color: COLORS.text,
    padding: SPACING.m, paddingBottom: 4, textTransform: 'uppercase', letterSpacing: 1,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.m, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#F1F3F5',
  },
  rowIconBg: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.secondary, justifyContent: 'center', alignItems: 'center' },
  rowLabel:  { fontSize: 14, color: COLORS.text, fontWeight: '700' },
  rowValue:  { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 18, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: '#FF3B3030', marginTop: SPACING.s,
  },
  logoutText: { color: '#FF3B30', fontWeight: '800' },
});
