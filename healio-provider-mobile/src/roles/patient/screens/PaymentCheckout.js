import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { usePlatformConfig } from '../context/PlatformConfigContext';

const ALL_PAYMENT_METHODS = [
  { id: 'wallet',     label: 'Healio Wallet',       icon: 'wallet',         desc: 'Instant payment from wallet' },
  { id: 'upi',        label: 'UPI',                  icon: 'phone-portrait', desc: 'GPay, PhonePe, Paytm, etc.' },
  { id: 'card',       label: 'Credit / Debit Card',  icon: 'card',           desc: 'Visa, Mastercard, RuPay' },
  { id: 'netbanking', label: 'Net Banking',           icon: 'business',       desc: 'All major banks supported' },
];

export default function PaymentCheckout({ navigation, route }) {
  const { balance } = useWallet();
  const { isFeatureAvailable } = usePlatformConfig();
  // Card payments can be turned off from admin (flag or kill switch)
  const PAYMENT_METHODS = ALL_PAYMENT_METHODS.filter(
    m => m.id !== 'card' || isFeatureAvailable('Card Payments', 'Card Payments')
  );
  const order = route?.params?.order || {
    title: 'Appointment — Dr. Ayaan Khan',
    subtitle: 'General Physician · Clinic Visit',
    date: '30 May 2026 · 10:30 AM',
    items: [
      { label: 'Consultation Fee', amount: 300 },
      { label: 'Platform Fee', amount: 20 },
    ],
  };

  const [selectedMethod, setSelectedMethod] = useState('wallet');
  const [processing, setProcessing] = useState(false);

  const subtotal = order.items.reduce((sum, i) => sum + i.amount, 0);
  const total = subtotal;

  const handlePay = () => {
    if (selectedMethod === 'wallet' && balance < total) {
      Alert.alert(
        'Insufficient Balance',
        `Your wallet balance (₹${balance}) is less than ₹${total}. Please top up or use another method.`,
        [
          { text: 'Top Up', onPress: () => navigation.navigate('Wallet') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      Alert.alert(
        'Payment Successful',
        `₹${total} paid via ${PAYMENT_METHODS.find(m => m.id === selectedMethod)?.label}. Appointment confirmed.`,
        [{ text: 'View Appointments', onPress: () => navigation.navigate('Main', { screen: 'Appointments' }) }]
      );
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Order summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.orderHeader}>
            <View style={styles.orderIcon}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.orderInfo}>
              <Text style={styles.orderTitle}>{order.title}</Text>
              <Text style={styles.orderSubtitle}>{order.subtitle}</Text>
              {!!order.date && (
                <View style={styles.orderDateRow}>
                  <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.orderDateText}>{order.date}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.divider} />
          {order.items.map((item) => (
            <View key={item.label} style={styles.lineItem}>
              <Text style={styles.lineLabel}>{item.label}</Text>
              <Text style={styles.lineAmount}>₹{item.amount}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalAmount}>₹{total}</Text>
          </View>
        </View>

        {/* Payment methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {PAYMENT_METHODS.map((method) => {
            const isWallet = method.id === 'wallet';
            const insufficient = isWallet && balance < total;
            const selected = selectedMethod === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.methodCard,
                  selected && styles.methodCardActive,
                  insufficient && styles.methodCardWarn,
                ]}
                onPress={() => setSelectedMethod(method.id)}
              >
                <View style={[styles.methodIcon, selected && styles.methodIconActive]}>
                  <Ionicons name={method.icon} size={20} color={selected ? COLORS.white : COLORS.primary} />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodLabel}>{method.label}</Text>
                  {isWallet
                    ? <Text style={[styles.methodDesc, insufficient && { color: COLORS.error }]}>
                        Balance: ₹{balance}{insufficient ? ' · Insufficient' : ''}
                      </Text>
                    : <Text style={styles.methodDesc}>{method.desc}</Text>
                  }
                </View>
                <View style={[styles.radio, selected && styles.radioActive]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.securityRow}>
          <Ionicons name="shield-checkmark" size={14} color={COLORS.success} />
          <Text style={styles.securityText}>Payments are secure and encrypted</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerAmount}>₹{total}</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, processing && { opacity: 0.7 }]}
          onPress={handlePay}
          disabled={processing}
        >
          {!processing && <Ionicons name="lock-closed" size={16} color={COLORS.white} />}
          <Text style={styles.payBtnText}>{processing ? 'Processing…' : `Pay ₹${total}`}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  section: {
    marginHorizontal: SPACING.m, marginTop: SPACING.m,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  orderIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  orderInfo: { flex: 1 },
  orderTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  orderSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  orderDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  orderDateText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  lineLabel: { fontSize: 13, color: COLORS.textSecondary },
  lineAmount: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  totalAmount: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background,
  },
  methodCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  methodCardWarn: { borderColor: COLORS.warning },
  methodIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.primarySoft,
  },
  methodIconActive: { backgroundColor: COLORS.primary },
  methodInfo: { flex: 1 },
  methodLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  methodDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  securityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 12,
  },
  securityText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: SPACING.m, backgroundColor: COLORS.background,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  footerLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600' },
  footerAmount: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  payBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
  },
  payBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
