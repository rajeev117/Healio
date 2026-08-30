// ─────────────────────────────────────────────────────────────────────────────
// ProviderAvatar — the default picture for a doctor, hospital, lab or pharmacy.
//
// Replaces the generic grey silhouette (`Ionicons name="person"`) that stood in
// for every provider. A silhouette reads as "missing image"; these read as
// deliberate:
//
//   people (doctors)    → their initials on a tinted disc, the convention every
//                         contacts / directory app uses when there's no photo
//   places (hospital,   → the domain glyph for what they are, so a hospital and
//   lab, pharmacy)        a lab are told apart at a glance
//
// A real photo, when one exists, always wins — pass `uri`.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

// Category → glyph + colour. Keys match the Services screen's category ids so
// a provider looks the same in the grid, the list and on its detail screen.
const KINDS = {
  Doctors:     { icon: 'stethoscope',       tint: '#E3F2FD', color: '#1565c0', initials: true },
  Hospitals:   { icon: 'hospital-building', tint: '#FFF3E0', color: '#b45309' },
  Labs:        { icon: 'test-tube',         tint: '#F3E5F5', color: '#7b2d8e' },
  Medicine:    { icon: 'pill',              tint: '#E8F5E9', color: '#1b7a3d' },
  'Home Care': { icon: 'home-heart',        tint: '#E0F2F1', color: '#0f766e' },
  Emergency:   { icon: 'alarm-light',       tint: '#FFEBEE', color: '#dc2626' },
  Ambulance:   { icon: 'ambulance',         tint: '#EFEBE9', color: '#5d4037' },
  Insurance:   { icon: 'shield-check',      tint: '#F1F8E9', color: '#558b2f' },
};

const FALLBACK = { icon: 'medical-bag', tint: COLORS.secondary, color: COLORS.primary };

/** "Dr Anita Rao" → "AR"; titles are stripped so they don't eat both letters. */
export function providerInitials(name = '') {
  // `|| ''` not just the default param: a null name (a provider row with none)
  // would otherwise stringify to "null" and initial as "NU".
  const words = String(name || '')
    // Trim BEFORE stripping the title — the pattern is ^-anchored, so leading
    // whitespace would otherwise leave "Dr" in and yield "DK" for "Dr R Kumar".
    .trim()
    .replace(/^(dr|doctor|prof|mr|mrs|ms)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function ProviderAvatar({ kind = 'Doctors', name, uri, size = 56, style }) {
  const cfg = KINDS[kind] || FALLBACK;
  const shape = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  if (uri) {
    return <Image source={{ uri }} style={[styles.base, shape, style]} />;
  }

  return (
    <View style={[styles.base, shape, { backgroundColor: cfg.tint }, style]}>
      {cfg.initials && name ? (
        <Text style={[styles.initials, { color: cfg.color, fontSize: size * 0.36 }]}>
          {providerInitials(name)}
        </Text>
      ) : (
        <MaterialCommunityIcons name={cfg.icon} size={size * 0.5} color={cfg.color} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initials: { fontWeight: '800', letterSpacing: 0.5 },
});
