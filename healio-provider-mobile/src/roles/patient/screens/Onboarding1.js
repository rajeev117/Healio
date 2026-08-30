import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Dimensions, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'pulse',
    title: 'Your health, simplified',
    subtitle: 'Track vitals, manage prescriptions, and stay on top of your wellness — all in one place.',
  },
  {
    icon: 'calendar-outline',
    title: 'Book in seconds',
    subtitle: 'Find trusted doctors and hospitals near you. Schedule visits instantly.',
  },
  {
    icon: 'folder-open-outline',
    title: 'Records that travel',
    subtitle: 'Medical, medicine, lab and payment records — securely accessible anywhere.',
  },
];

export default function Onboarding1({ navigation }) {
  const [page, setPage] = useState(0);
  const slideX = useRef(new Animated.Value(0)).current;
  const dotWidths = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 24 : 6))).current;

  const goTo = (next) => {
    if (next >= SLIDES.length) {
      navigation.navigate('LanguageSelect');
      return;
    }
    Animated.timing(slideX, {
      toValue: -next * SCREEN_W,
      duration: 320,
      useNativeDriver: true,
    }).start();
    dotWidths.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i === next ? 24 : 6,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    setPage(next);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip */}
      <View style={styles.topRow}>
        <View />
        <TouchableOpacity onPress={() => navigation.navigate('LanguageSelect')}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides (clip to visible area) */}
      <View style={styles.slidesWrapper}>
        <Animated.View
          style={[
            styles.slidesTrack,
            { width: SCREEN_W * SLIDES.length, transform: [{ translateX: slideX }] },
          ]}
        >
          {SLIDES.map((slide, i) => (
            <View key={i} style={[styles.slide, { width: SCREEN_W }]}>
              <View style={styles.iconWrapper}>
                <Ionicons name={slide.icon} size={56} color={COLORS.primary} />
              </View>
              <View style={styles.content}>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Animated pill dots */}
      <View style={styles.dotsRow}>
        {dotWidths.map((animWidth, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { width: animWidth },
              page === i ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* Next / Get Started */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={() => goTo(page + 1)}>
          <Text style={styles.nextBtnText}>
            {page === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          </Text>
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

  slidesWrapper: { flex: 1, overflow: 'hidden' },
  slidesTrack: { flexDirection: 'row', flex: 1 },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
  },

  iconWrapper: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    ...Platform.select({
      web: { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' },
      default: {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
    }),
  },
  content: { alignItems: 'center' },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SPACING.m,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: '85%',
  },

  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.m,
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: { backgroundColor: COLORS.primary },
  dotInactive: { backgroundColor: COLORS.border },

  footer: { padding: SPACING.l },
  nextBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Platform.select({
      web: { boxShadow: '0px 4px 6px rgba(130,28,3,0.2)' },
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
  },
});
