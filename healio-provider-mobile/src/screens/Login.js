import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase, signInWithPhone, resolveRole, lookupPhoneAccount, BLOCK_MESSAGE_KEY } from '../lib/supabase';
import { TEST_OTP } from '../lib/env';
import { useStore } from '../lib/store';
import styles from './Login.styles';

const OTP_LENGTH = 4;

// Phone → OTP (test mode: any 4-digit code) → sign in → resolve role → dashboard.
export default function Login({ navigation }) {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [checking, setChecking] = useState(false);
  const [otp, setOtp] = useState(Array.from({ length: OTP_LENGTH }, () => ''));
  const [loading, setLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const otpRefs = useRef([]);

  // Verify the number is registered BEFORE sending anyone to the OTP screen.
  // Discovering it afterwards wasted the user's time and, worse, meant
  // signInWithPhone had already created an auth account for a number that
  // belongs to nobody.
  const handlePhoneContinue = async () => {
    if (checking) return;
    setPhoneError('');
    setChecking(true);
    const { kind, unknown } = await lookupPhoneAccount(phone);
    setChecking(false);

    // `unknown` = the check itself failed; let them through rather than lock a
    // real user out. resolveRole after OTP is still the final gate.
    if (!unknown && !kind) {
      setPhoneError(t('login_err_not_registered'));
      return;
    }
    setOtp(Array.from({ length: OTP_LENGTH }, () => ''));
    setOtpError('');
    setStep('otp');
  };

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 100);
  }, [step]);

  const otpValue = otp.join('');
  const otpComplete = otpValue.length === OTP_LENGTH;

  const handleOtpChange = (text, i) => {
    const digits = text.replace(/[^0-9]/g, '');
    const next = [...otp];
    setOtpError('');

    if (!digits) {
      next[i] = '';
      setOtp(next);
      return;
    }

    if (digits.length > 1) {
      digits.slice(0, OTP_LENGTH - i).split('').forEach((digit, offset) => {
        next[i + offset] = digit;
      });
      setOtp(next);
      otpRefs.current[Math.min(i + digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    next[i] = digits.slice(-1);
    setOtp(next);
    if (i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
  };
  const handleOtpKey = ({ nativeEvent }, i) => {
    if (nativeEvent.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleVerify = async () => {
    if (!otpComplete || loading) return;

    if (otpValue !== TEST_OTP) {
      setOtpError(t('login_err_otp', { code: TEST_OTP }));
      return;
    }

    setOtpError('');
    setLoading(true);
    try {
      const { error } = await signInWithPhone(phone);
      if (error) {
        setOtpError(error.message || t('login_err_signin'));
        setLoading(false);
        return;
      }

      // resolveRole is the single gate: it recognises hospital admins, staff
      // (doctor / opd / pharmacy / lab), and RMPs. A null result means this
      // phone isn't linked to any role, so it isn't a registered account.
      const userData = await resolveRole();
      if (!userData) {
        setOtpError(t('login_err_not_registered'));
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Switched off from the admin panel (suspended org / deactivated staff /
      // still-pending registration). Sign them straight back out so a stale
      // session can't slip past this on the next cold start.
      if (userData.blocked) {
        setOtpError(t(BLOCK_MESSAGE_KEY[userData.blockedReason] || 'login_err_generic'));
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      login(userData);
      useStore.getState().hydrateFromSupabase();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e) {
      setOtpError(e?.message || t('login_err_generic'));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => step === 'otp' ? setStep('phone') : navigation.goBack()}
            style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {step === 'phone' ? (
            <>
              <Text style={styles.title}>{t('login_welcome_back')}</Text>
              <Text style={styles.subtitle}>
                {t('login_phone_hint')}
              </Text>

              <Text style={styles.label}>{t('login_phone_label')}</Text>
              <View style={styles.phoneRow}>
                <View style={styles.cc}><Text style={styles.ccText}>+91</Text></View>
                <View style={styles.inputWrap}>
                  <Ionicons name="call-outline" size={18} color={COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="98300 12345"
                    placeholderTextColor={COLORS.textSecondary}
                    value={phone}
                    onChangeText={(v) => { setPhone(v.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }}
                  />
                </View>
              </View>

              {!!phoneError && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.errorText}>{phoneError}</Text>
                    <Text style={styles.errorHint}>{t('login_err_not_registered_hint')}</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (phone.length < 10 || checking) && styles.disabled]}
                disabled={phone.length < 10 || checking}
                onPress={handlePhoneContinue}>
                {checking
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.primaryBtnText}>{t('continue')}</Text>}
              </TouchableOpacity>

              <View style={styles.note}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.noteText}>
                  {t('login_test_mode')}
                </Text>
              </View>

              {/* The way out of a "no account" dead end, always visible rather
                  than only once the error appears. */}
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>{t('login_no_account')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('RegisterSelect')} hitSlop={8}>
                  <Text style={styles.switchLink}>{t('register')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('login_enter_otp')}</Text>
              <Text style={styles.subtitle}>{t('login_otp_sub', { phone, code: TEST_OTP })}</Text>

              <View style={styles.otpRow}>
                {otp.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={(r) => { otpRefs.current[i] = r; }}
                    style={[styles.otpBox, d && styles.otpBoxFilled]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={d}
                    editable={!loading}
                    onChangeText={(t) => handleOtpChange(t, i)}
                    onKeyPress={(e) => handleOtpKey(e, i)}
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    textAlign="center"
                  />
                ))}
              </View>

              {!!otpError && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
                  <Text style={styles.errorText}>{otpError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, (!otpComplete || loading) && styles.disabled]}
                disabled={!otpComplete || loading}
                onPress={handleVerify}>
                {loading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.primaryBtnText}>{t('login_verify')}</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
