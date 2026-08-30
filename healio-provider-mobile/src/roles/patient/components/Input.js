import React from 'react';
import { TextInput, StyleSheet, View, Text } from 'react-native';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export const Input = ({ label, ...props }) => {
  return (
    <View style={styles.container}>
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
  container: {
    marginVertical: SPACING.s,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radius,
    padding: SPACING.m,
    fontSize: 16,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
});
