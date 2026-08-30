import { useRef } from 'react';
import { Animated } from 'react-native';

/**
 * Returns { scale, onPressIn, onPressOut } to attach to a TouchableOpacity
 * and wrap its content in <Animated.View style={{ transform: [{ scale }] }}>.
 *
 * Usage:
 *   const { scale, onPressIn, onPressOut } = useAnimatedPress();
 *   <TouchableOpacity onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>
 *     <Animated.View style={{ transform: [{ scale }] }}>…</Animated.View>
 *   </TouchableOpacity>
 */
export function useAnimatedPress(toValue = 0.96) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50 }).start();

  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();

  return { scale, onPressIn, onPressOut };
}
