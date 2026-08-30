import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

/** Flow header: optional back arrow, bold title, right-aligned step label, hairline divider. */
export const ScreenHeader = ({ title, step, onBack }) => {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
        {step ? <Text style={styles.step}>{step}</Text> : null}
      </View>
      <View style={styles.divider} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backBtn: { marginRight: 8, marginLeft: -4 },
  title: { flex: 1, fontSize: 19, fontWeight: '800', color: COLORS.text },
  step: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: COLORS.border },
});
