import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GW } from '../constants/paymentTheme';
import { MERCHANT, formatInr, formatClock } from '../services/PaymentGateway';

/**
 * The dark checkout chrome shared by every screen of the top-up flow: merchant,
 * order reference, amount and the session countdown, so the patient always sees
 * who is being paid and how much while moving between steps.
 */
export default function GatewayHeader({
  amount,
  orderId,
  secondsLeft = null,
  onClose,
  closeIcon = 'close',
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={13} color={GW.onInk} />
          </View>
          <View>
            <Text style={styles.gateway}>{MERCHANT.gateway}</Text>
            <Text style={styles.secure}>Secure checkout</Text>
          </View>
        </View>
        {onClose ? (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name={closeIcon} size={20} color={GW.onInkMuted} />
          </TouchableOpacity>
        ) : (
          <View style={styles.testBadge}>
            <Text style={styles.testBadgeText}>TEST MODE</Text>
          </View>
        )}
      </View>

      <View style={styles.detailRow}>
        <View style={styles.merchantCol}>
          <Text style={styles.merchantLabel}>Paying</Text>
          <Text style={styles.merchant} numberOfLines={1}>{MERCHANT.legalName}</Text>
          {!!orderId && <Text style={styles.orderId} numberOfLines={1}>{orderId}</Text>}
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.merchantLabel}>Amount</Text>
          <Text style={styles.amount}>₹{formatInr(amount)}</Text>
        </View>
      </View>

      {secondsLeft !== null && (
        <View style={styles.timerRow}>
          <Ionicons name="time-outline" size={13} color={GW.onInkFaint} />
          <Text style={styles.timerText}>
            This payment session expires in {formatClock(secondsLeft)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: GW.ink, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lockBadge: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: GW.inkSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: GW.inkLine,
  },
  gateway: { color: GW.onInk, fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  secure: { color: GW.onInkFaint, fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: GW.inkSoft, borderWidth: 1, borderColor: GW.inkLine,
  },
  testBadge: {
    borderWidth: 1, borderColor: GW.inkLine, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, backgroundColor: GW.inkSoft,
  },
  testBadgeText: { color: GW.onInkFaint, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  detailRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    gap: 12, marginTop: 14,
    borderTopWidth: 1, borderTopColor: GW.inkLine, paddingTop: 12,
  },
  merchantCol: { flex: 1 },
  amountCol: { alignItems: 'flex-end' },
  merchantLabel: { color: GW.onInkFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  merchant: { color: GW.onInk, fontSize: 14, fontWeight: '700', marginTop: 3 },
  orderId: { color: GW.onInkFaint, fontSize: 10.5, marginTop: 2, fontVariant: ['tabular-nums'] },
  amount: { color: GW.onInk, fontSize: 22, fontWeight: '800', marginTop: 2 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  timerText: { color: GW.onInkFaint, fontSize: 11, fontWeight: '600' },
});
