import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import styles from './WalletHeader.styles';

export default function WalletHeader({ navigation }) {
  const balance = useStore(state => state.walletBalance || 0);
  const held = useStore(state => state.heldAmount || 0);

  return (
    <TouchableOpacity style={styles.container} onPress={() => navigation.navigate('Earnings')}>
      <View>
        <Text style={styles.label}>Earnings</Text>
        <Text style={styles.balance}>{balance}</Text>
      </View>
      <View style={styles.heldWrap}>
        <Text style={styles.heldLabel}>Pending</Text>
        <Text style={styles.heldValue}>{held}</Text>
      </View>
    </TouchableOpacity>
  );
}
