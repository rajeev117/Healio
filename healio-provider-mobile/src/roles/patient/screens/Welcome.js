import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Logo } from '../components/Logo';
import { useLanguage } from '../context/LanguageContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function Welcome({ navigation }) {
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.container}>
      {/* Top-right language button */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.langBtn}
          onPress={() => navigation.navigate('LanguageSelect')}
        >
          <Ionicons name="language-outline" size={18} color={COLORS.primary} />
          <Text style={styles.langBtnText}>{t('select_language')}</Text>
        </TouchableOpacity>
      </View>

      {/* Logo + Branding */}
      <View style={styles.logoSection}>
        <View style={styles.logoContainer}>
          <Logo size={140} />
        </View>
        <Text style={styles.appName}>Healio</Text>
        <Text style={styles.tagline}>Your health companion</Text>
      </View>

      {/* Feature highlights */}
      <View style={styles.features}>
        {[
          { icon: 'heart-outline', text: 'Track your vitals & wellness' },
          { icon: 'calendar-outline', text: 'Book appointments instantly' },
          { icon: 'people-outline', text: 'Manage family health profiles' },
        ].map((item, i) => (
          <View key={i} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ionicons name={item.icon} size={18} color={COLORS.primary} />
            </View>
            <Text style={styles.featureText}>{item.text}</Text>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => navigation.navigate('PhoneEntry')}
        >
          <Text style={styles.loginBtnText}>{t('login') || 'Login'}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signupBtn}
          onPress={() => navigation.navigate('Onboarding1')}
        >
          <Text style={styles.signupBtnText}>{t('signup') || 'Sign Up'}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.l,
    paddingTop: SPACING.m,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Logo
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.xl,
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 35,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0px 6px 12px rgba(130, 28, 3, 0.15)',
      },
      default: {
        elevation: 6,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
    overflow: 'hidden',
  },
  appName: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
    marginTop: SPACING.m,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '500',
  },

  // Features
  features: {
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.l,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    flex: 1,
  },

  // Footer
  footer: {
    paddingHorizontal: SPACING.l,
    paddingBottom: SPACING.l,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 8px rgba(130, 28, 3, 0.25)',
      },
      default: {
        elevation: 4,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
    marginBottom: 12,
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
  },
  signupBtn: {
    backgroundColor: COLORS.secondary,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    marginBottom: SPACING.m,
  },
  signupBtnText: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
