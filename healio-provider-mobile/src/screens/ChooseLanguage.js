import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';

export default function ChooseLanguage({ navigation }) {
  const { language, setLanguage, t } = useLanguage();
  const [selected, setSelected] = useState(language || 'en');
  const canGoBack = navigation.canGoBack();

  const onContinue = async () => {
    await setLanguage(selected);
    // Reached from a profile menu → go back; reached on first launch → go to login.
    if (canGoBack) navigation.goBack();
    else navigation.replace('Welcome');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44 }} />
        )}
        <Text style={styles.title}>{t('lang_title')}</Text>
      </View>
      <View style={styles.divider} />

      {/* Options */}
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t('lang_subtitle')}</Text>
        {LANGUAGES.map((l) => {
          const active = selected === l.code;
          return (
            <TouchableOpacity
              key={l.code}
              style={[styles.option, active && styles.optionActive]}
              activeOpacity={0.8}
              onPress={() => setSelected(l.code)}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{l.native}</Text>
              {active && <Ionicons name="checkmark" size={22} color="#821c03" />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Continue */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueBtn} activeOpacity={0.85} onPress={onContinue}>
          <Text style={styles.continueText}>{t('continue')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f4f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  divider: { height: 1, backgroundColor: '#ededed' },
  body: { paddingHorizontal: 20, paddingTop: 24 },
  subtitle: { fontSize: 15, color: '#6c757d', marginBottom: 18 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 22,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionActive: { borderColor: '#821c03', backgroundColor: '#fdf2f0' },
  optionText: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  optionTextActive: { color: '#821c03', fontWeight: '800' },
  footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  continueBtn: {
    backgroundColor: '#821c03',
    borderRadius: 14,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
});
