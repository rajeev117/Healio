import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import styles from './PinGate.styles';

// ─────────────────────────────────────────────────────────────────────────────
// PinGate — wraps any screen with a 4-digit PIN prompt.
// Only activates when the logged-in user is a doctor.
// PIN is stored in staff.assistant_pin (default '0000').
// Unlocked state is per-mount: navigating away and back requires PIN again.
// ─────────────────────────────────────────────────────────────────────────────

const PIN_LENGTH = 4;

async function fetchAssistantPin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '0000';
  const { data } = await supabase
    .from('staff')
    .select('assistant_pin')
    .eq('user_id', user.id)
    .maybeSingle();
  return data?.assistant_pin || '0000';
}

export default function PinGate({ children }) {
  const { user } = useAuth();
  const [unlocked, setUnlocked]     = useState(false);
  const [storedPin, setStoredPin]   = useState(null);
  const [entry, setEntry]           = useState('');
  const [error, setError]           = useState('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Non-doctors bypass the gate entirely.
  const needsPin = user?.role === 'doctor';

  useEffect(() => {
    if (!needsPin) { setUnlocked(true); return; }
    fetchAssistantPin().then(setStoredPin);
  }, [needsPin]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = (d) => {
    if (entry.length >= PIN_LENGTH) return;
    const next = entry + d;
    setEntry(next);
    setError('');
    if (next.length === PIN_LENGTH) {
      if (next === storedPin) {
        setUnlocked(true);
      } else {
        shake();
        setError('Wrong PIN — try again.');
        setTimeout(() => setEntry(''), 600);
      }
    }
  };

  const handleBack = () => setEntry(prev => prev.slice(0, -1));

  if (!needsPin || unlocked) return children;

  // Loading — PIN not fetched yet
  if (storedPin === null) {
    return (
      <View style={styles.container}>
        <Ionicons name="lock-closed" size={36} color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed" size={40} color={COLORS.primary} style={styles.lockIcon} />
      <Text style={styles.title}>Revenue PIN</Text>
      <Text style={styles.subtitle}>Enter your 4-digit PIN to view earnings</Text>

      {/* Dot indicators */}
      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.dot, i < entry.length && styles.dotFilled]} />
        ))}
      </Animated.View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      {/* Keypad */}
      <View style={styles.keypad}>
        {[['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']].map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key, ki) => {
              if (key === '') return <View key={ki} style={styles.keyPlaceholder} />;
              if (key === '⌫') return (
                <TouchableOpacity key={ki} style={styles.keyBtn} onPress={handleBack}>
                  <Ionicons name="backspace-outline" size={22} color={COLORS.text} />
                </TouchableOpacity>
              );
              return (
                <TouchableOpacity key={ki} style={styles.keyBtn} onPress={() => handleDigit(key)}>
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      <Text style={styles.hint}>Default PIN is 0000 · Change it from your home screen</Text>
    </View>
  );
}
