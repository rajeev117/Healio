// ─────────────────────────────────────────────────────────────────────────────
// PaymentAuthorize — step 2 of the placeholder checkout.
//
// The authorisation hand-off each instrument really has: a UPI collect request
// waiting for approval, a 3-D Secure OTP challenge for cards, a bank redirect
// for net banking. All simulated locally — no OTP is sent, no bank is contacted,
// and no credentials are ever asked for.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Animated,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GW } from '../constants/paymentTheme';
import GatewayHeader from '../components/GatewayHeader';
import {
  UPI_APPS, BANKS, MERCHANT, formatInr, formatClock, makeRrn,
} from '../services/PaymentGateway';

const UPI_WINDOW = 60;   // seconds a collect request stays open
const OTP_RESEND = 30;   // seconds before "resend OTP" unlocks

export default function PaymentAuthorize({ navigation, route }) {
  const {
    amount = 0, orderId, method = 'upi', outcome = 'success',
    instrumentLabel = '', upiApp, upiId, bank, cardLast4, cardBrand,
  } = route?.params || {};

  const bankName = BANKS.find((b) => b.id === bank)?.label || 'your bank';
  const appName = UPI_APPS.find((a) => a.id === upiApp)?.label || 'your UPI app';

  const goProcess = () => {
    navigation.replace('PaymentProcessing', {
      amount, orderId, method, outcome, instrumentLabel,
    });
  };

  const cancel = () => {
    Alert.alert(
      'Cancel payment?',
      'The payment has not been authorised yet. Your wallet will not be topped up.',
      [
        { text: 'Continue paying', style: 'cancel' },
        { text: 'Cancel payment', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GatewayHeader amount={amount} orderId={orderId} onClose={cancel} closeIcon="close" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {method === 'upi' && (
          <UpiApproval
            amount={amount}
            appName={appName}
            vpa={upiId}
            onApprove={goProcess}
            onCancel={cancel}
          />
        )}
        {method === 'card' && (
          <CardOtp
            amount={amount}
            brand={cardBrand}
            last4={cardLast4}
            onVerify={goProcess}
            onCancel={cancel}
          />
        )}
        {method === 'netbanking' && (
          <BankRedirect
            amount={amount}
            bankName={bankName}
            onConfirm={goProcess}
            onCancel={cancel}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── UPI: waiting on the collect request ─────────────────────────────────────

function UpiApproval({ amount, appName, vpa, onApprove, onCancel }) {
  const [left, setLeft] = useState(UPI_WINDOW);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s <= 0 ? 0 : s - 1)), 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => { clearInterval(id); loop.stop(); };
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const timedOut = left <= 0;

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.pulseWrap}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
        <View style={styles.pulseCore}>
          <Ionicons
            name={timedOut ? 'time-outline' : 'phone-portrait-outline'}
            size={28}
            color={timedOut ? GW.warning : GW.brand}
          />
        </View>
      </View>

      <Text style={styles.title}>
        {timedOut ? 'Request expired' : 'Approve the payment request'}
      </Text>
      <Text style={styles.body2}>
        {timedOut
          ? 'The collect request timed out before it was approved. No amount was debited.'
          : `We’ve sent a collect request for ₹${formatInr(amount)} to ${vpa ? vpa : appName}. Open ${appName} and approve it to complete this payment.`}
      </Text>

      {!timedOut && (
        <View style={styles.countdownPill}>
          <Ionicons name="time-outline" size={13} color={GW.muted} />
          <Text style={styles.countdownText}>Expires in {formatClock(left)}</Text>
        </View>
      )}

      <View style={styles.infoCard}>
        <InfoRow label="Paying to" value={MERCHANT.displayName} />
        <InfoRow label="UPI ID" value={vpa || `${appName} (linked account)`} />
        <InfoRow label="Amount" value={`₹${formatInr(amount)}`} strong />
      </View>

      <SandboxNote text="Placeholder flow — no request is actually sent to a UPI app." />

      <TouchableOpacity
        style={styles.primaryBtn}
        onPress={timedOut ? onCancel : onApprove}
        activeOpacity={0.9}
      >
        <Text style={styles.primaryBtnText}>
          {timedOut ? 'Try another method' : 'I have approved the request'}
        </Text>
      </TouchableOpacity>
      {!timedOut && (
        <TouchableOpacity style={styles.linkBtn} onPress={onCancel}>
          <Text style={styles.linkBtnText}>Cancel payment</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ─── Card: 3-D Secure challenge ──────────────────────────────────────────────

function CardOtp({ amount, brand, last4, onVerify, onCancel }) {
  const [otp, setOtp] = useState('');
  const [resendIn, setResendIn] = useState(OTP_RESEND);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const reference = useRef(makeRrn()).current;

  useEffect(() => {
    const id = setInterval(() => setResendIn((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const submit = () => {
    if (otp.length !== 6) {
      setError('Enter the 6-digit code to continue.');
      return;
    }
    setError('');
    onVerify();
  };

  return (
    <ScrollView
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.shieldBadge}>
        <Ionicons name="shield-checkmark" size={26} color={GW.brand} />
      </View>
      <Text style={styles.title}>Verify your payment</Text>
      <Text style={styles.body2}>
        Your card issuer needs to confirm this payment. Enter the 6-digit one-time
        code sent to your registered mobile number.
      </Text>

      <View style={styles.infoCard}>
        <InfoRow label="Card" value={`${(brand || 'Card').toUpperCase()} •••• ${last4 || '••••'}`} />
        <InfoRow label="Merchant" value={MERCHANT.displayName} />
        <InfoRow label="Reference" value={reference} />
        <InfoRow label="Amount" value={`₹${formatInr(amount)}`} strong />
      </View>

      <TouchableOpacity
        style={styles.otpRow}
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.otpBox, otp.length === i && styles.otpBoxActive]}>
            <Text style={styles.otpDigit}>{otp[i] ? '•' : ''}</Text>
          </View>
        ))}
        <TextInput
          ref={inputRef}
          style={styles.otpHiddenInput}
          keyboardType="number-pad"
          value={otp}
          maxLength={6}
          caretHidden
          autoFocus
          onChangeText={(v) => { setOtp(v.replace(/\D/g, '')); setError(''); }}
        />
      </TouchableOpacity>
      {!!error && <Text style={styles.otpError}>{error}</Text>}

      <TouchableOpacity disabled={resendIn > 0} onPress={() => setResendIn(OTP_RESEND)}>
        <Text style={[styles.resendText, resendIn > 0 && { color: GW.muted }]}>
          {resendIn > 0 ? `Resend code in ${formatClock(resendIn)}` : 'Resend code'}
        </Text>
      </TouchableOpacity>

      <SandboxNote text="Placeholder flow — no OTP is sent. Any 6 digits will continue." />

      <TouchableOpacity
        style={[styles.primaryBtn, otp.length !== 6 && styles.primaryBtnDisabled]}
        onPress={submit}
        disabled={otp.length !== 6}
        activeOpacity={0.9}
      >
        <Ionicons name="lock-closed" size={15} color={GW.card} />
        <Text style={styles.primaryBtnText}>Verify & pay ₹{formatInr(amount)}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkBtn} onPress={onCancel}>
        <Text style={styles.linkBtnText}>Cancel payment</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Net banking: redirect + confirm ─────────────────────────────────────────

function BankRedirect({ amount, bankName, onConfirm, onCancel }) {
  const [redirecting, setRedirecting] = useState(true);
  const reference = useRef(makeRrn()).current;

  useEffect(() => {
    const id = setTimeout(() => setRedirecting(false), 1600);
    return () => clearTimeout(id);
  }, []);

  if (redirecting) {
    return (
      <View style={[styles.body, styles.centered]}>
        <ActivityIndicator size="large" color={GW.brand} />
        <Text style={[styles.title, { marginTop: 18 }]}>Connecting to {bankName}</Text>
        <Text style={styles.body2}>
          Please don’t press back or close the app while we take you to your bank’s
          secure page.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.bankBar}>
        <View style={styles.bankBarMark}>
          <Ionicons name="business" size={16} color={GW.card} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bankBarName}>{bankName}</Text>
          <Text style={styles.bankBarSub}>Secure NetBanking</Text>
        </View>
        <Ionicons name="lock-closed" size={14} color={GW.muted} />
      </View>

      <Text style={styles.title}>Confirm this payment</Text>
      <Text style={styles.body2}>
        Review the details below and confirm to authorise the debit from your account.
      </Text>

      <View style={styles.infoCard}>
        <InfoRow label="Account" value="XXXXXX4412 · Savings" />
        <InfoRow label="Payee" value={MERCHANT.legalName} />
        <InfoRow label="Reference" value={reference} />
        <InfoRow label="Amount" value={`₹${formatInr(amount)}`} strong />
      </View>

      <SandboxNote text="Placeholder flow — no bank is contacted and no login is required." />

      <TouchableOpacity style={styles.primaryBtn} onPress={onConfirm} activeOpacity={0.9}>
        <Ionicons name="lock-closed" size={15} color={GW.card} />
        <Text style={styles.primaryBtnText}>Confirm payment</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkBtn} onPress={onCancel}>
        <Text style={styles.linkBtnText}>Cancel payment</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function InfoRow({ label, value, strong }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong && styles.infoValueStrong]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SandboxNote({ text }) {
  return (
    <View style={styles.sandboxNote}>
      <Ionicons name="flask-outline" size={13} color={GW.muted} />
      <Text style={styles.sandboxNoteText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GW.page },
  body: { padding: 20, paddingBottom: 32, alignItems: 'center' },
  centered: { flex: 1, justifyContent: 'center' },

  pulseWrap: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  pulseRing: {
    position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: GW.brand,
  },
  pulseCore: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: GW.brandSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: GW.line,
  },
  shieldBadge: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: GW.brandSoft,
    alignItems: 'center', justifyContent: 'center', marginTop: 18,
    borderWidth: 1, borderColor: GW.line,
  },

  title: { fontSize: 18, fontWeight: '800', color: GW.text, marginTop: 16, textAlign: 'center' },
  body2: {
    fontSize: 13, color: GW.muted, textAlign: 'center', lineHeight: 19,
    marginTop: 8, maxWidth: 320,
  },

  countdownPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: GW.card, borderWidth: 1, borderColor: GW.line,
  },
  countdownText: { fontSize: 11.5, fontWeight: '700', color: GW.muted },

  infoCard: {
    width: '100%', backgroundColor: GW.card, borderRadius: 14,
    borderWidth: 1, borderColor: GW.line, padding: 14, marginTop: 20,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 6 },
  infoLabel: { fontSize: 12, color: GW.muted },
  infoValue: { flex: 1, fontSize: 12.5, fontWeight: '700', color: GW.text, textAlign: 'right' },
  infoValueStrong: { fontSize: 15, color: GW.brand, fontWeight: '800' },

  otpRow: { flexDirection: 'row', gap: 9, marginTop: 22 },
  otpBox: {
    width: 42, height: 50, borderRadius: 10, borderWidth: 1.5, borderColor: GW.line,
    backgroundColor: GW.card, alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: { borderColor: GW.brand },
  otpDigit: { fontSize: 24, fontWeight: '800', color: GW.text, lineHeight: 28 },
  otpHiddenInput: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0, color: 'transparent',
  },
  otpError: { fontSize: 11.5, color: GW.error, fontWeight: '600', marginTop: 8 },
  resendText: { fontSize: 12, fontWeight: '700', color: GW.brand, marginTop: 14 },

  bankBar: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: GW.card, borderRadius: 12, borderWidth: 1, borderColor: GW.line,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 4,
  },
  bankBarMark: {
    width: 32, height: 32, borderRadius: 9, backgroundColor: GW.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  bankBarName: { fontSize: 13.5, fontWeight: '800', color: GW.text },
  bankBarSub: { fontSize: 10.5, color: GW.muted, marginTop: 1, fontWeight: '600' },

  sandboxNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9,
    backgroundColor: GW.card, borderWidth: 1, borderColor: GW.line,
  },
  sandboxNoteText: { fontSize: 10.5, color: GW.muted, fontWeight: '600', flexShrink: 1 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', backgroundColor: GW.brand, borderRadius: 13,
    paddingVertical: 15, marginTop: 22,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: GW.card, fontWeight: '800', fontSize: 15 },
  linkBtn: { paddingVertical: 14 },
  linkBtnText: { color: GW.muted, fontWeight: '700', fontSize: 12.5 },
});
