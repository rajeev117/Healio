import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import CalendarPicker from '../components/CalendarPicker';
import { lookupPhoneAccount } from '../../../lib/supabase';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// phone_account_kind() bucket → how the "already registered" message names it.
const ACCOUNT_KIND_TEXT = {
  doctor:   'a doctor',
  staff:    'hospital staff',
  provider: 'a provider organisation',
  rmp:      'a Healthcare Consultant',
};

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

export default function Signup({ navigation }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pickedDate, setPickedDate] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [bloodGroup, setBloodGroup] = useState('');
  const [showBloodModal, setShowBloodModal] = useState(false);

  const [phoneError, setPhoneError] = useState('');
  const [checking, setChecking] = useState(false);

  // Name, phone and date of birth are required; email + blood group are optional.
  const isFormValid = name.trim().length > 0 && phone.trim().length === 10 && pickedDate !== null;

  // Refuse a number that already has an account — of any kind. Every role shares
  // one derived auth account per phone, so continuing would sign into the
  // existing one and add a patient profile on top of, say, a doctor.
  const handleSignup = async () => {
    if (!isFormValid || checking) return;
    setPhoneError('');
    setChecking(true);
    const { kind } = await lookupPhoneAccount(phone);
    setChecking(false);

    if (kind) {
      setPhoneError(kind === 'patient'
        ? 'This number is already registered. Log in instead.'
        : `This number is already registered as ${ACCOUNT_KIND_TEXT[kind] || 'a Healio account'}. Log in instead.`);
      return;
    }
    navigation.navigate('OTPVerify', {
      phone,
      name: name.trim(),
      flow: 'signup',
      email: email.trim() || null,
      dob: dateToISO(pickedDate),
      bloodGroup: bloodGroup || null,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Back Row */}
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('create_account')}</Text>
            <Text style={styles.subtitle}>{t('signup_subtitle')}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Full Name */}
            <Text style={styles.inputLabel}>{t('full_name')} *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder={t('full_name_ph')}
                value={name}
                onChangeText={setName}
                placeholderTextColor={COLORS.textSecondary}
                autoCapitalize="words"
              />
            </View>

            {/* Phone Number */}
            <Text style={[styles.inputLabel, { marginTop: SPACING.m }]}>{t('phone_number')} *</Text>
            <View style={styles.phoneInputRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.countryCodeText}>+91</Text>
              </View>
              <View style={[styles.inputWrapper, { flex: 1 }]}>
                <Ionicons name="call-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('phone_ph')}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={(text) => { setPhone(text.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }}
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>
            </View>

            {!!phoneError && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
                <Text style={styles.errorText}>{phoneError}</Text>
              </View>
            )}

            {/* Date of Birth — required, via calendar picker */}
            <Text style={[styles.inputLabel, { marginTop: SPACING.m }]}>{t('date_of_birth')} *</Text>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setShowCalendar(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <Text style={[styles.dateDisplayText, !pickedDate && { color: COLORS.textSecondary }]}>
                {pickedDate ? formatDate(pickedDate) : t('dob_ph')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>

            {/* Email — optional */}
            <Text style={[styles.inputLabel, { marginTop: SPACING.m }]}>{t('email_address')}</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder={t('email_ph')}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>

            {/* Blood Group — optional, dropdown */}
            <Text style={[styles.inputLabel, { marginTop: SPACING.m }]}>{t('blood_group')}</Text>
            <TouchableOpacity
              style={styles.inputWrapper}
              onPress={() => setShowBloodModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="water-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <Text style={[styles.dateDisplayText, !bloodGroup && { color: COLORS.textSecondary }]}>
                {bloodGroup || t('blood_group_ph')}
              </Text>
              <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, (!isFormValid || checking) && styles.btnDisabled]}
            onPress={handleSignup}
            disabled={!isFormValid || checking}
          >
            <Text style={styles.submitBtnText}>{checking ? 'Checking…' : t('create_account')}</Text>
            {!checking && <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => navigation.navigate('PhoneEntry')}
          >
            <Text style={styles.switchText}>
              {t('already_have_account')}{' '}
              <Text style={styles.switchLink}>{t('login')}</Text>
            </Text>
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

      {/* Blood group dropdown */}
      <Modal
        visible={showBloodModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBloodModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBloodModal(false)}
        >
          <View style={styles.bloodSheet}>
            <Text style={styles.bloodSheetTitle}>{t('select_blood_group')}</Text>
            {BLOOD_GROUPS.map((bg) => {
              const sel = bloodGroup === bg;
              return (
                <TouchableOpacity
                  key={bg}
                  style={[styles.bloodOption, sel && styles.bloodOptionSelected]}
                  onPress={() => { setBloodGroup(bg); setShowBloodModal(false); }}
                >
                  <Text style={[styles.bloodOptionText, sel && styles.bloodOptionTextSelected]}>{bg}</Text>
                  {sel && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              );
            })}
            {!!bloodGroup && (
              <TouchableOpacity
                style={styles.bloodClearBtn}
                onPress={() => { setBloodGroup(''); setShowBloodModal(false); }}
              >
                <Text style={styles.bloodClearText}>{t('clear_selection')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1 },
  scrollContent: { padding: SPACING.l, paddingBottom: 0 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.m,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { marginBottom: SPACING.xl },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginTop: SPACING.s, lineHeight: 22 },

  form: { flex: 1 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  errorText: { flex: 1, fontSize: 12.5, color: '#dc2626', fontWeight: '600', lineHeight: 17 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    height: 52,
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
    height: '100%',
  },
  dateDisplayText: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.text },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryCodeBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    width: 60,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  // Blood group dropdown modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.l,
  },
  bloodSheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    padding: SPACING.m,
  },
  bloodSheetTitle: {
    fontSize: 16, fontWeight: '800', color: COLORS.text,
    textAlign: 'center', marginBottom: SPACING.s, paddingTop: 4,
  },
  bloodOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 50, paddingHorizontal: 16, borderRadius: 14, marginTop: 6,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  bloodOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  bloodOptionText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  bloodOptionTextSelected: { color: COLORS.primary },
  bloodClearBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  bloodClearText: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },

  footer: {
    padding: SPACING.l,
    paddingTop: SPACING.m,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  submitBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  switchRow: {
    alignItems: 'center',
    marginTop: SPACING.m,
  },
  switchText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  switchLink: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});
