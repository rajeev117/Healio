import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { useLanguage } from '../context/LanguageContext';
// The stand-in code, defined once in env.js. See there for why it exists and
// what has to happen before real verification is possible.
import { TEST_OTP } from '../lib/env';

const OTP_LENGTH = 4;

export default function OtpVerifyModal({ visible, phone, onVerified, onClose }) {
  const { t } = useLanguage();
  const [otpDigits, setOtpDigits] = useState(Array.from({ length: OTP_LENGTH }, () => ''));
  const [errorMsg, setErrorMsg] = useState('');
  const otpRefs = useRef([]);
  const submitting = useRef(false);

  // Reset state each time the modal opens
  useEffect(() => {
    if (visible) {
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      setErrorMsg('');
      submitting.current = false;
      setTimeout(() => otpRefs.current[0]?.focus(), 250);
    }
  }, [visible]);

  const handleChange = (text, i) => {
    const digits = text.replace(/[^0-9]/g, '');
    const next = [...otpDigits];
    setErrorMsg('');

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

  const otp = otpDigits.join('');
  const isComplete = otp.length === OTP_LENGTH;

  const handleVerify = () => {
    if (!isComplete || submitting.current) return;
    if (otp !== TEST_OTP) {
      setErrorMsg(t('otp_err_incorrect', { code: TEST_OTP }));
      setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''));
      otpRefs.current[0]?.focus();
      return;
    }
    submitting.current = true;
    onVerified();
  };

  // Auto-submit when all boxes are filled
  useEffect(() => {
    if (visible && isComplete && !submitting.current) handleVerify();
  }, [otp]);

  const handleResend = () => {
    setOtpDigits(Array.from({ length: OTP_LENGTH }, () => ''));
    setErrorMsg(t('otp_resent', { code: TEST_OTP }));
    otpRefs.current[0]?.focus();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark" size={26} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>{t('otp_title')}</Text>
          <Text style={styles.subtitle}>
            {t('otp_subtitle')}{'\n'}
            <Text style={styles.phoneText}>+91 {phone}</Text>
          </Text>

          <View style={styles.noticeBanner}>
            <Ionicons name="information-circle" size={16} color={COLORS.primary} />
            <Text style={styles.noticeText}>{t('otp_test_notice', { code: TEST_OTP })}</Text>
          </View>

          <View style={styles.otpRow}>
            {otpDigits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(r) => { otpRefs.current[index] = r; }}
                style={[
                  styles.otpBox,
                  digit ? styles.otpBoxFilled : null,
                  errorMsg ? styles.otpBoxError : null,
                ]}
                maxLength={1}
                keyboardType="number-pad"
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                textAlign="center"
                selectionColor={COLORS.primary}
              />
            ))}
          </View>

          {!!errorMsg && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#dc2626" />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.resendText}>
              {t('otp_no_code')} <Text style={styles.resendAction}>{t('otp_resend')}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.verifyBtn, !isComplete && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={!isComplete}
          >
            <Text style={styles.verifyBtnText}>{t('login_verify')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: COLORS.white, borderRadius: 24,
    paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24,
    alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 14, right: 14, zIndex: 1 },
  iconWrap: {
    width: 54, height: 54, borderRadius: 18,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  title: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  subtitle: {
    fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center',
    marginTop: 6, lineHeight: 20,
  },
  phoneText: { fontWeight: '700', color: COLORS.text },
  noticeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.secondary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginTop: 14,
  },
  noticeText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  otpRow: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 4 },
  otpBox: {
    width: 52, height: 56, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    fontSize: 22, fontWeight: '800', color: COLORS.text,
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  otpBoxError: { borderColor: '#dc2626', backgroundColor: '#fff5f5' },
  errorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, paddingHorizontal: 4,
  },
  errorText: { fontSize: 12.5, color: '#dc2626', flex: 1 },
  resendText: { fontSize: 13, color: COLORS.textSecondary, marginTop: 16 },
  resendAction: { color: COLORS.primary, fontWeight: '700' },
  verifyBtn: {
    backgroundColor: COLORS.primary, height: 50, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'stretch', marginTop: 18,
  },
  verifyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
});
