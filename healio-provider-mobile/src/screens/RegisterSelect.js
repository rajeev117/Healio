import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';

// Registration categories. `route` → navigate there; otherwise it's not built
// yet and we show a "coming soon" notice. titleKey/subtitleKey resolve via t().
const OPTIONS = [
  { key: 'hospital', icon: 'hospital-building', color: '#e5484d', bg: '#fdecea', titleKey: 'reg_hospital',   subtitleKey: 'reg_hospital_sub',   route: 'Signup' },
  { key: 'doctor',   icon: 'stethoscope',       color: '#2f9e63', bg: '#e8f5ee', titleKey: 'reg_doctor',     subtitleKey: 'reg_doctor_sub',     route: 'Signup', params: { kind: 'doctor' } },
  { key: 'lab',      icon: 'test-tube',         color: '#12b0a0', bg: '#e6fbf6', titleKey: 'reg_lab',        subtitleKey: 'reg_lab_sub',        route: 'Signup', params: { kind: 'lab' } },
  { key: 'pharmacy', icon: 'pill',              color: '#3b7ddd', bg: '#eaf2ff', titleKey: 'reg_pharmacy',   subtitleKey: 'reg_pharmacy_sub',   route: 'Signup', params: { kind: 'pharmacy' } },
  { key: 'rmp',      icon: 'medical-bag',       color: '#e8892b', bg: '#fff3e0', titleKey: 'reg_consultant', subtitleKey: 'reg_consultant_sub', route: 'RmpSignup' },
  { key: 'patient',  icon: 'account',           color: '#8a4fd8', bg: '#f3eaff', titleKey: 'reg_patient',    subtitleKey: 'reg_patient_sub',    route: 'PatientApp', params: { initialRoute: 'Signup' } },
];

export default function RegisterSelect({ navigation }) {
  const { t } = useLanguage();
  const onSelect = (opt) => {
    if (opt.route) {
      navigation.navigate(opt.route, opt.params);
    } else {
      Alert.alert(t('reg_coming_soon_title'), t('reg_coming_soon_msg', { title: t(opt.titleKey) }));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('register')}</Text>
      </View>
      <View style={styles.divider} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>{t('register_subtitle')}</Text>

        {OPTIONS.map((opt) => (
          <TouchableOpacity key={opt.key} style={styles.card} activeOpacity={0.85} onPress={() => onSelect(opt)}>
            <View style={[styles.iconBox, { backgroundColor: opt.bg }]}>
              <MaterialCommunityIcons name={opt.icon} size={26} color={opt.color} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{t(opt.titleKey)}</Text>
              <Text style={styles.cardSubtitle}>{t(opt.subtitleKey)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  body: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 32 },
  subtitle: { fontSize: 15, color: '#6c757d', marginBottom: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eef0f2',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  cardSubtitle: { fontSize: 13, color: '#6c757d', marginTop: 3 },
});
