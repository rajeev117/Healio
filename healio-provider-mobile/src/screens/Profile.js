import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, Image, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { useStore } from '../lib/store';
import { Ionicons } from '@expo/vector-icons';
import ProtectedScreen from '../components/ProtectedScreen';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';
import { signOut } from '../lib/supabase';
import styles from './Profile.styles';

export default function Profile({ navigation }) {
  const { logout, user } = useAuth();
  const { t, language } = useLanguage();
  const currentLang = LANGUAGES.find(l => l.code === language);
  const langValue = currentLang ? currentLang.native.split(' (')[0] : 'English';
  const doctorsCount = useStore(state => state.doctors.length);
  const patientsCount = useStore(state => state.patients.length);
  const businessProfile = useStore(state => state.businessProfile);

  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const doLogout = async () => {
    try { await signOut(); } catch (_) {}
    logout();
    const rootNav = navigation.getParent() ?? navigation;
    rootNav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      doLogout();
    } else {
      Alert.alert(t('profile_confirm_logout_title'), t('profile_confirm_logout_msg'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('logout'), style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  return (
    <ProtectedScreen navigation={navigation}>
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card Header */}
        <View style={styles.profileHeader}>
          <View style={styles.hospitalLogoBox}>
            {businessProfile.logoUri ? (
              <Image source={{ uri: businessProfile.logoUri }} style={styles.hospitalLogoImage} />
            ) : (
              <Ionicons name="business-outline" size={34} color={COLORS.primary} />
            )}
          </View>
          <Text style={styles.hospitalName}>{user?.hospitalName || businessProfile.name || 'Hospital'}</Text>
          <Text style={styles.hospitalMeta}>{user?.role === 'hospital_admin' ? t('profile_role_admin') : (user?.name || t('profile_role_staff'))} · {user?.hospitalCity || businessProfile.city || ''}</Text>
        </View>

        {/* Live Partner Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Ionicons name="medkit-outline" size={20} color={COLORS.primary} />
            <Text style={styles.statVal}>{doctorsCount}</Text>
            <Text style={styles.statLabel}>{t('profile_stat_doctors')}</Text>
          </View>

          <View style={styles.statCell}>
            <Ionicons name="people-outline" size={20} color="#2b6cb0" />
            <Text style={styles.statVal}>{patientsCount}</Text>
            <Text style={styles.statLabel}>{t('profile_stat_patients')}</Text>
          </View>
        </View>

        {/* Section: Account Settings */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>{t('profile_preferences')}</Text>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: COLORS.primarySoft }]}>
                <Ionicons name="moon-outline" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.menuItemText}>{t('profile_dark_mode')}</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: COLORS.border, true: COLORS.primarySoft }}
              thumbColor={darkMode ? COLORS.primary : COLORS.textSecondary}
            />
          </View>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#eef6ff' }]}>
                <Ionicons name="notifications-outline" size={16} color="#2b6cb0" />
              </View>
              <Text style={styles.menuItemText}>{t('profile_push')}</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: COLORS.border, true: COLORS.primarySoft }}
              thumbColor={notifications ? COLORS.primary : COLORS.textSecondary}
            />
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ChooseLanguage')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#ebfaf0' }]}>
                <Ionicons name="language-outline" size={16} color="#2f855a" />
              </View>
              <Text style={styles.menuItemText}>{t('profile_app_language')}</Text>
            </View>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuValueText}>{langValue}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Section: Partnership info */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>{t('profile_partnership')}</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('StaffManagement')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#fdf6e2' }]}>
                <Ionicons name="id-card-outline" size={16} color="#c05621" />
              </View>
              <Text style={styles.menuItemText}>{t('profile_manage_staff')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('HospitalQR')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#eef6ff' }]}>
                <Ionicons name="qr-code-outline" size={16} color="#2b6cb0" />
              </View>
              <Text style={styles.menuItemText}>{t('profile_my_qr')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Notifications')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#eef6ff' }]}>
                <Ionicons name="notifications-outline" size={16} color="#2b6cb0" />
              </View>
              <Text style={styles.menuItemText}>{t('profile_notifications')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Ledger')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#ebfaf0' }]}>
                <Ionicons name="wallet-outline" size={16} color="#2f855a" />
              </View>
              <Text style={styles.menuItemText}>{t('profile_ledger')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Subscription')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#faf5ff' }]}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#6b46c1" />
              </View>
              <Text style={styles.menuItemText}>{t('profile_subscription')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Settings')}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: COLORS.surface }]}>
                <Ionicons name="options-outline" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.menuItemText}>{t('profile_hospital_settings')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert(t('profile_support_title'), t('profile_support_msg'))}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#fffaf0' }]}>
                <Ionicons name="call-outline" size={16} color="#c05621" />
              </View>
              <Text style={styles.menuItemText}>{t('profile_support')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert(t('profile_legal_title'), t('profile_legal_msg'))}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: COLORS.surface }]}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
              </View>
              <Text style={styles.menuItemText}>{t('profile_legal')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={16} color={COLORS.error} />
          <Text style={styles.logoutText}>{t('profile_logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Healio Provider App v1.0.0 (Expo)</Text>
      </ScrollView>
    </SafeAreaView>
    </ProtectedScreen>
  );
}
