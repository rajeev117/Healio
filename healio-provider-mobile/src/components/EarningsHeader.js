import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useStore } from '../lib/store';
import { COLORS } from '../constants/theme';
import styles from './EarningsHeader.styles';

export default function EarningsHeader({ navigation }) {
  const available = useStore(state => state.availableEarnings || 0);
  const pending = useStore(state => state.pendingEarnings || 0);

  return (
    <TouchableOpacity style={styles.container} onPress={() => navigation.navigate('Earnings')}>
      <View>
        <Text style={styles.label}>Earnings</Text>
        <Text style={styles.balance}>{available}</Text>
      </View>
      <View style={styles.heldWrap}>
        <Text style={styles.heldLabel}>Pending</Text>
        <Text style={styles.heldValue}>{pending}</Text>
      </View>
    </TouchableOpacity>
  );
}
