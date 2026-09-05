import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { COLORS, SPACING } from '../constants/theme';
import { supabase, devSignIn, signUpOrIn, saveMyProfile } from '../services/supabase';
import { TEST_OTP } from '../services/env';

export default function OTPVerify({ navigation, route }) {
  const OTP_LENGTH = 4;
  const [otpDigits, setOtpDigits] = useState(Array.from({ length: OTP_LENGTH }, () => ''));
  const [verifying, setVerifying]   = useState(false);
  const [errorMsg,  setErrorMsg]    = useState('');   // inline error — works on web too
  const otpRefs    = useRef([]);
  const submitting = useRef(false); // sync guard — prevents double-submit
  const { t } = useLanguage();

  const phone = route?.params?.phone || '';
  const name  = route?.params?.name  || '';
  const flow  = route?.params?.flow  || '';
  // Registration details collected on the Signup screen (dob required; rest optional).
  const email      = route?.params?.email      || null;
  const dob        = route?.params?.dob        || null;
  const bloodGroup = route?.params?.bloodGroup || null;

  // Focus first box on mount
  useEffect(() => {
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  }, []);

  const handleChange = (text, i) => {
    const digits = text.replace(/[^0-9]/g, '');
    const next = [...otpDigits];
    setErrorMsg(''); // clear error when user types

    if (!digits) {
      next[i] = '';
      setOtpDigits(next);
      return;
    }

    // Paste: spread digits across boxes
    if (digits.length > 1) {
      digits.slice(0, OTP_LENGTH - i).split('').forEach((d, offset) => {
        next[i + offset] = d;
      });
      setOtpDigits(next);
      otpRefs.current[Math.min(i + digits.length, OTP_LENGTH - 1)]?.focus();
      return;
    }

    next[i] = digits.slice(-1);
    setOtpDigits(next);
    if (i < OTP_LENGTH - 1) otpRefs.current[i + 1]?.focus();
  };

  const handleKeyPress = ({ nativeEvent }, i) => {
    if (nativeEvent.key === 'Backspace' && !otpDigits[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const otp        = otpDigits.join('');
  const isComplete = otp.length === OTP_LENGTH;

  const showError = (msg) => {
    setErrorMsg(msg);
    // Also show Alert on native (it works there); web uses inline display only
    if (Platform.OS !== 'web') {
      Alert.alert('Sign-in failed', msg);
    }
  };

  const handleVerify = async () => {
    if (!isComplete || submitting.current) return;

    if (otp !== TEST_OTP) {
      showError('Use 1111 as the OTP for testing.');
      return;
    }

    submitting.current = true;
    setErrorMsg('');
    setVerifying(true);
    try {
      if (flow === 'signup') {
        // ── Signup flow: create the account, then persist the details entered
        // on the registration screen so the profile shows them straight away
        // (previously the name lived only in a separate ProfileSetup step, which
        // was skipped for already-registered numbers → "New User" in the app).
        const { error } = await signUpOrIn(phone);
        if (error) {
          showError(error.message || 'Could not create account. Please try again.');
          return;
        }
        try {
          await saveMyProfile({
            name: name || undefined,
            email: email || undefined,
            date_of_birth: dob || undefined,
            blood_group: bloodGroup || undefined,
          });
        } catch (_) { /* non-blocking — profile can be completed later */ }
        navigation.replace('ProfileSelector', { userName: name });
      } else {
        // ── Login flow ───────────────────────────────────────────────────────
        // Try to sign in directly. We can't read `profiles` first because RLS
        // blocks the row until the user is authenticated — so signing in IS the
        // existence check: success = account exists, failure = not registered.
        const { error } = await devSignIn(phone);

        if (error) {
          const msg = (error.message || '').toLowerCase();
          // "Invalid login credentials" → no account with this phone yet
          if (msg.includes('invalid') || msg.includes('credentials')) {
            showError("We couldn't find an account for this number. Taking you to sign up…");
            setTimeout(() => {
              submitting.current = false;
              setVerifying(false);
              navigation.replace('Signup');
            }, 1500);
            return;
          }
          showError(error.message || 'Could not sign in. Please try again.');
          return;
        }

        // The admin panel's "ban patient" writes profiles.status = 'banned'.
        // Nothing read it back before, so a banned account signed in as normal.
        // Fails OPEN: a lookup error must never lock a real patient out.
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: prof } = await supabase
            .from('profiles').select('status').eq('id', user?.id).maybeSingle();
          if (prof?.status === 'banned') {
            await supabase.auth.signOut();
            showError('This account has been suspended. Contact Healio support.');
            return;
          }
        } catch (_) { /* fail open */ }

        navigation.replace('ProfileSelector', { userName: name });
      }
    } catch (e) {
      showError(e?.message || 'Request timed out. Check your connection and try again.');
    } finally {
      submitting.current = false;
      setVerifying(false);
    }
  };

  // Auto-submit on native only — browsers block window.alert() from useEffect
  // and the behaviour is confusing on web; the button tap is enough there.
  useEffect(() => {
    if (Platform.OS !== 'web' && isComplete && !submitting.current) {
      handleVerify();
    }
  }, [otp]);

  const handleResend = () => {
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''));
    setErrorMsg('');
    otpRefs.current[0]?.focus();
    if (Platform.OS === 'web') {
      setErrorMsg('Test mode — enter 1111 to continue.');
    } else {
      Alert.alert('Test mode', 'Enter 1111 to continue.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color={COLORS.textSecondary} />
          <Text style={styles.backBtnText}>Change number</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{t('verify_otp')}</Text>
          <Text style={styles.subtitle}>
            Enter 1111 to continue (test mode).
          </Text>
        </View>

        {/* Notice banner */}
        <View style={styles.noticeBanner}>
          <Ionicons name="shield-checkmark" size={22} color={COLORS.primary} style={styles.noticeIcon} />
          <View style={styles.noticeTextContainer}>
            <Text style={styles.noticeTitle}>Test mode active</Text>
            <Text style={styles.noticeDesc}>Enter 1111 to log in as +91 {phone}</Text>
          </View>
        </View>

        {/* OTP boxes */}
        <View style={styles.otpRow}>
          {otpDigits.map((digit, index) => (
            <TextInput
              key={index}
              ref={r => { otpRefs.current[index] = r; }}
              style={[
                styles.otpBox,
                digit          ? styles.otpBoxFilled : null,
                errorMsg       ? styles.otpBoxError  : null,
                index === otpDigits.findIndex(d => d === '') ? styles.otpBoxActive : null,
              ]}
              maxLength={1}
              keyboardType="number-pad"
              value={digit}
              editable={!verifying}
              onChangeText={text => handleChange(text, index)}
              onKeyPress={e => handleKeyPress(e, index)}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              textAlign="center"
              selectionColor={COLORS.primary}
            />
          ))}
        </View>

        {/* Inline error — visible on web and native */}
        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.resendContainer} onPress={handleResend}>
          <Text style={styles.resendText}>
            Didn't receive code?{'  '}
            <Text style={styles.resendAction}>Resend</Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.verifyBtn, (!isComplete || verifying) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!isComplete || verifying}
          >
            {verifying ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.verifyBtnText}>
                {Platform.OS === 'web' ? 'Verify & Continue' : 'Verify & Continue'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner:     { flex: 1, padding: SPACING.l },
  backBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: SPACING.s, marginBottom: SPACING.m, gap: 6,
  },
  backBtnText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
  header:   { marginBottom: SPACING.l },
  title:    { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  subtitle: { fontSize: 15, color: COLORS.textSecondary, marginTop: SPACING.s, lineHeight: 22 },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.secondary, padding: 16,
    borderRadius: 16, marginBottom: SPACING.xl,
  },
  noticeIcon:          { marginRight: 12 },
  noticeTextContainer: { flex: 1 },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  noticeDesc:  { fontSize: 12, color: COLORS.primary, opacity: 0.8, marginTop: 2 },

  otpRow: {
    flexDirection: 'row', justifyContent: 'center',
    marginTop: 40, marginBottom: SPACING.l, gap: 14,
  },
  otpBox: {
    width: 60, height: 64, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    fontSize: 24, fontWeight: '800', color: COLORS.text, textAlign: 'center',
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  otpBoxActive: { borderColor: COLORS.primary, borderWidth: 2 },
  otpBoxError:  { borderColor: '#dc2626', backgroundColor: '#fff5f5' },

  // Inline error box — shown on both web and native
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fff5f5', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 10, padding: 12, marginBottom: SPACING.m,
  },
  errorText: { flex: 1, fontSize: 13, color: '#dc2626', lineHeight: 18 },

  resendContainer: { alignItems: 'center', marginBottom: SPACING.xl },
  resendText:   { color: COLORS.textSecondary, fontSize: 14 },
  resendAction: { color: COLORS.primary, fontWeight: '700' },

  footer:    { marginTop: 'auto', paddingVertical: SPACING.m },
  verifyBtn: {
    backgroundColor: COLORS.primary, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 28,
  },
  verifyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  btnDisabled:   { opacity: 0.5 },
});
