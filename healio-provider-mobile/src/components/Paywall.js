import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import styles from './Paywall.styles';

export function Paywall() {
  const walletBalance = useStore(state => state.walletBalance);
  const purchaseSubscription = useStore(state => state.purchaseSubscription);
  const topUpWallet = useStore(state => state.topUpWallet);
  const required = useStore(state => state.subscription?.holdAmount || 5000);
  const isActive = useStore(state => Boolean(state.subscription?.activatedAt));
  const [loading, setLoading] = useState(false);

  const handleTopUp = async () => {
    setLoading(true);
    // mock top-up: add exactly required amount
    topUpWallet(required);
    // then attempt purchase
    const ok = purchaseSubscription();
    setLoading(false);
    if (ok) {
      Alert.alert('Subscription active', 'Payment successful. All features unlocked.');
    } else {
      Alert.alert('Top-up failed', 'Unable to activate subscription after top-up.');
    }
  };

  const handlePayNow = () => {
    setLoading(true);
    const ok = purchaseSubscription();
    setLoading(false);
    if (ok) {
      Alert.alert('Subscription active', 'Payment successful. All features unlocked.');
    } else {
      Alert.alert('Insufficient balance', `Please top up ${required} to activate the subscription.`);
    }
  };

  if (isActive) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unlock Healio Provider features</Text>
      <Text style={styles.desc}>Keep a required hold of {required} to activate provider features.</Text>
      <Text style={styles.balance}>Balance: {walletBalance || 0}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.btn, styles.topUpBtn]} onPress={handleTopUp} disabled={loading}>
          <Text style={styles.btnText}>Top up hold {required}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.payBtn]} onPress={handlePayNow} disabled={loading}>
          <Text style={[styles.btnText, { color: COLORS.primary }]}>{loading ? 'Processing...' : 'Pay now'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
