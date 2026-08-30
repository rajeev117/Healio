import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '../components/Logo';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';
import styles from './Welcome.styles';

const { width } = Dimensions.get('window');

export default function Welcome({ navigation }) {
  const { language, t } = useLanguage();
  const current = LANGUAGES.find(l => l.code === language);
  // Short label (drop the parenthetical) so the chip stays compact.
  const langLabel = current ? current.native.split(' (')[0] : t('welcome_lang_default');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.bgBlobOne} />
      <View style={styles.bgBlobTwo} />

      {/* Language switcher — opens the existing Choose Language picker */}
      <TouchableOpacity
        style={styles.langButton}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('ChooseLanguage')}
      >
        <Ionicons name="language" size={16} color={COLORS.primary} />
        <Text style={styles.langButtonText}>{langLabel}</Text>
        <Ionicons name="chevron-down" size={14} color={COLORS.primary} />
      </TouchableOpacity>
      
      {/* Hero Header Area */}
      <View style={styles.heroSection}>
        <View style={styles.logoContainer}>
          <Logo size={120} />
        </View>
        <Text style={styles.appName}>Healio</Text>

        <Text style={styles.tagline}>
          {t('welcome_tagline')}
        </Text>
      </View>

      {/* Action Card Section */}
      <View style={styles.footerSection}>
        <View style={styles.card}>
          <View style={styles.secureBadge}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.success} style={{ marginRight: 2 }} />
            <Text style={styles.secureText}>{t('welcome_secure')}</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('RegisterSelect')}
          >
            <Text style={styles.primaryButtonText}>{t('register')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryButtonText}>{t('sign_in')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
