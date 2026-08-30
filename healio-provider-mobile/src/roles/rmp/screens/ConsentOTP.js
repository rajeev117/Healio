import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { getService } from '../constants/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { CustomButton } from '../components/CustomButton';

const OTP_LENGTH = 6;

export default function ConsentOTP({ navigation, route }) {
  const { patient } = route.params;
  // Consent is per service: a doctor consultation goes straight to the doctor
  // list, everything else picks the lab / pharmacy / hospital first.
  const service = getService(route.params?.service);
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [resendIn, setResendIn] = useState(24);
  const inputs = useRef([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const handleChange = (value, index) => {
    const next = [...digits];
    next[index] = value.replace(/[^0-9]/g, '').slice(-1);
    setDigits(next);
    if (next[index] && index < OTP_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = ({ nativeEvent }, index) => {
    if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const filled = digits.every(d => d !== '');

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Patient Consent" onBack={() => navigation.goBack()} />
      <View style={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Consent required</Text>
          <Text style={styles.infoBody}>
            A 6-digit OTP was sent to the patient's number to confirm consent for {service.consentNote} on Healio.
          </Text>
        </View>

        <Text style={styles.verifyTitle}>Verify OTP</Text>
        <Text style={styles.sentTo}>Sent to {patient.phone}</Text>

        <View style={styles.otpRow}>
          {digits.map((digit, i) => (
            <TextInput
              key={i}
              ref={ref => { inputs.current[i] = ref; }}
              style={[styles.otpBox, digit !== '' && styles.otpBoxFilled]}
              value={digit}
              onChangeText={value => handleChange(value, i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive OTP?</Text>
          <Text style={styles.resendTimer}>
            {resendIn > 0 ? `Resend in 0:${String(resendIn).padStart(2, '0')}` : 'Resend OTP'}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        {/* Via the "who is this for?" step — it forwards to service.afterConsent,
            skipping itself when the patient has no family members. */}
        <CustomButton
          title="Verify & Continue"
          disabled={!filled}
          onPress={() => navigation.navigate('SelectPatientProfile', { patient, service: service.key })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  infoCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 16,
    marginTop: 26,
  },
  infoTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
  infoBody: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 7, lineHeight: 17 },
  verifyTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 28 },
  sentTo: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  otpRow: { flexDirection: 'row', gap: 10, marginTop: 26 },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  resendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 22 },
  resendLabel: { fontSize: 13, color: COLORS.textSecondary },
  resendTimer: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
