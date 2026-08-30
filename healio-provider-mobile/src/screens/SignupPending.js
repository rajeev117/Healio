import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
import styles from './SignupPending.styles';

// ─────────────────────────────────────────────────────────────────────────────
// Shown after hospital submits signup application.
// Hospital is now in admin's onboarding queue — pending approval.
// Once admin approves, hospital receives OTP login credentials via SMS.
// ─────────────────────────────────────────────────────────────────────────────

export default function SignupPending({ navigation, route }) {
  const { hospitalName, phone } = route?.params || {};
  const { t } = useLanguage();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Ionicons name="time" size={48} color={COLORS.primary} />
        </View>

        {/* Title */}
        <Text style={styles.title}>{t('sp_submitted')}</Text>
        <Text style={styles.subtitle}>
          <Text style={styles.bold}>{hospitalName || t('sp_your_hospital')}</Text>{t('sp_registered_rest')}
        </Text>

        {/* Steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>{t('sp_next_title')}</Text>
          {[
            { icon: 'search',           label: t('sp_step_review') },
            { icon: 'shield-checkmark', label: t('sp_step_verify') },
            { icon: 'phone-portrait',   label: t('sp_step_credentials', { phone }) },
            { icon: 'home',             label: t('sp_step_login') },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: COLORS.primarySoft }]}>
                <Ionicons name={step.icon} size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.stepText}>{step.label}</Text>
            </View>
          ))}
        </View>

        {/* Timing */}
        <View style={styles.timingRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.timingText}>{t('sp_review_time_pre')}<Text style={styles.bold}>{t('sp_review_time_value')}</Text></Text>
        </View>

        {/* Support */}
        <Text style={styles.supportText}>
          {t('sp_questions')}<Text style={styles.link}>support@healio.in</Text>{t('sp_or_call')}<Text style={styles.link}>1800-123-4567</Text>
        </Text>

        {/* Back to Welcome */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })}>
          <Text style={styles.backBtnText}>{t('sp_back_home')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
