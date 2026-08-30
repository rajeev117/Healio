import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

/** Soft-tinted circle with the initial(s) of a name, as used across the wireframes. */
export const Avatar = ({ name = '', size = 40, initials }) => {
  // name can be null (e.g. a patient who signed up by phone without a name yet),
  // so coerce before calling string methods.
  const text = initials || (name || '').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: {
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: COLORS.primary, fontWeight: '600' },
});
