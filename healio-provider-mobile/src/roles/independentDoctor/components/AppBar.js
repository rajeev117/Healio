// Compact maroon header for pushed screens. Carries the module's asymmetric
// bottom radius (14 left / 44 right) and the single ghost ring, so a sub-screen
// still reads as "independent" rather than hospital-affiliated.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../constants/theme';

export default function AppBar({ title, subtitle, actionLabel, onAction, onBack }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.ring} pointerEvents="none" />
      <View style={styles.row}>
        <TouchableOpacity style={styles.back} onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
        {!!actionLabel && (
          <TouchableOpacity style={styles.action} onPress={onAction}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.headerRadiusLeft,
    borderBottomRightRadius: SIZES.appBarRadiusRight,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute', top: -92, right: -60,
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 28, borderColor: 'rgba(255,255,255,0.08)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.13)', justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 19, fontWeight: '800', color: COLORS.white, letterSpacing: -0.3 },
  subtitle: { fontSize: 11.5, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  action: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 8 },
  actionText: { fontSize: 12, fontWeight: '700', color: COLORS.white },
});
