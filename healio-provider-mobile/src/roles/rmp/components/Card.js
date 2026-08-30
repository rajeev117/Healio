import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SIZES, SPACING } from '../constants/theme';

export const Card = ({ children, style, title }) => {
  return (
    <View style={[styles.card, style]}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.m,
    marginVertical: SPACING.s,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.s,
  },
});
