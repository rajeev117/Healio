import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import FeatureScreen from '../components/FeatureScreen';
import { useFocusEffect } from '@react-navigation/native';
import PinGate from '../components/PinGate';
import styles from './Ledger.styles';

export default function Ledger({ navigation }) {
  const ledger = useStore((s) => s.ledger || []);
  const available = useStore((s) => s.availableEarnings || 0);
  const loadEarnings = useStore((s) => s.loadEarnings);

  useFocusEffect(
    React.useCallback(() => { loadEarnings(); }, [loadEarnings])
  );

  return (
    <PinGate>
    <FeatureScreen
      navigation={navigation}
      title="Ledger"
      subtitle="Earnings ledger — service earnings, commissions, refunds, and payouts."
      badge="Ledger"
      stats={[{ label: 'Available', value: available, icon: 'wallet', tint: COLORS.primarySoft }]}
      primaryAction={{ label: 'Earnings', onPress: () => navigation.navigate('Earnings') }}
    >
      <View style={{ gap: 10 }}>
        {ledger.length === 0 ? (
          <Text style={styles.empty}>No ledger entries yet.</Text>
        ) : (
          ledger.slice().reverse().map((item) => (
            <View key={item.id} style={styles.row}>
              <View>
                <Text style={styles.title}>{item.type}</Text>
                <Text style={styles.sub}>{new Date(item.date).toLocaleString()}</Text>
              </View>
              <Text style={styles.amount}>{item.net}</Text>
            </View>
          ))
        )}
      </View>
    </FeatureScreen>
    </PinGate>
  );
}
