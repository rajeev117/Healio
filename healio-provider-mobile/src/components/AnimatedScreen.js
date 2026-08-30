import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet } from 'react-native';
import styles from './AnimatedScreen.styles';

/**
 * Wraps screen content with a fade + slight upward slide entrance animation.
 * Used via the withAnimation HOC in App.js — no per-screen changes needed.
 */
export default function AnimatedScreen({ children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
