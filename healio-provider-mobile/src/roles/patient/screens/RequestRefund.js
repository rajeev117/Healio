import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { supabase } from '../services/supabase';

const METHODS = [
  { id: 'wallet', label: 'Healio Wallet' },
  { id: 'upi', label: 'UPI' },
  { id: 'card', label: 'Card' },
];
const QUICK = [150, 300, 500];

export default function RequestRefund({ navigation, route }) {
  const presetAmount = route?.params?.amount ? String(route.params.amount) : '';
  const [amount, setAmount] = useState(presetAmount);
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('wallet');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Enter the amount you want refunded.'); return; }
    if (!reason.trim()) { Alert.alert('Missing reason', 'Please tell us why you want a refund.'); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Please log in'); setSubmitting(false); return; }
      const { data: profile } = await supabase.from('profiles').select('organisation_id').eq('id', user.id).maybeSingle();
      const { error } = await supabase.from('refunds').insert({
        patient_id: user.id,
        organisation_id: profile?.organisation_id || null,
        amount: amt,
        reason: reason.trim(),
        status: 'pending',
        method,
      });
      if (error) throw error;
      setSubmitting(false);
      Alert.alert('Refund requested', 'Your request is pending review. You can track it under My Requests.', [
        { text: 'OK', onPress: () => navigation.replace('MyRequests') },
      ]);
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Could not submit', e?.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request a Refund</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40 }}>
        <Text style={styles.label}>Amount (₹) *</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric"
          placeholder="0" placeholderTextColor={COLORS.textSecondary} />
        <View style={styles.quickRow}>
          {QUICK.map(q => (
            <TouchableOpacity key={q} style={styles.quickChip} onPress={() => setAmount(String(q))}>
              <Text style={styles.quickText}>₹{q}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Refund to</Text>
        <View style={styles.chipWrap}>
          {METHODS.map(m => (
            <TouchableOpacity key={m.id} style={[styles.chip, method === m.id && styles.chipActive]} onPress={() => setMethod(m.id)}>
              <Text style={[styles.chipText, method === m.id && styles.chipTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Reason *</Text>
        <TextInput style={[styles.input, styles.textarea]} value={reason} onChangeText={setReason}
          placeholder="Why are you requesting a refund?" placeholderTextColor={COLORS.textSecondary} multiline numberOfLines={5} />

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.disabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Submit Request</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  textarea: { height: 110, textAlignVertical: 'top' },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quickChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: COLORS.secondary },
  quickText: { color: COLORS.primary, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  submitBtn: { backgroundColor: COLORS.primary, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  disabled: { opacity: 0.6 },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
