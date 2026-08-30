// ─────────────────────────────────────────────────────────────────────────────
// PayGateway — instrument selection for every payment the patient makes:
// wallet top-ups, doctor bookings, medicine orders and lab bookings.
//
// Step 1 of the placeholder checkout: pick the method, enter the instrument,
// review the amount. Nothing entered here is stored or transmitted — see
// services/PaymentGateway.js. What the payment is *for* comes in as `purpose`,
// and PaymentProcessing settles it once the payment is captured.
//
// route.params:
//   amount      number
//   purpose     { type: 'topup' | 'order' | 'appointment', label, ...payload }
//   allowWallet pay from the Healio Wallet balance
//   allowCash   pay in cash later — confirms straight away, no gateway
//   cashLabel   wording for the cash option, e.g. 'Pay cash on delivery'
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GW } from '../constants/paymentTheme';
import GatewayHeader from '../components/GatewayHeader';
import { useWallet } from '../context/WalletContext';
import {
  UPI_APPS, BANKS, CARD_BRANDS, SESSION_SECONDS,
  makeOrderId, detectCardBrand, formatCardNumber, formatExpiry, expiryValid,
  luhnValid, upiIdValid, maskCard, formatInr,
} from '../services/PaymentGateway';

const GATEWAY_METHODS = [
  { id: 'upi',        label: 'UPI',         icon: 'phone-portrait-outline' },
  { id: 'card',       label: 'Card',        icon: 'card-outline' },
  { id: 'netbanking', label: 'Net Banking', icon: 'business-outline' },
];

const WALLET_METHOD = { id: 'wallet', label: 'Wallet', icon: 'wallet-outline' };
const CASH_METHOD   = { id: 'cash',   label: 'Cash',   icon: 'cash-outline' };

export default function PayGateway({ navigation, route }) {
  const amount = Number(route?.params?.amount) || 0;
  const purpose = route?.params?.purpose || { type: 'topup', label: 'Healio Wallet top-up' };
  const allowWallet = !!route?.params?.allowWallet;
  const allowCash = !!route?.params?.allowCash;
  const cashLabel = route?.params?.cashLabel || 'Pay in cash';
  const orderId = useMemo(() => makeOrderId(), []);
  const { balance } = useWallet();

  const METHODS = useMemo(() => [
    ...(allowWallet ? [WALLET_METHOD] : []),
    ...GATEWAY_METHODS,
    ...(allowCash ? [CASH_METHOD] : []),
  ], [allowWallet, allowCash]);

  const [method, setMethod] = useState(allowWallet ? 'wallet' : 'upi');
  const [upiApp, setUpiApp] = useState(null);
  const [upiId, setUpiId] = useState('');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [bank, setBank] = useState(null);
  const [saveInstrument, setSaveInstrument] = useState(true);
  const [outcome, setOutcome] = useState('success');
  const [showSandbox, setShowSandbox] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SESSION_SECONDS);

  // Hosted-checkout style session timeout.
  const expired = secondsLeft <= 0;
  const tick = useRef();
  useEffect(() => {
    tick.current = setInterval(() => setSecondsLeft((s) => (s <= 0 ? 0 : s - 1)), 1000);
    return () => clearInterval(tick.current);
  }, []);
  useEffect(() => { if (expired) clearInterval(tick.current); }, [expired]);

  const brand = detectCardBrand(card.number);
  const cardDigits = card.number.replace(/\D/g, '');

  const walletShort = balance < amount;

  const ready = (() => {
    if (method === 'wallet') return !walletShort;
    if (method === 'cash') return true;
    if (method === 'upi') return !!upiApp || upiIdValid(upiId);
    if (method === 'card') {
      return luhnValid(cardDigits)
        && card.name.trim().length >= 3
        && expiryValid(card.expiry)
        && card.cvv.length >= 3;
    }
    return !!bank;
  })();

  const instrumentLabel = (() => {
    if (method === 'wallet') return 'Healio Wallet';
    if (method === 'cash') return cashLabel;
    if (method === 'upi') {
      if (upiApp) return UPI_APPS.find((a) => a.id === upiApp)?.label || 'UPI';
      return upiId.trim();
    }
    if (method === 'card') {
      return `${CARD_BRANDS[brand].label} ${maskCard(cardDigits)}`;
    }
    return BANKS.find((b) => b.id === bank)?.label || 'Net Banking';
  })();

  const isTopUp = purpose.type === 'topup';

  const cancel = () => {
    Alert.alert(
      'Cancel payment?',
      isTopUp
        ? 'Your wallet will not be topped up if you leave now.'
        : 'This payment will not go through and nothing will be confirmed.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Cancel payment', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  const proceed = () => {
    if (!ready || expired) return;
    const common = { amount, orderId, method, outcome, instrumentLabel, purpose };
    // Wallet and cash need no gateway authorisation — straight to settlement.
    if (method === 'wallet' || method === 'cash') {
      navigation.navigate('PaymentProcessing', { ...common, outcome: 'success' });
      return;
    }
    navigation.navigate('PaymentAuthorize', {
      ...common,
      upiApp,
      upiId: upiId.trim(),
      bank,
      cardLast4: cardDigits.slice(-4),
      cardBrand: brand,
    });
  };

  const setCardField = (key) => (value) => setCard((c) => ({ ...c, [key]: value }));

  if (expired) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <GatewayHeader amount={amount} orderId={orderId} onClose={() => navigation.goBack()} />
        <View style={styles.expiredWrap}>
          <View style={styles.expiredIcon}>
            <Ionicons name="time-outline" size={30} color={GW.warning} />
          </View>
          <Text style={styles.expiredTitle}>Payment session expired</Text>
          <Text style={styles.expiredBody}>
            For your security this checkout session timed out. No amount was debited.
            Start again to top up your wallet.
          </Text>
          <TouchableOpacity style={styles.expiredBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.expiredBtnText}>Start again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GatewayHeader amount={amount} orderId={orderId} secondsLeft={secondsLeft} onClose={cancel} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Method switcher ─────────────────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {METHODS.map((m) => {
              const active = method === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setMethod(m.id)}
                  activeOpacity={0.85}
                >
                  <Ionicons name={m.icon} size={17} color={active ? GW.brand : GW.muted} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ─── Healio Wallet ───────────────────────────────────────────── */}
          {method === 'wallet' && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Pay from Healio Wallet</Text>
              <View style={styles.walletRow}>
                <View style={styles.walletIcon}>
                  <Ionicons name="wallet" size={20} color={GW.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletLabel}>Available balance</Text>
                  <Text style={[styles.walletValue, walletShort && { color: GW.error }]}>
                    ₹{formatInr(balance)}
                  </Text>
                </View>
                {!walletShort && (
                  <Ionicons name="checkmark-circle" size={20} color={GW.success} />
                )}
              </View>
              {walletShort ? (
                <>
                  <Text style={styles.errorText}>
                    Short by ₹{formatInr(amount - balance)} for this payment.
                  </Text>
                  <TouchableOpacity
                    style={styles.topUpBtn}
                    onPress={() => navigation.navigate('Wallet')}
                  >
                    <Ionicons name="add-circle-outline" size={15} color={GW.brand} />
                    <Text style={styles.topUpBtnText}>Top up wallet</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.hint}>
                  ₹{formatInr(amount)} will be debited instantly. Balance after payment:
                  ₹{formatInr(balance - amount)}.
                </Text>
              )}
            </View>
          )}

          {/* ─── Cash ────────────────────────────────────────────────────── */}
          {method === 'cash' && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{cashLabel}</Text>
              <View style={styles.walletRow}>
                <View style={styles.walletIcon}>
                  <Ionicons name="cash-outline" size={20} color={GW.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.walletLabel}>Amount due in cash</Text>
                  <Text style={styles.walletValue}>₹{formatInr(amount)}</Text>
                </View>
              </View>
              <Text style={styles.hint}>
                Nothing is charged online. Confirming now reserves it, and you pay the
                exact amount in cash. Please keep change handy.
              </Text>
            </View>
          )}

          {/* ─── UPI ─────────────────────────────────────────────────────── */}
          {method === 'upi' && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Pay by any UPI app</Text>
              <View style={styles.appGrid}>
                {UPI_APPS.map((app) => {
                  const active = upiApp === app.id;
                  return (
                    <TouchableOpacity
                      key={app.id}
                      style={[styles.appTile, active && styles.appTileActive]}
                      onPress={() => { setUpiApp(active ? null : app.id); setUpiId(''); }}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.appMark, active && styles.appMarkActive]}>
                        <Text style={[styles.appMarkText, active && { color: GW.card }]}>
                          {app.label.slice(0, 1)}
                        </Text>
                      </View>
                      <Text style={styles.appLabel} numberOfLines={1}>{app.label}</Text>
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or enter UPI ID</Text>
                <View style={styles.orLine} />
              </View>

              <View style={[styles.field, upiId.length > 0 && !upiIdValid(upiId) && styles.fieldError]}>
                <TextInput
                  style={styles.input}
                  placeholder="yourname@bank"
                  placeholderTextColor={GW.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={upiId}
                  onChangeText={(v) => { setUpiId(v); if (v) setUpiApp(null); }}
                />
                {upiIdValid(upiId) && (
                  <Ionicons name="checkmark-circle" size={18} color={GW.success} />
                )}
              </View>
              {upiId.length > 0 && !upiIdValid(upiId) && (
                <Text style={styles.errorText}>Enter a valid UPI ID, e.g. name@okhdfc</Text>
              )}
              <Text style={styles.hint}>
                You will get a collect request to approve in your UPI app.
              </Text>
            </View>
          )}

          {/* ─── Card ────────────────────────────────────────────────────── */}
          {method === 'card' && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Card details</Text>

              <Text style={styles.label}>Card number</Text>
              <View style={[styles.field, cardDigits.length >= 12 && !luhnValid(cardDigits) && styles.fieldError]}>
                <Ionicons name="card-outline" size={18} color={GW.muted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor={GW.muted}
                  keyboardType="number-pad"
                  value={card.number}
                  maxLength={19}
                  onChangeText={(v) => setCardField('number')(formatCardNumber(v))}
                />
                {cardDigits.length >= 2 && (
                  <View style={styles.brandChip}>
                    <Text style={styles.brandChipText}>{CARD_BRANDS[brand].label}</Text>
                  </View>
                )}
              </View>
              {cardDigits.length >= 12 && !luhnValid(cardDigits) && (
                <Text style={styles.errorText}>This card number doesn’t look right.</Text>
              )}

              <Text style={styles.label}>Name on card</Text>
              <View style={styles.field}>
                <TextInput
                  style={styles.input}
                  placeholder="As printed on the card"
                  placeholderTextColor={GW.muted}
                  autoCapitalize="characters"
                  value={card.name}
                  onChangeText={setCardField('name')}
                />
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Expiry</Text>
                  <View style={[styles.field, card.expiry.length === 5 && !expiryValid(card.expiry) && styles.fieldError]}>
                    <TextInput
                      style={styles.input}
                      placeholder="MM/YY"
                      placeholderTextColor={GW.muted}
                      keyboardType="number-pad"
                      value={card.expiry}
                      maxLength={5}
                      onChangeText={(v) => setCardField('expiry')(formatExpiry(v))}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>CVV</Text>
                  <View style={styles.field}>
                    <TextInput
                      style={styles.input}
                      placeholder="•••"
                      placeholderTextColor={GW.muted}
                      keyboardType="number-pad"
                      secureTextEntry
                      value={card.cvv}
                      maxLength={4}
                      onChangeText={(v) => setCardField('cvv')(v.replace(/\D/g, ''))}
                    />
                    <Ionicons name="help-circle-outline" size={17} color={GW.muted} />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkRow}
                onPress={() => setSaveInstrument((s) => !s)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, saveInstrument && styles.checkboxOn]}>
                  {saveInstrument && <Ionicons name="checkmark" size={13} color={GW.card} />}
                </View>
                <Text style={styles.checkText}>Save this card for faster checkout</Text>
              </TouchableOpacity>

              <View style={styles.noticeRow}>
                <Ionicons name="information-circle-outline" size={15} color={GW.muted} />
                <Text style={styles.noticeText}>
                  Placeholder checkout — card details stay on this device and are never sent
                  anywhere. Do not enter a real card.
                </Text>
              </View>
            </View>
          )}

          {/* ─── Net banking ─────────────────────────────────────────────── */}
          {method === 'netbanking' && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Choose your bank</Text>
              {BANKS.map((b, i) => {
                const active = bank === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.bankRow, i === BANKS.length - 1 && { borderBottomWidth: 0 }]}
                    onPress={() => setBank(b.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.bankMark, active && styles.appMarkActive]}>
                      <Text style={[styles.bankMarkText, active && { color: GW.card }]}>
                        {b.short.slice(0, 2)}
                      </Text>
                    </View>
                    <Text style={styles.bankLabel}>{b.label}</Text>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text style={styles.hint}>
                You’ll be taken to your bank’s secure page to authorise the payment.
              </Text>
            </View>
          )}

          {/* ─── Amount breakdown ────────────────────────────────────────── */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Amount</Text>
            <View style={styles.lineItem}>
              <Text style={styles.lineLabel} numberOfLines={2}>
                {purpose.label || 'Wallet top-up'}
              </Text>
              <Text style={styles.lineValue}>₹{formatInr(amount)}</Text>
            </View>
            {!!purpose.sublabel && <Text style={styles.lineSub}>{purpose.sublabel}</Text>}
            <View style={styles.lineItem}>
              <Text style={styles.lineLabel}>Payment gateway fee</Text>
              <Text style={[styles.lineValue, { color: GW.success }]}>Waived</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.lineItem}>
              <Text style={styles.totalLabel}>
                {method === 'cash' ? 'Payable in cash' : 'Total payable'}
              </Text>
              <Text style={styles.totalValue}>₹{formatInr(amount)}</Text>
            </View>
          </View>

          {/* ─── Sandbox controls ────────────────────────────────────────── */}
          <TouchableOpacity
            style={[styles.sandboxToggle, (method === 'cash' || method === 'wallet') && { display: 'none' }]}
            onPress={() => setShowSandbox((s) => !s)}
            activeOpacity={0.8}
          >
            <Ionicons name="flask-outline" size={14} color={GW.muted} />
            <Text style={styles.sandboxToggleText}>Test mode options</Text>
            <Ionicons name={showSandbox ? 'chevron-up' : 'chevron-down'} size={14} color={GW.muted} />
          </TouchableOpacity>
          {showSandbox && method !== 'cash' && method !== 'wallet' && (
            <View style={styles.sandboxPanel}>
              <Text style={styles.sandboxHint}>
                No real money moves in this build. Choose the response the placeholder
                gateway should return.
              </Text>
              <View style={styles.segment}>
                {[
                  { id: 'success', label: 'Successful payment' },
                  { id: 'failure', label: 'Declined payment' },
                ].map((o) => {
                  const active = outcome === o.id;
                  return (
                    <TouchableOpacity
                      key={o.id}
                      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                      onPress={() => setOutcome(o.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.trustRow}>
            <Ionicons name="lock-closed" size={12} color={GW.muted} />
            <Text style={styles.trustText}>Secured with 256-bit TLS encryption</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>{method === 'cash' ? 'Due in cash' : 'Payable'}</Text>
          <Text style={styles.footerAmount}>₹{formatInr(amount)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, !ready && styles.payBtnDisabled]}
          onPress={proceed}
          disabled={!ready}
          activeOpacity={0.9}
        >
          <Ionicons
            name={method === 'cash' ? 'checkmark-circle' : 'lock-closed'}
            size={15}
            color={GW.card}
          />
          <Text style={styles.payBtnText}>
            {method === 'cash'
              ? (purpose.type === 'appointment' ? 'Confirm booking' : 'Confirm order')
              : `Pay ₹${formatInr(amount)}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GW.page },

  tabs: {
    flexDirection: 'row', gap: 8, paddingBottom: 14, paddingRight: 4,
  },
  tab: {
    minWidth: 84, alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: GW.card, borderWidth: 1.5, borderColor: GW.line,
  },
  tabActive: { borderColor: GW.brand, backgroundColor: GW.brandSoft },
  tabText: { fontSize: 11.5, fontWeight: '700', color: GW.muted },
  tabTextActive: { color: GW.brand },

  panel: {
    backgroundColor: GW.card, borderRadius: 14, borderWidth: 1, borderColor: GW.line,
    padding: 14, marginBottom: 14,
  },
  panelTitle: { fontSize: 14, fontWeight: '800', color: GW.text, marginBottom: 12 },

  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  appTile: {
    width: '47.6%', flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: GW.line, backgroundColor: GW.page,
  },
  appTileActive: { borderColor: GW.brand, backgroundColor: GW.brandSoft },
  appMark: {
    width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: GW.card, borderWidth: 1, borderColor: GW.line,
  },
  appMarkActive: { backgroundColor: GW.brand, borderColor: GW.brand },
  appMarkText: { fontSize: 13, fontWeight: '800', color: GW.brand },
  appLabel: { flex: 1, fontSize: 12, fontWeight: '700', color: GW.text },

  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: GW.line,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: GW.brand },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: GW.brand },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: GW.line },
  orText: { fontSize: 11, fontWeight: '600', color: GW.muted },

  label: { fontSize: 11.5, fontWeight: '700', color: GW.muted, marginBottom: 6, marginTop: 12 },
  field: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: GW.line, borderRadius: 10,
    paddingHorizontal: 12, backgroundColor: GW.page, minHeight: 46,
  },
  fieldError: { borderColor: GW.error },
  input: { flex: 1, height: 46, fontSize: 14.5, color: GW.text, padding: 0 },
  errorText: { fontSize: 11, color: GW.error, marginTop: 5, fontWeight: '600' },
  hint: { fontSize: 11.5, color: GW.muted, marginTop: 10, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 12 },
  brandChip: {
    borderWidth: 1, borderColor: GW.line, borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 3, backgroundColor: GW.card,
  },
  brandChipText: { fontSize: 9.5, fontWeight: '800', color: GW.text, letterSpacing: 0.4 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 16 },
  checkbox: {
    width: 19, height: 19, borderRadius: 5, borderWidth: 1.5, borderColor: GW.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: GW.page,
  },
  checkboxOn: { backgroundColor: GW.brand, borderColor: GW.brand },
  checkText: { fontSize: 12.5, color: GW.text, fontWeight: '600' },

  noticeRow: {
    flexDirection: 'row', gap: 7, marginTop: 14, padding: 10,
    borderRadius: 10, backgroundColor: GW.page, borderWidth: 1, borderColor: GW.line,
  },
  noticeText: { flex: 1, fontSize: 11, color: GW.muted, lineHeight: 15.5 },

  bankRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: GW.line,
  },
  bankMark: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: GW.page, borderWidth: 1, borderColor: GW.line,
  },
  bankMarkText: { fontSize: 12, fontWeight: '800', color: GW.brand },
  bankLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: GW.text },

  lineItem: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 5 },
  lineLabel: { flex: 1, fontSize: 13, color: GW.muted },
  lineSub: { fontSize: 11, color: GW.muted, marginTop: -2, marginBottom: 4 },

  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12,
    backgroundColor: GW.page, borderWidth: 1, borderColor: GW.line,
  },
  walletIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: GW.brandSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  walletLabel: { fontSize: 11.5, color: GW.muted, fontWeight: '600' },
  walletValue: { fontSize: 18, fontWeight: '800', color: GW.text, marginTop: 2 },
  topUpBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 10, paddingVertical: 11, borderRadius: 11,
    borderWidth: 1.5, borderColor: GW.brand, backgroundColor: GW.brandSoft,
  },
  topUpBtnText: { fontSize: 12.5, fontWeight: '800', color: GW.brand },
  lineValue: { fontSize: 13, fontWeight: '700', color: GW.text },
  divider: { height: 1, backgroundColor: GW.line, marginVertical: 9 },
  totalLabel: { fontSize: 14, fontWeight: '800', color: GW.text },
  totalValue: { fontSize: 16, fontWeight: '800', color: GW.brand },

  sandboxToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  sandboxToggleText: { fontSize: 11.5, fontWeight: '700', color: GW.muted },
  sandboxPanel: {
    borderWidth: 1, borderColor: GW.line, borderRadius: 12, padding: 12,
    backgroundColor: GW.card,
  },
  sandboxHint: { fontSize: 11, color: GW.muted, lineHeight: 15.5, marginBottom: 10 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center',
    borderWidth: 1.5, borderColor: GW.line, backgroundColor: GW.page,
  },
  segmentBtnActive: { borderColor: GW.brand, backgroundColor: GW.brandSoft },
  segmentText: { fontSize: 11.5, fontWeight: '700', color: GW.muted },
  segmentTextActive: { color: GW.brand },

  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  trustText: { fontSize: 11, color: GW.muted, fontWeight: '600' },

  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: GW.card, borderTopWidth: 1, borderTopColor: GW.line,
  },
  footerLabel: { fontSize: 10.5, color: GW.muted, fontWeight: '700' },
  footerAmount: { fontSize: 18, fontWeight: '800', color: GW.text },
  payBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: GW.brand, borderRadius: 13, paddingVertical: 14,
  },
  payBtnDisabled: { opacity: 0.45 },
  payBtnText: { color: GW.card, fontWeight: '800', fontSize: 15 },

  expiredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  expiredIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: GW.warningSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  expiredTitle: { fontSize: 17, fontWeight: '800', color: GW.text },
  expiredBody: { fontSize: 13, color: GW.muted, textAlign: 'center', lineHeight: 19, marginTop: 8 },
  expiredBtn: {
    marginTop: 22, backgroundColor: GW.brand, borderRadius: 13,
    paddingVertical: 13, paddingHorizontal: 30,
  },
  expiredBtnText: { color: GW.card, fontWeight: '800', fontSize: 14 },
});
