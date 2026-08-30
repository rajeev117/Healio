import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
import { COLORS, SIZES, SPACING } from '../constants/theme';
import { CustomButton } from '../components/CustomButton';
import { Ionicons } from '@expo/vector-icons';

const languages = [
  { label: 'English', value: 'English', desc: 'Default • Selected' },
  { label: 'বাংলা', value: 'Bengali', desc: 'Bengali' },
  { label: 'हिन्दी', value: 'Hindi', desc: 'Hindi' },
];

export default function LanguageSelect({ navigation }) {
  const { setLanguage, language, t } = useLanguage();

  const handleNext = async () => {
    navigation.navigate('Signup');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="language-outline" size={64} color={COLORS.primary} />
        <Text style={styles.title}>{t('select_language')}</Text>
        <Text style={styles.subtitle}>Choose your preferred language to continue</Text>
      </View>
      
      <View style={styles.options}>
        {languages.map((l) => (
          <TouchableOpacity 
            key={l.value} 
            style={[
              styles.option,
              language === l.value && styles.selectedOption
            ]}
            onPress={() => setLanguage(l.value)}
          >
            <View style={styles.optionLeft}>
              <View>
                <Text style={[styles.label, language === l.value && styles.selectedLabel]}>{l.label}</Text>
                <Text style={styles.desc}>{l.desc}</Text>
              </View>
            </View>
            {language === l.value && (
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <CustomButton
        title={t('next')}
        onPress={handleNext}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.l, backgroundColor: COLORS.background },
  header: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.xl },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginTop: SPACING.m },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: SPACING.s },
  options: { flex: 1 },
  option: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.m, 
    borderRadius: SIZES.radius,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.m,
    backgroundColor: COLORS.surface
  },
  selectedOption: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.secondary,
  },
  label: { fontSize: 18, fontWeight: '600', color: COLORS.text },
  selectedLabel: { color: COLORS.primary },
  desc: { fontSize: 12, color: COLORS.textSecondary },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
});
