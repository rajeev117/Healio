import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';

export const CustomButton = ({ title, onPress, variant = 'primary', style, disabled }) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        variant === 'dangerSoft' && styles.dangerSoftButton,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.text,
          variant === 'secondary' && styles.secondaryText,
          variant === 'dangerSoft' && styles.dangerSoftText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  dangerButton: { backgroundColor: COLORS.error },
  dangerSoftButton: { backgroundColor: COLORS.dangerSoft },
  text: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  secondaryText: { color: COLORS.primary },
  dangerSoftText: { color: COLORS.error },
  disabledButton: { opacity: 0.5 },
});
