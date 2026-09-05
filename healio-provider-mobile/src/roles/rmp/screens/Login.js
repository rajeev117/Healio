import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { CustomButton } from '../components/CustomButton';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { supabase, signInWithPhone, resolveRole, lookupPhoneAccount, BLOCK_MESSAGE_KEY } from '../../../lib/supabase';
import { TEST_OTP } from '../../../lib/env';

const OTP_LENGTH = 4;
const PHONE_RE = /^[6-9]\d{9}$/;

export default function Login({ navigation }) {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [checking, setChecking] = useState(false);
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState('');
  const [loading, setLoading] = useState(false);
  const otpRefs = useRef([]);

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 100);
  }, [step]);

  const otpValue = otp.join('');
  const otpComplete = otpValue.length === OTP_LENGTH;

  // The number is checked here, not after the OTP: an unregistered number never
  // reaches the OTP screen (and never gets an auth account created for it), and
  // a number belonging to some other role is turned away with the right message
  // instead of failing at the end of the flow.
  const handlePhoneContinue = async () => {
    if (checking) return;
    const digits = phone.replace(/\D/g, '');
    if (!PHONE_RE.test(digits)) {
      setPhoneError(t('rmp_err_phone'));
      return;
    }
    setPhoneError('');
    setChecking(true);
    const { kind, unknown } = await lookupPhoneAccount(digits);
    setChecking(false);

    // `unknown` = the lookup failed; fall through rather than block a real user.
    if (!unknown) {
      if (!kind) {
        setPhoneError(t('login_err_not_registered'));
        return;
      }
      if (kind !== 'rmp') {
        setPhoneError(t('rmp_err_not_rmp'));
        return;
      }
    }
    setOtp(Array(OTP_LENGTH).fill(''));
    setOtpError('');
    setStep('otp');
  };

  const handleOtpChange = (text, i) => {
    const d = text.replace(/[^0-9]/g, '');
    const next = [...otp];
    setOtpError('');
    if (!d) { next[i] = ''; setOtp(next); return; }
    if (d.length > 1) {
      d.slice(0, OTP_LENGTH - i).split('').forEach((ch, off) => { next[i + off] = ch; });
      setOtp(next);
      otpRefs.current[Math.min(i + d.length, OTP_LENGTH - 1)]?.focus();
      return;
    }
    next[i] = d.slice(-1);
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
    setLoading(true);
    try {
      const { error } = await signInWithPhone(phone.replace(/\D/g, ''));
      if (error) { setOtpError(error.message || t('rmp_err_signin')); return; }
      const userData = await resolveRole();
      if (!userData || userData.role !== 'rmp') {
        setOtpError(t('rmp_err_not_rmp'));
        return;
      }
      // Suspended from the admin panel — no dashboard.
      if (userData.blocked) {
        setOtpError(t(BLOCK_MESSAGE_KEY[userData.blockedReason] || 'rmp_err_generic'));
        await supabase.auth.signOut();
        return;
      }
      login(userData);
      navigation.replace('Main');
    } catch (e) {
      setOtpError(e?.message || t('rmp_err_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => step === 'otp' ? setStep('phone') : navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.logoBox}>
            <Ionicons name="heart" size={26} color={COLORS.white} />
          </View>
          <Text style={styles.appName}>{t('rmp_role')}</Text>
          <Text style={styles.tagline}>Healio {t('rmp_health_network')}</Text>
        </View>

        <ScrollView style={styles.card} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {step === 'phone' ? (
            <>
              <Text style={styles.title}>{t('login_welcome_back')}</Text>
              <Text style={styles.subtitle}>{t('rmp_login_subtitle')}</Text>

              <Text style={styles.fieldLabel}>{t('rmp_mobile_number')}</Text>
              <View style={[styles.phoneRow, phoneError && styles.inputError]}>
                <View style={styles.countryCode}><Text style={styles.countryCodeText}>+91</Text></View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="98765 43210"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={t => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }}
                  returnKeyType="done"
                  onSubmitEditing={handlePhoneContinue}
                />
              </View>
              {!!phoneError && <Text style={styles.errorText}><Ionicons name="alert-circle-outline" size={12} /> {phoneError}</Text>}

              <View style={styles.hintBox}>
                <Ionicons name="information-circle-outline" size={15} color={COLORS.primary} />
                <Text style={styles.hintText}>{t('rmp_test_hint', { code: TEST_OTP })}</Text>
              </View>

              <CustomButton
                title={checking ? t('login_checking') : t('continue')}
                onPress={handlePhoneContinue}
                disabled={phone.length < 10 || checking}
                style={styles.btn}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchText}>{t('rmp_no_account')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                  <Text style={styles.switchLink}>{t('rmp_sign_up')}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('login_enter_otp')}</Text>
              <Text style={styles.subtitle}>{t('rmp_otp_sent', { phone, code: TEST_OTP })}</Text>

              <View style={styles.otpRow}>
                {otp.map((d, i) => (
                  <TextInput
                    key={i}
                    ref={r => { otpRefs.current[i] = r; }}
                    style={[styles.otpBox, d && styles.otpBoxFilled, otpError && styles.otpBoxError]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={d}
                    editable={!loading}
                    onChangeText={t => handleOtpChange(t, i)}
                    onKeyPress={e => handleOtpKey(e, i)}
                    textAlign="center"
                  />
                ))}
              </View>

              {!!otpError && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={15} color="#dc2626" />
                  <Text style={styles.errorBoxText}>{otpError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.verifyBtn, (!otpComplete || loading) && styles.verifyBtnDisabled]}
                disabled={!otpComplete || loading}
                onPress={handleVerify}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.verifyBtnText}>{t('rmp_verify_login')}</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.switchRow} onPress={() => setStep('phone')}>
                <Text style={styles.switchLink}>{t('rmp_change_number')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  flex: { flex: 1 },
  header: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 20 : 40, paddingBottom: 28 },
  backBtn: { position: 'absolute', left: 20, top: Platform.OS === 'ios' ? 20 : 40 },
  logoBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  appName: { fontSize: 22, fontWeight: '900', color: COLORS.white },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },
  card: { backgroundColor: COLORS.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1 },
  cardContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  subtitle: { fontSize: 13.5, color: COLORS.textSecondary, marginBottom: 22, lineHeight: 19 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: COLORS.text, marginBottom: 6, marginTop: 8 },
  phoneRow: { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  inputError: { borderColor: '#dc2626' },
  countryCode: { height: 48, backgroundColor: COLORS.surface, paddingHorizontal: 14, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border },
  countryCodeText: { fontSize: 14.5, fontWeight: '600', color: COLORS.text },
  phoneInput: { flex: 1, height: 48, paddingHorizontal: 15, fontSize: 14.5, color: COLORS.text, backgroundColor: COLORS.surface },
  errorText: { fontSize: 12, color: '#dc2626', marginTop: 5 },
  hintBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.primarySoft, borderRadius: 10, padding: 12, marginTop: 14, marginBottom: 6 },
  hintText: { flex: 1, fontSize: 12.5, color: COLORS.primary, lineHeight: 17 },
  btn: { marginTop: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  switchText: { fontSize: 13.5, color: COLORS.textSecondary },
  switchLink: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
  otpRow: { flexDirection: 'row', gap: 12, marginTop: 28, marginBottom: 16, justifyContent: 'center' },
  otpBox: { width: 56, height: 60, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, fontSize: 22, fontWeight: '700', color: COLORS.text },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  otpBoxError: { borderColor: '#dc2626' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff5f5', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorBoxText: { flex: 1, fontSize: 13, color: '#dc2626', fontWeight: '500' },
  verifyBtn: { backgroundColor: COLORS.primary, borderRadius: 14, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
