import React from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export const Input = ({ label, style, ...props }) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        placeholderTextColor={COLORS.textSecondary}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: SPACING.s },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    paddingHorizontal: 15,
    fontSize: 14.5,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
});
