import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { lookupPhoneAccount } from '../../../lib/supabase';

export default function PhoneEntry({ navigation }) {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const { t } = useLanguage();

  const isFormValid = /^[6-9]\d{9}$/.test(phone.trim());

  // Confirm the number exists before the OTP screen. Signing in used to BE the
  // existence check, so an unregistered number only found out after entering a
  // code — RLS hid `profiles` pre-session, but phone_account_kind (migration
  // 052) answers it without one.
  const handleContinue = async () => {
    if (!isFormValid || checking) return;
    setError('');
    setChecking(true);
    const { kind, unknown } = await lookupPhoneAccount(phone);
    setChecking(false);

    // unknown = lookup unavailable; let them through, OTPVerify still catches it.
    if (!unknown && !kind) {
      setError("We couldn't find an account for this number.");
      return;
    }
    navigation.navigate('OTPVerify', { phone, flow: 'login' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{t('welcome')}</Text>
          <Text style={styles.subtitle}>Log in to your Healio account</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.inputLabel}>{t('phone_number')}</Text>
          <View style={styles.phoneInputRow}>
            <View style={styles.countryCodeBox}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Ionicons name="call-outline" size={18} color={COLORS.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(text) => { setPhone(text.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                placeholderTextColor={COLORS.textSecondary}
              />
            </View>
          </View>

          {!!error && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.infoText}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, (!isFormValid || checking) && styles.btnDisabled]}
            onPress={handleContinue}
            disabled={!isFormValid || checking}
          >
            <Text style={styles.submitBtnText}>{checking ? 'Checking…' : (t('login') || 'Login')}</Text>
            {!checking && <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => navigation.navigate('Onboarding1')}
          >
            <Text style={styles.switchText}>
              Don't have an account?{' '}
              <Text style={styles.switchLink}>{t('signup') || 'Sign Up'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  keyboardView: { flex: 1, padding: SPACING.l },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 0 : SPACING.s,
  },
  header: { marginTop: SPACING.l, marginBottom: SPACING.xl },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 16, color: COLORS.textSecondary, marginTop: SPACING.s },
  form: { flex: 1 },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
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
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: SPACING.s },
  errorText: { flex: 1, fontSize: 12.5, color: '#dc2626', fontWeight: '600', lineHeight: 17 },
  infoText: { fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.l, textAlign: 'center', lineHeight: 18 },
  footer: { paddingVertical: SPACING.m },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    gap: 8,
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
