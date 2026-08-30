// ─────────────────────────────────────────────────────────────────────────────
// PaymentProcessing — final step of the placeholder checkout.
//
// Runs the settlement steps a real gateway reports, then shows the terminal
// state: a receipt on capture, or a decline card with a reason code. What gets
// settled depends on `purpose`:
//   topup       → the wallet is credited
//   order       → the pharmacy / lab invoice is accepted, confirming the order
//   appointment → the appointment request is created
// Wallet payments debit the balance; cash payments move no money at all and
// simply confirm, with the amount collected in person.
//
// Back navigation is blocked while in flight, exactly as a hosted page would.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GW } from '../constants/paymentTheme';
import { useWallet } from '../context/WalletContext';
import { ApiService } from '../services/ApiService';
import { acceptInvoice } from '../../../lib/orderRequests';
import {
  MERCHANT, PROCESSING_STEPS, authorize, formatInr, makePaymentId,
} from '../services/PaymentGateway';

const METHOD_LABELS = {
  upi: 'UPI',
  card: 'Credit / Debit Card',
  netbanking: 'Net Banking',
  wallet: 'Healio Wallet',
  cash: 'Cash',
};

const CASH_STEPS = ['Confirming with the provider'];
const WALLET_STEPS = ['Checking wallet balance', 'Debiting Healio Wallet', 'Confirming'];
const STEP_MS = 850;

export default function PaymentProcessing({ navigation, route }) {
  const {
    amount = 0, orderId, method = 'upi', outcome = 'success', instrumentLabel = '',
    purpose = { type: 'topup', label: 'Healio Wallet top-up' },
  } = route?.params || {};
  const { balance, addBalance, deductBalance } = useWallet();

  const isCash = method === 'cash';
  const isWallet = method === 'wallet';
  const steps = isCash ? CASH_STEPS : isWallet ? WALLET_STEPS : PROCESSING_STEPS;
  const stepMs = isCash ? 700 : STEP_MS;

  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null); // { status, paymentId, rrn, code, message }
  const progress = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.7)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const settled = useRef(false);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  // Apply whatever this payment was for. Anything that can genuinely fail
  // (a slot taken in the meantime) turns into a declined result.
  const settle = useCallback(async (res) => {
    const methodLabel = METHOD_LABELS[method] || 'gateway';

    if (purpose.type === 'topup') {
      // The local balance updates synchronously inside addBalance; the ledger
      // write is given a moment to land so the receipt and the wallet's
      // transaction list agree, but never holds the receipt hostage.
      const credit = addBalance(amount, {
        method,
        description: `Wallet top-up via ${methodLabel}`,
      });
      await Promise.race([credit, new Promise((r) => setTimeout(r, 1500))]);
      return res;
    }

    // Book first, charge second — a slot lost at the last moment must not leave
    // the patient debited.
    if (purpose.type === 'appointment') {
      try {
        await ApiService.addAppointment({
          ...purpose.appointment,
          paymentMethod: method,
          paymentStatus: isCash ? 'pay_at_visit' : 'paid',
        });
      } catch (e) {
        const message =
          e?.code === 'DUPLICATE' ? 'You already have an appointment in this slot.'
          : e?.code === 'SLOT_FULL' ? 'That slot filled up while you were paying.'
          // The doctor changed their schedule between checkout and confirmation.
          : ['SLOT_BLOCKED', 'ON_LEAVE', 'OUTSIDE_SCHEDULE', 'SLOT_PAST'].includes(e?.code)
            ? (e.message || 'That slot is no longer available.')
          : 'The appointment could not be created. Please try again.';
        return { status: 'failed', code: e?.code || 'BOOKING_FAILED', message };
      }
    }

    if (purpose.type === 'order') {
      await acceptInvoice(purpose.requestId, {
        method,
        cash: isCash,
        paymentId: res.paymentId || null,
      });
    }

    // Cash is collected in person, so it moves no money here.
    if (isWallet) {
      deductBalance(amount, {
        description: purpose.label || 'Healio payment',
        referenceType: purpose.referenceType || null,
      });
    }
    return res;
  }, [purpose, method, amount, isCash, isWallet, addBalance, deductBalance]);

  // Step ticker + authorisation, resolved together so the progress never
  // finishes before the gateway answers.
  useEffect(() => {
    let cancelled = false;
    const timers = steps.map((_, i) =>
      setTimeout(() => { if (!cancelled) setStep(i); }, i * stepMs)
    );
    Animated.timing(progress, {
      toValue: 1,
      duration: steps.length * stepMs,
      useNativeDriver: false,
    }).start();

    // Cash and wallet never touch the gateway — they are captured by definition.
    const authorization = (isCash || isWallet)
      ? Promise.resolve({ status: 'captured', paymentId: makePaymentId(), rrn: null })
      : authorize({ outcome });

    const minimum = new Promise((r) => setTimeout(r, steps.length * stepMs));
    Promise.all([authorization, minimum]).then(async ([res]) => {
      if (cancelled || settled.current) return;
      settled.current = true;
      const final = res.status === 'captured' ? await settle(res) : res;
      setResult(final);
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    });

    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A payment in flight must not be interrupted.
  const inFlight = !result;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => inFlight);
    return () => sub.remove();
  }, [inFlight]);
  useEffect(
    () => navigation.addListener('beforeRemove', (e) => { if (inFlight) e.preventDefault(); }),
    [navigation, inFlight]
  );

  // popTo unwinds the whole checkout, so nothing is left sitting on top of a
  // finished payment. Where "done" lands depends on what was paid for.
  const done = useCallback(() => {
    const captured = result?.status === 'captured';
    if (purpose.type === 'order') {
      const params = { requestId: purpose.requestId };
      if (navigation.popTo) navigation.popTo('OrderApproval', params);
      else navigation.navigate('OrderApproval', params);
      return;
    }
    if (purpose.type === 'appointment') {
      navigation.navigate('Main', { screen: 'Appointments' });
      return;
    }
    const params = { toppedUp: captured ? amount : 0 };
    if (navigation.popTo) navigation.popTo('Wallet', params);
    else navigation.navigate('Wallet', params);
  }, [navigation, amount, result, purpose]);

  const retry = useCallback(() => {
    if (navigation.popTo) navigation.popTo('PayGateway', { amount });
    else navigation.navigate('PayGateway', { amount });
  }, [navigation, amount]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] });
  const stamp = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // ─── In flight ─────────────────────────────────────────────────────────────
  if (!result) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.processWrap}>
          <View style={styles.spinnerBadge}>
            <Animated.View style={{
              transform: [{
                rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
              }],
            }}>
              <Ionicons name="sync" size={26} color={GW.brand} />
            </Animated.View>
          </View>
          <Text style={styles.processTitle}>
            {isCash ? 'Confirming your order' : 'Processing your payment'}
          </Text>
          <Text style={styles.processAmount}>₹{formatInr(amount)}</Text>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width }]} />
          </View>

          <View style={styles.stepList}>
            {steps.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <View key={label} style={styles.stepRow}>
                  <View style={[
                    styles.stepDot,
                    done && styles.stepDotDone,
                    active && styles.stepDotActive,
                  ]}>
                    {done && <Ionicons name="checkmark" size={11} color={GW.card} />}
                  </View>
                  <Text style={[styles.stepText, (done || active) && styles.stepTextOn]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.warnRow}>
            <Ionicons name="alert-circle-outline" size={14} color={GW.muted} />
            <Text style={styles.warnText}>
              {isCash
                ? 'Do not press back or close the app while we confirm your order.'
                : 'Do not press back or close the app while the payment is in progress.'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Declined ──────────────────────────────────────────────────────────────
  if (result.status !== 'captured') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.resultWrap} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.resultBadge, styles.failBadge, { transform: [{ scale: pop }] }]}>
            <Ionicons name="close" size={38} color={GW.card} />
          </Animated.View>
          <Text style={styles.resultTitle}>Payment failed</Text>
          <Text style={styles.resultSub}>{result.message}</Text>

          <View style={styles.receipt}>
            <Row label="Amount" value={`₹${formatInr(amount)}`} />
            <Row label="Order ID" value={orderId} />
            <Row label="Method" value={instrumentLabel || METHOD_LABELS[method]} />
            <Row label="Reason code" value={result.code} />
            <Row label="Attempted on" value={stamp} />
          </View>

          <Text style={styles.reassure}>
            No amount has been debited. If money was deducted, it will be reversed by
            your bank within 3–5 working days.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={retry} activeOpacity={0.9}>
            <Ionicons name="refresh" size={16} color={GW.card} />
            <Text style={styles.primaryBtnText}>Retry payment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={done}>
            <Text style={styles.linkBtnText}>
              {purpose.type === 'topup' ? 'Back to wallet' : 'Go back'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Captured ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.resultWrap} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.resultBadge, styles.okBadge, { transform: [{ scale: pop }] }]}>
          <Ionicons name="checkmark" size={40} color={GW.card} />
        </Animated.View>
        <Text style={styles.resultTitle}>
          {isCash
            ? (purpose.type === 'appointment' ? 'Booking confirmed' : 'Order confirmed')
            : 'Payment successful'}
        </Text>
        <Text style={styles.resultAmount}>₹{formatInr(amount)}</Text>
        <Text style={styles.resultSub}>
          {isCash
            ? `to be paid in cash · ${instrumentLabel || 'pay on arrival'}`
            : purpose.type === 'topup'
              ? 'added to your Healio Wallet'
              : purpose.label || 'paid'}
        </Text>

        <View style={styles.receipt}>
          <Text style={styles.receiptHead}>{isCash ? 'Confirmation' : 'Receipt'}</Text>
          {!isCash && <Row label="Payment ID" value={result.paymentId} />}
          <Row label="Order ID" value={orderId} />
          {!!result.rrn && <Row label="Bank reference" value={result.rrn} />}
          <Row label={isCash ? 'Payable to' : 'Paid to'} value={purpose.merchantName || MERCHANT.legalName} />
          <Row label="Method" value={instrumentLabel || METHOD_LABELS[method]} />
          <Row label="Date & time" value={stamp} />
          <View style={styles.receiptDivider} />
          <View style={styles.statusRow}>
            <Text style={styles.rowLabel}>Status</Text>
            <View style={[styles.statusPill, isCash && styles.statusPillCash]}>
              <Ionicons
                name={isCash ? 'cash-outline' : 'checkmark-circle'}
                size={12}
                color={isCash ? GW.warning : GW.success}
              />
              <Text style={[styles.statusPillText, isCash && { color: GW.warning }]}>
                {isCash ? 'Cash due' : 'Captured'}
              </Text>
            </View>
          </View>
        </View>

        {(purpose.type === 'topup' || isWallet) && (
          <View style={styles.balanceCard}>
            <Ionicons name="wallet" size={18} color={GW.brand} />
            <Text style={styles.balanceLabel}>Updated wallet balance</Text>
            <Text style={styles.balanceValue}>₹{formatInr(balance)}</Text>
          </View>
        )}

        {isCash && (
          <View style={styles.cashNote}>
            <Ionicons name="information-circle-outline" size={14} color={GW.muted} />
            <Text style={styles.cashNoteText}>
              Keep ₹{formatInr(amount)} ready — the amount is collected in person. No
              online payment was taken.
            </Text>
          </View>
        )}

        {!isCash && (
          <View style={styles.testStrip}>
            <Ionicons name="flask-outline" size={12} color={GW.muted} />
            <Text style={styles.testStripText}>
              Test-mode transaction — recorded for demo purposes, no real money moved.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.primaryBtn} onPress={done} activeOpacity={0.9}>
          <Text style={styles.primaryBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GW.page },

  processWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  spinnerBadge: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: GW.brandSoft,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: GW.line,
  },
  processTitle: { fontSize: 17, fontWeight: '800', color: GW.text, marginTop: 16 },
  processAmount: { fontSize: 30, fontWeight: '800', color: GW.brand, marginTop: 4 },
  progressTrack: {
    width: '100%', height: 5, borderRadius: 3, backgroundColor: GW.line,
    marginTop: 22, overflow: 'hidden',
  },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: GW.brand },

  stepList: { width: '100%', marginTop: 22, gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot: {
    width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: GW.line,
    backgroundColor: GW.card, alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { borderColor: GW.brand },
  stepDotDone: { backgroundColor: GW.success, borderColor: GW.success },
  stepText: { fontSize: 13, color: GW.muted },
  stepTextOn: { color: GW.text, fontWeight: '700' },

  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 28, paddingHorizontal: 6 },
  warnText: { flex: 1, fontSize: 11.5, color: GW.muted, lineHeight: 16 },

  resultWrap: { padding: 20, paddingTop: 34, paddingBottom: 36, alignItems: 'center' },
  resultBadge: {
    width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center',
  },
  okBadge: { backgroundColor: GW.success },
  failBadge: { backgroundColor: GW.error },
  resultTitle: { fontSize: 19, fontWeight: '800', color: GW.text, marginTop: 16 },
  resultAmount: { fontSize: 34, fontWeight: '800', color: GW.text, marginTop: 6 },
  resultSub: {
    fontSize: 13, color: GW.muted, marginTop: 6, textAlign: 'center',
    lineHeight: 18, maxWidth: 300,
  },

  receipt: {
    width: '100%', backgroundColor: GW.card, borderRadius: 14, borderWidth: 1,
    borderColor: GW.line, padding: 14, marginTop: 22,
  },
  receiptHead: {
    fontSize: 10.5, fontWeight: '800', color: GW.muted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
  },
  receiptDivider: { height: 1, backgroundColor: GW.line, marginVertical: 9 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 5 },
  rowLabel: { fontSize: 12, color: GW.muted },
  rowValue: { flex: 1, fontSize: 12, fontWeight: '700', color: GW.text, textAlign: 'right' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: GW.successSoft, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  statusPillText: { fontSize: 11, fontWeight: '800', color: GW.success },
  statusPillCash: { backgroundColor: GW.warningSoft },
  cashNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 12,
    paddingHorizontal: 11, paddingVertical: 10, borderRadius: 10,
    backgroundColor: GW.warningSoft, width: '100%',
  },
  cashNoteText: { flex: 1, fontSize: 11.5, color: GW.text, lineHeight: 16 },

  balanceCard: {
    width: '100%', flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: GW.brandSoft, borderRadius: 12, padding: 13, marginTop: 12,
  },
  balanceLabel: { flex: 1, fontSize: 12.5, fontWeight: '700', color: GW.text },
  balanceValue: { fontSize: 15, fontWeight: '800', color: GW.brand },

  testStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9,
    borderWidth: 1, borderColor: GW.line, backgroundColor: GW.card,
  },
  testStripText: { flex: 1, fontSize: 10.5, color: GW.muted, fontWeight: '600', lineHeight: 14 },

  reassure: {
    fontSize: 11.5, color: GW.muted, textAlign: 'center', lineHeight: 16.5,
    marginTop: 14, maxWidth: 320,
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', backgroundColor: GW.brand, borderRadius: 13,
    paddingVertical: 15, marginTop: 22,
  },
  primaryBtnText: { color: GW.card, fontWeight: '800', fontSize: 15 },
  linkBtn: { paddingVertical: 14 },
  linkBtnText: { color: GW.muted, fontWeight: '700', fontSize: 12.5 },
});
