// − qty + control for a medicine line.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../constants/theme';

export default function QtyStepper({ value, onChange, min = 1, max = 99 }) {
  const step = (delta) => {
    const next = Math.min(max, Math.max(min, (Number(value) || min) + delta));
    onChange(next);
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.btn} onPress={() => step(-1)} hitSlop={6}>
        <Text style={[styles.sign, value <= min && styles.signOff]}>−</Text>
      </TouchableOpacity>
      <Text style={styles.value}>{value}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => step(1)} hitSlop={6}>
        <Text style={[styles.sign, value >= max && styles.signOff]}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.2, borderColor: COLORS.borderStrong, borderRadius: 10,
  },
  btn: { paddingHorizontal: 10, paddingVertical: 6 },
  sign: { fontSize: 15, fontWeight: '800', color: COLORS.primary, lineHeight: 19 },
  signOff: { color: COLORS.borderStrong },
  value: { minWidth: 24, textAlign: 'center', fontSize: 12.5, fontWeight: '800', color: COLORS.text },
});
