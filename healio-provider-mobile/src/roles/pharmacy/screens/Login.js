import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform, Alert, KeyboardAvoidingView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';

const OTP_LENGTH = 4;

function OtpScreen({ phone, onBack, onVerify, loading }) {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputs = useRef([]);

  useEffect(() => {
    if (countdown === 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleResend = () => {
    if (!canResend) return;
    setDigits(Array(OTP_LENGTH).fill(''));
    setCountdown(30);
    setCanResend(false);
    inputs.current[0]?.focus();
  };

  const handleChange = (text, index) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) {
      Alert.alert('Incomplete OTP', 'Please enter all 4 digits.');
      return;
    }
    onVerify(otp);
  };

  return (
    <KeyboardAvoidingView
      style={styles.otpScreen}
      behavior="padding"
    >
      <SafeAreaView style={styles.otpSafe}>
        <View style={styles.otpContent}>
          <TouchableOpacity style={styles.otpBackBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.otpTitle}>Verify OTP</Text>
          <Text style={styles.otpSub}>Sent to +91 {phone}</Text>

          <View style={styles.boxRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={el => (inputs.current[i] = el)}
                style={[
                  styles.otpBox,
                  d ? styles.otpBoxFilled : styles.otpBoxEmpty,
                  i === digits.findIndex(x => x === '') && styles.otpBoxActive,
                ]}
                value={d}
                onChangeText={t => handleChange(t, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={i === 0}
              />
            ))}
          </View>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>Didn't receive OTP? </Text>
            <TouchableOpacity onPress={handleResend} disabled={!canResend}>
              <Text style={[styles.resendLink, !canResend && styles.resendCountdown]}>
                {canResend ? 'Resend' : `Resend in ${countdown}s`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.otpBtnContainer}>
          <TouchableOpacity
            style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.verifyBtnText}>Verify</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export default function Login({ navigation }) {
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = () => {
    if (phone.length < 10) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep('otp');
    }, 1000);
  };

  const handleVerifyOtp = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigation.replace('Main');
    }, 1200);
  };

  if (step === 'otp') {
    return (
      <OtpScreen
        phone={phone}
        onBack={() => setStep('phone')}
        onVerify={handleVerifyOtp}
        loading={loading}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Pharmacy Portal</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardSub}>Enter your registered mobile number to manage prescriptions and earnings</Text>
        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+91</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="Mobile number"
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
          />
        </View>
        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.7 }]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.btnText}>Send OTP</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>For registered hospital pharmacies only</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  header: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 40 : 60,
    paddingBottom: 40,
  },
  logo: { width: 120, height: 120, marginBottom: 8 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    flex: 1,
    padding: SPACING.l,
    paddingTop: SPACING.xl,
  },
  cardTitle: { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  cardSub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.l, lineHeight: 20 },
  phoneRow: { flexDirection: 'row', marginBottom: SPACING.m, gap: 10 },
  countryCode: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  countryCodeText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: SPACING.m,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
    height: 52,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radius,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    paddingBottom: 20,
  },

  otpScreen: { flex: 1, backgroundColor: COLORS.white },
  otpSafe: { flex: 1, backgroundColor: COLORS.white },
  otpContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 24 : 48,
  },
  otpBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  otpTitle: { fontSize: 28, fontWeight: '900', color: COLORS.text, marginBottom: 8 },
  otpSub: { fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.xl * 1.5 },
  boxRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  otpBox: {
    width: 56,
    height: 64,
    borderRadius: 14,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: COLORS.text,
    borderWidth: 2,
  },
  otpBoxEmpty: { backgroundColor: COLORS.surface, borderColor: COLORS.surface },
  otpBoxFilled: { backgroundColor: COLORS.white, borderColor: COLORS.primary },
  otpBoxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  resendRow: { flexDirection: 'row', alignItems: 'center' },
  resendText: { fontSize: 15, color: COLORS.textSecondary },
  resendLink: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  resendCountdown: { color: COLORS.primary },
  otpBtnContainer: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 36 : 28,
  },
  verifyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '800' },
});
