import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import FeatureScreen from '../components/FeatureScreen';
import PinGate from '../components/PinGate';
import styles from './Earnings.styles';

export default function Earnings({ navigation }) {
  const available = useStore((s) => s.availableEarnings || 0);
  const pending = useStore((s) => s.pendingEarnings || 0);
  const payouts = useStore((s) => s.payouts || []);
  const requestPayout = useStore((s) => s.requestPayout);
  const loadEarnings = useStore((s) => s.loadEarnings);

  React.useEffect(() => { loadEarnings(); }, []);

  const [requesting, setRequesting] = useState(false);
  const handleRequest = async () => {
    if (requesting) return;
    if (!available || available <= 0) return Alert.alert('No available earnings');
    setRequesting(true);
    // request full payout for MVP
    const ok = await requestPayout(available);
    setRequesting(false);
    if (ok) Alert.alert('Payout requested', `Requested ₹${available} for payout.`);
    else Alert.alert('Payout failed', 'Unable to request payout. Please try again.');
  };

  return (
    <PinGate>
    <FeatureScreen
      navigation={navigation}
      title="Earnings"
      subtitle="Overview of provider earnings, pending amounts, and payouts."
      badge="Earnings"
      stats={[
        { label: 'Available', value: available, icon: 'cash', tint: COLORS.primarySoft },
        { label: 'Pending', value: pending, icon: 'time', tint: '#fff5f5', color: '#9b2c2c' },
      ]}
      primaryAction={{ label: 'Request payout', onPress: handleRequest }}
      secondaryAction={{ label: 'Ledger', onPress: () => navigation.navigate('Ledger') }}
      sections={[
        {
          title: 'Recent payouts',
          children: (
            <View style={styles.card}>
              {payouts.length === 0 ? (
                <Text style={styles.empty}>No payouts yet.</Text>
              ) : (
                payouts.map((p) => (
                  <View key={p.id} style={styles.row}>
                    <Text style={styles.title}>{p.status}</Text>
                    <Text style={styles.amount}>{p.amount}</Text>
                  </View>
                ))
              )}
            </View>
          ),
        },
      ]}
    />
    </PinGate>
  );
}
