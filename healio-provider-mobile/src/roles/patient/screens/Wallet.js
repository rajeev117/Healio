import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { supabase } from '../services/supabase';

const QUICK_AMOUNTS = [100, 250, 500, 1000];

// Map reference_type / type to an icon
function txIcon(tx) {
  const t = (tx.reference_type || tx.type || '').toLowerCase();
  if (t.includes('lab')) return 'flask';
  if (t.includes('pharma') || t.includes('medicine')) return 'medkit';
  if (t.includes('appoint') || t.includes('consult')) return 'calendar';
  if (t.includes('homecare') || t.includes('home')) return 'home';
  if (t.includes('refund')) return 'refresh-circle';
  if (t.includes('topup') || t.includes('top_up') || t.includes('credit') || (tx.amount > 0)) return 'add-circle';
  return 'wallet';
}

export default function Wallet({ navigation, route }) {
  const { balance } = useWallet();
  const [customAmount, setCustomAmount] = useState('');
  const [selectedQuick, setSelectedQuick] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('transactions')
        .select('id, amount, type, description, reference_type, created_at')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setTransactions(data || []);
    } catch (_) {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useFocusEffect(loadTransactions);

  // Leaving the wallet always lands on Home — never back inside a finished
  // checkout, whichever way the wallet was opened.
  const goHome = useCallback(() => {
    navigation.navigate('Main', { screen: 'Home' });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome])
  );

  // Clear the amount entry once a top-up has actually been paid for.
  useEffect(() => {
    if (route?.params?.toppedUp) {
      setSelectedQuick(null);
      setCustomAmount('');
      navigation.setParams({ toppedUp: 0 });
    }
  }, [route?.params?.toppedUp, navigation]);

  // Top-ups go through the payment checkout — the wallet is credited only once
  // the gateway reports a captured payment (see screens/PaymentProcessing).
  const handleTopUp = () => {
    const amt = selectedQuick || Number(customAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid amount', 'Please enter or select a valid amount.');
      return;
    }
    if (amt < 10) {
      Alert.alert('Minimum top-up is ₹10', 'Please enter ₹10 or more to continue.');
      return;
    }
    navigation.navigate('PayGateway', {
      amount: amt,
      purpose: { type: 'topup', label: 'Healio Wallet top-up' },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goHome} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Healio Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.balanceCard}>
          <Ionicons name="wallet" size={28} color={COLORS.white} style={{ marginBottom: 8 }} />
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Ionicons name="shield-checkmark" size={12} color={COLORS.success} />
              <Text style={styles.statusText}>
                Healio Plus {balance >= 50 ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Up</Text>
          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((amt) => (
              <TouchableOpacity
                key={amt}
                style={[styles.quickChip, selectedQuick === amt && styles.quickChipActive]}
                onPress={() => { setSelectedQuick(amt); setCustomAmount(''); }}
              >
                <Text style={[styles.quickChipText, selectedQuick === amt && styles.quickChipTextActive]}>
                  ₹{amt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <Text style={styles.currencyPrefix}>₹</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Custom amount"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                value={customAmount}
                onChangeText={(v) => { setCustomAmount(v); setSelectedQuick(null); }}
              />
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={handleTopUp}>
              <Ionicons name="lock-closed" size={13} color={COLORS.white} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.payMethodsRow}>
            {['UPI', 'Card', 'Net Banking'].map((m) => (
              <View key={m} style={styles.payChip}>
                <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                <Text style={styles.payChipText}>{m}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Transactions</Text>
          </View>
          {txLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 20 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.txEmpty}>
              <Ionicons name="receipt-outline" size={32} color={COLORS.border} />
              <Text style={styles.txEmptyText}>No transactions yet</Text>
            </View>
          ) : transactions.map((tx) => {
            const positive = tx.amount > 0;
            const label = tx.description || (positive ? 'Top-up' : 'Deduction');
            const date = new Date(tx.created_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            });
            const icon = txIcon(tx);
            return (
              <View key={tx.id} style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: positive ? COLORS.successSoft : COLORS.primarySoft }]}>
                  <Ionicons name={icon} size={18} color={positive ? COLORS.success : COLORS.primary} />
                </View>
                <View style={styles.txInfo}>
                  <Text style={styles.txLabel}>{label}</Text>
                  <Text style={styles.txDate}>{date}</Text>
                </View>
                <Text style={[styles.txAmount, { color: positive ? COLORS.success : COLORS.text }]}>
                  {positive ? '+' : ''}₹{Math.abs(tx.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
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
  balanceCard: {
    margin: SPACING.m, borderRadius: 20, padding: SPACING.l,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  balanceAmount: { color: COLORS.white, fontSize: 42, fontWeight: '800', marginVertical: 4 },
  statusRow: { flexDirection: 'row', marginTop: 8 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  statusText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  section: {
    marginHorizontal: SPACING.m, marginBottom: SPACING.m,
    backgroundColor: COLORS.surface, borderRadius: SIZES.radius,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
  seeAll: { fontSize: 12, fontWeight: '700', color: COLORS.primary, marginBottom: 14 },
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  quickChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border,
  },
  quickChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  quickChipText: { fontWeight: '700', color: COLORS.textSecondary, fontSize: 13 },
  quickChipTextActive: { color: COLORS.primary },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, backgroundColor: COLORS.background,
  },
  currencyPrefix: { fontSize: 16, fontWeight: '700', color: COLORS.textSecondary, marginRight: 4 },
  textInput: { flex: 1, height: 44, fontSize: 15, color: COLORS.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 18, justifyContent: 'center',
  },
  addBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  payMethodsRow: { flexDirection: 'row', gap: 8 },
  payChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.background, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  payChipText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  txIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txLabel: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  txDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '800' },
  txEmpty: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  txEmptyText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
});
