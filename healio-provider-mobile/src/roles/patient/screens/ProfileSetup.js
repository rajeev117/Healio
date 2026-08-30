import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { saveMyProfile, supabase } from '../services/supabase';
import { usePlatformConfig } from '../context/PlatformConfigContext';
import CalendarPicker from '../components/CalendarPicker';

const GENDERS = ['Male', 'Female', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function dateToISO(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProfileSetup({ navigation, route }) {
  const { t } = useLanguage();
  const { isEnabled } = usePlatformConfig();
  const userName = route?.params?.userName || '';
  const phone = route?.params?.phone || '';

  const [pickedDate, setPickedDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [gender, setGender] = useState('');

  const [bloodGroup, setBloodGroup] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [avatarUri, setAvatarUri] = useState(null);
  const [avatarBase64, setAvatarBase64] = useState(null);
  const [uploading, setUploading] = useState(false);

  const heightNum = parseFloat(height);
  const weightNum = parseFloat(weight);
  const heightError = height.length > 0 && (isNaN(heightNum) || heightNum < 50 || heightNum > 250);
  const weightError = weight.length > 0 && (isNaN(weightNum) || weightNum < 5 || weightNum > 300);
  const isFormValid = pickedDate !== null && gender !== '' && !heightError && !weightError;

  const handlePickImage = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setAvatarUri(result.assets[0].uri);
        setAvatarBase64(result.assets[0].base64 || null);
      }
    } catch {
      Alert.alert('Not available', 'Run "npx expo install expo-image-picker" then restart the app.');
    }
  };

  const uploadAvatar = async (userId) => {
    if (!avatarUri) return null;
    try {
      const path = `${userId}/avatar.jpg`;
      // base64 → Uint8Array is the reliable approach for React Native + Supabase Storage.
      // fetch(localUri).blob() can produce an empty/malformed blob on Android.
      const b64 = avatarBase64;
      if (!b64) return null;
      const binaryStr = atob(b64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) { console.warn('Avatar upload error:', error); return null; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      // Append cache-buster so React Native's Image component re-downloads on each upload
      return `${data.publicUrl}?v=${Date.now()}`;
    } catch (e) {
      console.warn('Avatar upload failed:', e);
      return null;
    }
  };

  const persist = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let avatarUrl = undefined;
      if (avatarUri && user) {
        setUploading(true);
        avatarUrl = await uploadAvatar(user.id);
        setUploading(false);
      }
      const baseFields = {
        name: userName || 'User',
        phone: phone ? `+91${phone}` : undefined,
        email: email || undefined,
        date_of_birth: dateToISO(pickedDate),
        gender: gender || undefined,
        blood_group: bloodGroup || undefined,
        avatar_url: avatarUrl || undefined,
      };
      const extendedFields = {
        ...baseFields,
        height: height && !heightError ? parseFloat(height) : undefined,
        weight: weight && !weightError ? parseFloat(weight) : undefined,
        emergency_contact: emergencyContact || undefined,
      };
      // Fall back to base fields if migration-029 hasn't been applied yet
      const result = await saveMyProfile(extendedFields);
      if (result?.error?.code === 'PGRST204' || result?.error?.message?.includes('column')) {
        await saveMyProfile(baseFields);
      }
    } catch { /* non-blocking */ }
  };

  const afterProfile = () => {
    if (isEnabled('healio_plus')) {
      navigation.replace('HealioPlusPayment', { userName: userName || 'User' });
    } else {
      navigation.replace('ProfileSelector', { userName: userName || 'User' });
    }
  };

  const handleContinue = async () => {
    if (!isFormValid) return;
    await persist();
    afterProfile();
  };

  const initials = userName ? userName[0].toUpperCase() : 'U';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.welcomeHeader}>
            <Text style={styles.title}>{t('setup_profile') || 'Set Up Your Profile'}</Text>
            <Text style={styles.subtitle}>
              {userName ? `Welcome, ${userName}! ` : ''}Help us customize your healthcare experience.
            </Text>
          </View>

          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarLarge}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.initialsText}>{initials}</Text>
              )}
              <TouchableOpacity
                style={[styles.cameraBtn, uploading && { opacity: 0.5 }]}
                activeOpacity={0.8}
                onPress={handlePickImage}
                disabled={uploading}
              >
                <Ionicons name="camera" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.avatarHint}>Tap camera to add photo (optional)</Text>
          </View>

          {/* Required */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Required Details</Text>
          </View>

          {/* Date of Birth — calendar picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('date_of_birth') || 'Date of Birth'} *</Text>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setShowCalendar(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <Text style={[styles.dateDisplayText, !pickedDate && { color: COLORS.textSecondary }]}>
                {pickedDate ? formatDate(pickedDate) : 'Select date of birth'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Gender */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('gender') || 'Gender'} *</Text>
            <View style={styles.pillContainer}>
              {GENDERS.map((g) => {
                const isSelected = gender === g;
                const key = g.toLowerCase() === 'other' ? 'other_gender' : g.toLowerCase();
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.pill, isSelected && styles.pillSelected]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>
                      {t(key) || g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Optional */}
          <View style={[styles.sectionHeader, { marginTop: SPACING.l }]}>
            <Text style={styles.sectionTitle}>Optional Details</Text>
            <Text style={styles.sectionSub}>These help us provide better health insights</Text>
          </View>

          {/* Blood Group */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('blood_group') || 'Blood Group'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bloodScroll}>
              {BLOOD_GROUPS.map((bg) => {
                const sel = bloodGroup === bg;
                return (
                  <TouchableOpacity
                    key={bg}
                    style={[styles.bloodPill, sel && styles.bloodPillSelected]}
                    onPress={() => setBloodGroup(sel ? '' : bg)}
                  >
                    <Text style={[styles.bloodPillText, sel && styles.bloodPillTextSelected]}>{bg}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Height & Weight */}
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: SPACING.s }}>
              <Text style={styles.inputLabel}>{t('height') || 'Height'}</Text>
              <View style={[styles.inputWrapper, heightError && styles.inputWrapperError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 175"
                  keyboardType="decimal-pad"
                  maxLength={5}
                  value={height}
                  onChangeText={setHeight}
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={styles.unitText}>cm</Text>
              </View>
              {heightError && <Text style={styles.fieldError}>Enter 50–250 cm</Text>}
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.s }}>
              <Text style={styles.inputLabel}>{t('weight') || 'Weight'}</Text>
              <View style={[styles.inputWrapper, weightError && styles.inputWrapperError]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 70"
                  keyboardType="decimal-pad"
                  maxLength={5}
                  value={weight}
                  onChangeText={setWeight}
                  placeholderTextColor={COLORS.textSecondary}
                />
                <Text style={styles.unitText}>kg</Text>
              </View>
              {weightError && <Text style={styles.fieldError}>Enter 5–300 kg</Text>}
            </View>
          </View>

          {/* Email */}
          <View style={[styles.inputGroup, { marginTop: SPACING.m }]}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>

          {/* Emergency Contact */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>{t('emergency_contact') || 'Emergency Contact'}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                value={emergencyContact}
                onChangeText={(text) => setEmergencyContact(text.replace(/\D/g, '').slice(0, 10))}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueBtn, (!isFormValid || uploading) && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={!isFormValid || uploading}
          >
            <Text style={styles.continueBtnText}>
              {uploading ? 'Uploading photo…' : (t('next') || 'Continue')}
            </Text>
            {!uploading && <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <CalendarPicker
        visible={showCalendar}
        value={pickedDate}
        onChange={(date) => setPickedDate(date)}
        onClose={() => setShowCalendar(false)}
        maxDate={new Date()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: { paddingHorizontal: SPACING.l, paddingBottom: SPACING.xl },
  welcomeHeader: { marginBottom: SPACING.l },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6, lineHeight: 20 },

  avatarSection: { alignItems: 'center', marginBottom: SPACING.l },
  avatarLarge: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primary,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  initialsText: { fontSize: 38, fontWeight: '800', color: COLORS.primary },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.primary,
    padding: 6, borderRadius: 15,
    borderWidth: 2, borderColor: COLORS.background,
  },
  avatarHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 8 },

  sectionHeader: {
    marginBottom: SPACING.m,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  sectionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  inputGroup: { marginBottom: SPACING.m },
  inputLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, height: 52, paddingHorizontal: 16,
  },
  inputWrapperError: { borderColor: '#dc3545' },
  inputIcon: { marginRight: 12 },
  textInput: { flex: 1, fontSize: 16, color: COLORS.text, fontWeight: '500', height: '100%' },
  dateDisplayText: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.text },
  unitText: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary, marginLeft: 8 },
  fieldError: { fontSize: 12, color: '#dc3545', marginTop: 4, fontWeight: '600' },

  pillContainer: { flexDirection: 'row', gap: 12 },
  pill: {
    flex: 1, height: 48, borderRadius: 24,
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  pillSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  pillText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  pillTextSelected: { color: COLORS.primary, fontWeight: '700' },

  bloodScroll: { gap: 8, paddingVertical: 2 },
  bloodPill: {
    width: 50, height: 44, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  bloodPillSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  bloodPillText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  bloodPillTextSelected: { color: COLORS.primary },

  row: { flexDirection: 'row', marginBottom: SPACING.m },

  footer: { padding: SPACING.l, paddingTop: SPACING.m },
  continueBtn: {
    backgroundColor: COLORS.primary, height: 54, borderRadius: 27,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  continueBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  continueBtnDisabled: { opacity: 0.5, elevation: 0, shadowOpacity: 0 },
});
