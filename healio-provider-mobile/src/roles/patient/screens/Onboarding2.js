import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { CustomButton } from '../components/CustomButton';
import { Ionicons } from '@expo/vector-icons';

export default function Onboarding2({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      {/* Top Row: Skip */}
      <View style={styles.topRow}>
        <View />
        <TouchableOpacity onPress={() => navigation.navigate('LanguageSelect')}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.imageContainer}>
        <View style={styles.iconWrapper}>
          <Ionicons name="calendar-outline" size={56} color={COLORS.primary} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Book in seconds</Text>
        <Text style={styles.subtitle}>
          Find trusted doctors and hospitals near you. Schedule visits instantly.
        </Text>
      </View>

      {/* Progress Dots */}
      <View style={styles.dotsRow}>
        <View style={styles.dot} />
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.nextBtn} 
          onPress={() => navigation.navigate('Onboarding3')}
        >
          <Text style={styles.nextBtnText}>Next</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
  },
  skipText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  imageContainer: { flex: 2, justifyContent: 'center', alignItems: 'center' },
  iconWrapper: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  content: { flex: 1, paddingHorizontal: SPACING.l, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m, textAlign: 'center' },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: '80%' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.m },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  footer: { padding: SPACING.l },
  nextBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 6px rgba(130, 28, 3, 0.2)',
      },
      default: {
        elevation: 3,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
    }),
  },
  nextBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
    marginRight: 6,
  },
});
