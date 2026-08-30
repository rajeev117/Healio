// ─────────────────────────────────────────────────────────────────────────────
// OrderApproval — what happens after a prescription order is placed.
//
//   1. Awaiting approval — the provider is reviewing the prescription
//   2. Invoice ready     — itemised bill with the final amount, to accept/decline
//   3. Confirmed         — accepted and paid from the Healio Wallet
//
// The order is only confirmed once the patient accepts the amount; nothing is
// charged before that. The invoice itself is raised by hand in the pharmacy /
// lab app — see src/services/orderRequests.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import {
  STATUS, getRequest, subscribe,
  declineInvoice, cancelRequest, formatWhen,
} from '../../../lib/orderRequests';

const STEPS = ['Request sent', 'Provider review', 'Invoice shared', 'Order confirmed'];

const STEP_OF = {
  [STATUS.AWAITING_REVIEW]: 1,
  [STATUS.QUOTED]: 2,
  [STATUS.CONFIRMED]: 3,
  [STATUS.DECLINED]: 2,
  [STATUS.CANCELLED]: 1,
};

export default function OrderApproval({ navigation, route }) {
  const requestId = route?.params?.requestId;
  const { balance } = useWallet();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await getRequest(requestId);
      if (!alive) return;
      setRequest(r);
      setLoading(false);
    };
    load();
    const unsub = subscribe(load);
    return () => { alive = false; unsub(); };
  }, [requestId]);

  const isLab = request?.kind === 'lab';
  const invoice = request?.invoice;

  // Accepting the amount opens the checkout — wallet, UPI, card, net banking or
  // cash. PaymentProcessing confirms the order once the payment lands.
  const accept = useCallback(() => {
    if (!invoice) return;
    const cashLabel = isLab
      ? (request.fulfilment === 'home' ? 'Pay cash at collection' : 'Pay cash at the lab')
      : (request.fulfilment === 'delivery' ? 'Pay cash on delivery' : 'Pay cash at the counter');
    navigation.navigate('PayGateway', {
      amount: invoice.total,
      allowWallet: true,
      allowCash: true,
      cashLabel,
      purpose: {
        type: 'order',
        requestId: request.id,
        label: `${isLab ? 'Lab tests' : 'Medicines'} — ${request.providerName}`,
        sublabel: `Invoice ${invoice.number} · ${request.orderNumber}`,
        merchantName: request.providerName,
        referenceType: isLab ? 'lab_order' : 'pharmacy_order',
      },
    });
  }, [invoice, request, isLab, navigation]);

  const decline = () => {
    Alert.alert(
      'Decline this invoice?',
      'The order will be cancelled and nothing will be charged.',
      [
        { text: 'Keep reviewing', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => declineInvoice(request.id, 'Amount not accepted'),
        },
      ]
    );
  };

  const cancel = () => {
    Alert.alert(
      'Cancel this request?',
      `${request.providerName} will stop reviewing your prescription.`,
      [
        { text: 'Keep waiting', style: 'cancel' },
        { text: 'Cancel request', style: 'destructive', onPress: () => cancelRequest(request.id) },
      ]
    );
  };

  const toOrders = () => navigation.replace('OrderTracking', { tab: isLab ? 'lab' : 'pharmacy' });

  if (loading || !request) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          {loading
            ? <ActivityIndicator size="large" color={COLORS.primary} />
            : <Text style={styles.muted}>This order request is no longer available.</Text>}
        </View>
      </SafeAreaView>
    );
  }

  const { status } = request;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{isLab ? 'Lab Booking' : 'Medicine Order'}</Text>
          <Text style={styles.headerSub}>{request.orderNumber} · {request.providerName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACING.m, paddingBottom: 140 }}
      >
        <Timeline current={STEP_OF[status] ?? 0} failed={status === STATUS.DECLINED || status === STATUS.CANCELLED} />

        {status === STATUS.AWAITING_REVIEW && <AwaitingCard request={request} isLab={isLab} />}

        {status === STATUS.QUOTED && (
          <InvoiceCard invoice={invoice} providerName={request.providerName} isLab={isLab} balance={balance} />
        )}

        {status === STATUS.CONFIRMED && (
          <ConfirmedCard request={request} invoice={invoice} isLab={isLab} />
        )}

        {(status === STATUS.DECLINED || status === STATUS.CANCELLED) && (
          <ClosedCard status={status} reason={request.closeReason} />
        )}

        <RequestSummary request={request} isLab={isLab} />
      </ScrollView>

      <View style={styles.footer}>
        {status === STATUS.AWAITING_REVIEW && (
          <>
            <TouchableOpacity style={styles.secondaryBtn} onPress={toOrders}>
              <Text style={styles.secondaryBtnText}>Back to orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtn} onPress={cancel}>
              <Text style={styles.linkBtnText}>Cancel request</Text>
            </TouchableOpacity>
          </>
        )}

        {status === STATUS.QUOTED && (
          <>
            <TouchableOpacity style={styles.primaryBtn} onPress={accept}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Accept & Pay ₹{invoice.total}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtn} onPress={decline}>
              <Text style={styles.linkBtnText}>Decline invoice</Text>
            </TouchableOpacity>
          </>
        )}

        {status === STATUS.CONFIRMED && (
          <TouchableOpacity style={styles.primaryBtn} onPress={toOrders}>
            <Ionicons name="navigate" size={17} color={COLORS.white} />
            <Text style={styles.primaryBtnText}>Track order</Text>
          </TouchableOpacity>
        )}

        {(status === STATUS.DECLINED || status === STATUS.CANCELLED) && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={toOrders}>
            <Text style={styles.secondaryBtnText}>Back to orders</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ current, failed }) {
  return (
    <View style={styles.timeline}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current && !failed;
        return (
          <View key={label} style={styles.tlItem}>
            <View style={[
              styles.tlDot,
              done && styles.tlDotDone,
              active && styles.tlDotActive,
              failed && i === current && styles.tlDotFailed,
            ]}>
              {done && <Ionicons name="checkmark" size={11} color={COLORS.white} />}
              {failed && i === current && <Ionicons name="close" size={11} color={COLORS.white} />}
            </View>
            <Text style={[styles.tlLabel, (done || active) && styles.tlLabelOn]} numberOfLines={2}>
              {label}
            </Text>
            {i < STEPS.length - 1 && <View style={[styles.tlLine, done && styles.tlLineDone]} />}
          </View>
        );
      })}
    </View>
  );
}

// ── State cards ──────────────────────────────────────────────────────────────

function AwaitingCard({ request, isLab }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0] });

  return (
    <View style={styles.card}>
      <View style={styles.pulseWrap}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
        <View style={styles.pulseCore}>
          <Ionicons name={isLab ? 'flask' : 'medkit'} size={26} color={COLORS.primary} />
        </View>
      </View>
      <Text style={styles.cardTitle}>Waiting for approval</Text>
      <Text style={styles.cardBody}>
        {request.providerName} is reviewing your prescription and will send an invoice
        with the final amount. You’ll be able to accept or decline it here.
      </Text>
      <View style={styles.infoStrip}>
        <Ionicons name="lock-closed-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.infoStripText}>
          Nothing has been charged. Your order is confirmed only after you accept the amount.
        </Text>
      </View>
      <Text style={styles.stamp}>Requested {formatWhen(request.createdAt)}</Text>
    </View>
  );
}

function InvoiceCard({ invoice, providerName, isLab, balance }) {
  const short = balance < invoice.total;
  return (
    <View style={styles.card}>
      <View style={styles.invoiceHead}>
        <View style={styles.invoiceBadge}>
          <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Invoice from {providerName}</Text>
          <Text style={styles.invoiceMeta}>{invoice.number} · {formatWhen(invoice.issuedAt)}</Text>
        </View>
      </View>

      <View style={styles.invoiceBody}>
        <Text style={styles.invoiceSection}>{isLab ? 'Tests' : 'Medicines'}</Text>
        {invoice.items.map((item, i) => (
          <View key={`${item.label}-${i}`} style={styles.lineItem}>
            <Text style={styles.lineLabel} numberOfLines={2}>{item.label}</Text>
            <Text style={styles.lineAmount}>₹{item.amount}</Text>
          </View>
        ))}

        <View style={styles.divider} />
        <View style={styles.lineItem}>
          <Text style={styles.lineMuted}>Subtotal</Text>
          <Text style={styles.lineMutedVal}>₹{invoice.subtotal}</Text>
        </View>
        {invoice.gst > 0 && (
          <View style={styles.lineItem}>
            <Text style={styles.lineMuted}>GST (5%)</Text>
            <Text style={styles.lineMutedVal}>₹{invoice.gst}</Text>
          </View>
        )}
        {!!invoice.fee && (
          <View style={styles.lineItem}>
            <Text style={styles.lineMuted}>{invoice.fee.label}</Text>
            <Text style={styles.lineMutedVal}>₹{invoice.fee.amount}</Text>
          </View>
        )}
        <View style={styles.divider} />
        <View style={styles.lineItem}>
          <Text style={styles.totalLabel}>Final amount</Text>
          <Text style={styles.totalAmount}>₹{invoice.total}</Text>
        </View>
      </View>

      {!!invoice.note && (
        <View style={styles.infoStrip}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.infoStripText}>{invoice.note}</Text>
        </View>
      )}

      <View style={[styles.walletRow, short && styles.walletRowShort]}>
        <Ionicons name="wallet-outline" size={15} color={short ? COLORS.error : COLORS.success} />
        <Text style={styles.walletText}>Healio Wallet balance</Text>
        <Text style={[styles.walletValue, { color: short ? COLORS.error : COLORS.success }]}>
          ₹{balance}
        </Text>
      </View>
      {short && (
        <Text style={styles.shortNote}>
          Top up ₹{invoice.total - balance} more to pay from the wallet, or pick UPI,
          card, net banking or cash at checkout.
        </Text>
      )}
    </View>
  );
}

const PAY_METHOD_LABEL = {
  wallet: 'Healio Wallet',
  upi: 'UPI',
  card: 'Credit / Debit Card',
  netbanking: 'Net Banking',
  cash: 'Cash',
};

function ConfirmedCard({ request, invoice, isLab }) {
  const payment = request.payment || {};
  const cash = !!payment.cash;
  const methodLabel = PAY_METHOD_LABEL[payment.method] || 'Healio Wallet';

  return (
    <View style={styles.card}>
      <View style={styles.successBadge}>
        <Ionicons name="checkmark" size={34} color={COLORS.white} />
      </View>
      <Text style={styles.cardTitle}>Order confirmed</Text>
      <Text style={styles.paidAmount}>₹{invoice.total}</Text>
      <Text style={styles.cardBody}>
        {cash
          ? `payable in cash · ${request.providerName} is now preparing your${isLab ? ' tests' : ' order'}.`
          : `paid via ${methodLabel} · ${request.providerName} is now preparing your${isLab ? ' tests' : ' order'}.`}
      </Text>
      <View style={styles.receipt}>
        <Row label="Order" value={request.orderNumber} />
        <Row label="Invoice" value={invoice.number} />
        <Row label="Payment" value={cash ? `${methodLabel} — due on collection` : methodLabel} />
        <Row label={isLab ? 'Collection' : 'Fulfilment'} value={request.fulfilmentLabel} />
        <Row label={isLab ? 'Appointment' : 'Slot'} value={request.slot} />
        <Row label="Confirmed" value={formatWhen(request.paidAt || Date.now())} />
      </View>
      {cash && (
        <View style={styles.cashStrip}>
          <Ionicons name="cash-outline" size={14} color={COLORS.text} />
          <Text style={styles.cashStripText}>
            Keep ₹{invoice.total} ready — collected in person, nothing was charged online.
          </Text>
        </View>
      )}
    </View>
  );
}

function ClosedCard({ status, reason }) {
  const declined = status === STATUS.DECLINED;
  return (
    <View style={styles.card}>
      <View style={styles.closedBadge}>
        <Ionicons name="close" size={30} color={COLORS.white} />
      </View>
      <Text style={styles.cardTitle}>{declined ? 'Invoice declined' : 'Request cancelled'}</Text>
      <Text style={styles.cardBody}>
        {declined
          ? 'You declined the final amount, so the order was not confirmed. Nothing was charged.'
          : `${reason || 'The request was cancelled before it was priced.'} Nothing was charged.`}
      </Text>
    </View>
  );
}

function RequestSummary({ request, isLab }) {
  return (
    <View style={styles.card}>
      <Text style={styles.summaryHead}>Your request</Text>
      {request.attachments?.length > 0 ? request.attachments.map((a, i) => (
        <View key={`${a.name}-${i}`} style={styles.attachRow}>
          <Ionicons
            name={a.kind === 'pdf' ? 'document-text-outline' : 'image-outline'}
            size={15}
            color={COLORS.primary}
          />
          <Text style={styles.attachName} numberOfLines={1}>{a.name}</Text>
        </View>
      )) : <Text style={styles.muted}>No file attached</Text>}
      {!!request.notes && <Text style={styles.notesPreview}>{request.notes}</Text>}

      <View style={styles.divider} />
      <Row label={isLab ? 'Collection' : 'Fulfilment'} value={request.fulfilmentLabel} />
      {!!request.address && <Row label="Address" value={request.address} />}
      <Row label={isLab ? 'Appointment' : 'Slot'} value={request.slot} />
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.l },
  muted: { fontSize: 12.5, color: COLORS.textSecondary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  headerSub: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center', marginTop: 2 },

  timeline: { flexDirection: 'row', marginBottom: SPACING.m, paddingHorizontal: 4 },
  tlItem: { flex: 1, alignItems: 'center' },
  tlDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  tlDotDone: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  tlDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  tlDotFailed: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  tlLine: {
    position: 'absolute', top: 10, left: '50%', right: -50, height: 2,
    backgroundColor: COLORS.border, zIndex: 1,
  },
  tlLineDone: { backgroundColor: COLORS.success },
  tlLabel: { fontSize: 9.5, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 },
  tlLabelOn: { color: COLORS.text, fontWeight: '700' },

  card: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, borderWidth: 1,
    borderColor: COLORS.border, padding: SPACING.m, marginBottom: SPACING.m, alignItems: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
  cardBody: {
    fontSize: 12.5, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 18, marginTop: 6,
  },
  stamp: { fontSize: 10.5, color: COLORS.textSecondary, marginTop: 12 },

  pulseWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  pulseRing: { position: 'absolute', width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primary },
  pulseCore: {
    width: 62, height: 62, borderRadius: 31, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },

  infoStrip: {
    flexDirection: 'row', gap: 7, alignItems: 'flex-start', marginTop: 14,
    padding: 10, borderRadius: 10, backgroundColor: COLORS.background,
    borderWidth: 1, borderColor: COLORS.border,
  },
  infoStripText: { flex: 1, fontSize: 11, color: COLORS.textSecondary, lineHeight: 15.5 },

  invoiceHead: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  invoiceBadge: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  invoiceMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  invoiceBody: {
    width: '100%', marginTop: 14, padding: 12, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  invoiceSection: {
    fontSize: 10, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
  },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 4 },
  lineLabel: { flex: 1, fontSize: 12.5, color: COLORS.text },
  lineAmount: { fontSize: 12.5, fontWeight: '700', color: COLORS.text },
  lineMuted: { fontSize: 12, color: COLORS.textSecondary },
  lineMutedVal: { fontSize: 12, fontWeight: '600', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8, width: '100%' },
  totalLabel: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  totalAmount: { fontSize: 18, fontWeight: '800', color: COLORS.primary },

  walletRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%',
    marginTop: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, backgroundColor: COLORS.successSoft,
  },
  walletRowShort: { backgroundColor: COLORS.dangerSoft },
  walletText: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.text },
  walletValue: { fontSize: 13, fontWeight: '800' },
  shortNote: { fontSize: 11, color: COLORS.error, marginTop: 8, fontWeight: '600' },

  successBadge: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  closedBadge: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.error,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  paidAmount: { fontSize: 30, fontWeight: '800', color: COLORS.text, marginTop: 6 },
  receipt: {
    width: '100%', marginTop: 16, padding: 12, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  cashStrip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7, width: '100%',
    marginTop: 12, paddingHorizontal: 11, paddingVertical: 10,
    borderRadius: 10, backgroundColor: COLORS.warningSoft,
  },
  cashStripText: { flex: 1, fontSize: 11.5, color: COLORS.text, lineHeight: 16 },

  summaryHead: {
    fontSize: 10.5, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.6,
    textTransform: 'uppercase', alignSelf: 'flex-start', marginBottom: 8,
  },
  attachRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', paddingVertical: 3 },
  attachName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  notesPreview: {
    alignSelf: 'stretch', fontSize: 12.5, color: COLORS.text, lineHeight: 18, marginTop: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 4, width: '100%' },
  rowLabel: { fontSize: 12, color: COLORS.textSecondary },
  rowValue: { flex: 1, fontSize: 12, fontWeight: '700', color: COLORS.text, textAlign: 'right' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.m, paddingTop: SPACING.m, paddingBottom: SPACING.m,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '800', fontSize: 14 },
  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  linkBtnText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 12.5 },
});
