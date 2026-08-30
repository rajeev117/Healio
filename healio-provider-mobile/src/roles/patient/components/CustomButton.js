import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { COLORS, SIZES } from '../constants/theme';

export const CustomButton = ({ title, onPress, variant = 'primary', style, disabled }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 50 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'secondary' ? styles.secondaryButton : styles.primaryButton,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.text,
          variant === 'secondary' ? styles.secondaryText : styles.primaryText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    borderRadius: SIZES.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  primaryText: {
    color: '#fff',
  },
  secondaryText: {
    color: COLORS.primary,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
