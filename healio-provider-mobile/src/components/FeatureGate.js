// ─────────────────────────────────────────────────────────────────────────────
// FeatureGate — route-level enforcement of the admin panel's feature switches.
//
// Gating the BUTTONS that lead to a screen would mean finding every entry point
// (some screens are reached from three or four places, and new ones get added),
// and missing one leaves a live path into a feature that is supposed to be off.
// Gating the ROUTE instead covers every entry point at once, including ones
// added later.
//
// The route stays registered, so navigating to a disabled screen is safe — the
// user gets an explanation instead of a crash. That matters because several of
// these are reached programmatically (deep links, QR scans, alert taps), not
// only from a button we could have hidden.
//
// Defaults OPEN: usePlatformConfig().isEnabled() returns true for a key it
// doesn't recognise, so an app running against a database where the feature
// rows don't exist yet behaves exactly as it did before.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { usePlatformConfig } from '../context/PlatformConfigContext';

/** Is this feature switched on? Defaults to true for unknown keys. */
export function useFeatureEnabled(key) {
  const { isEnabled } = usePlatformConfig();
  return isEnabled(key);
}

/** Shown in place of a screen whose feature has been switched off. */
export function FeatureDisabled({ navigation, label }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed-outline" size={28} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.title}>{label || 'Not available'}</Text>
        <Text style={styles.subtitle}>
          This feature has been turned off for your account by Healio.
          {'\n'}Contact support if you need it enabled.
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation?.goBack()}>
          <Text style={styles.btnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/**
 * Wrap a screen component so it only renders while its feature is on.
 *
 * @param {string} key       feature key, e.g. 'lab_test_catalog'
 * @param {React.ComponentType} Component  the real screen
 * @param {string} [label]   friendly name for the disabled state
 */
export function withFeature(key, Component, label) {
  function Gated(props) {
    const enabled = useFeatureEnabled(key);
    if (!enabled) return <FeatureDisabled navigation={props.navigation} label={label} />;
    return <Component {...props} />;
  }
  Gated.displayName = `withFeature(${key})`;
  return Gated;
}

/**
 * Tab options that hide a tab from the bar when its feature is off.
 *
 * The screen stays registered rather than being removed from the navigator:
 * React Navigation throws if anything navigates to a route that no longer
 * exists, and Home screens in several roles jump straight to sibling tabs.
 * This is the same idiom App.js already uses to keep 'Appointments' off the
 * hospital tab bar.
 */
export function hiddenTabOptions(enabled) {
  return enabled ? {} : { tabBarButton: () => null, tabBarItemStyle: { display: 'none' } };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background ?? '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 22, marginBottom: 16,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  subtitle: {
    fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center',
    marginTop: 8, lineHeight: 20,
  },
  btn: {
    marginTop: 24, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 14, backgroundColor: COLORS.primary,
  },
  btnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});
