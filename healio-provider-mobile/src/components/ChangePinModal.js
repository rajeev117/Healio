import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import styles from './ChangePinModal.styles';

// ─────────────────────────────────────────────────────────────────────────────
// ChangePinModal — 3-step PIN change flow for doctors.
// Step 1: verify current PIN (default 0000)
// Step 2: enter new 4-digit PIN
// Step 3: confirm new PIN
// On success: saves to staff.assistant_pin (admin panel can see this).
// ─────────────────────────────────────────────────────────────────────────────

const PIN_LENGTH = 4;

async function loadCurrentPin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { pin: '0000', staffId: null };
  const { data } = await supabase
    .from('staff')
    .select('id, assistant_pin')
    .eq('user_id', user.id)
    .maybeSingle();
  return { pin: data?.assistant_pin || '0000', staffId: data?.id || null };
}

async function saveNewPin(staffId, newPin) {
  const { error } = await supabase
    .from('staff')
    .update({ assistant_pin: newPin })
    .eq('id', staffId);
  if (error) throw error;
}

// Shared keypad used in all 3 steps.
function Keypad({ entry, onDigit, onBack, error, shakeAnim, label, sublabel }) {
  return (
    <View style={styles.content}>
      <Text style={styles.stepLabel}>{label}</Text>
      {!!sublabel && <Text style={styles.stepSub}>{sublabel}</Text>}

      <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.dot, i < entry.length && styles.dotFilled]} />
        ))}
      </Animated.View>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.keypad}>
        {[['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']].map((row, ri) => (
          <View key={ri} style={styles.keyRow}>
            {row.map((key, ki) => {
              if (key === '') return <View key={ki} style={styles.keyPlaceholder} />;
              if (key === '⌫') return (
                <TouchableOpacity key={ki} style={styles.keyBtn} onPress={onBack}>
                  <Ionicons name="backspace-outline" size={22} color={COLORS.text} />
                </TouchableOpacity>
              );
              return (
                <TouchableOpacity key={ki} style={styles.keyBtn} onPress={() => onDigit(key)}>
                  <Text style={styles.keyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ChangePinModal({ visible, onClose }) {
  const [step, setStep]         = useState(1); // 1 = verify current, 2 = new pin, 3 = confirm
  const [entry, setEntry]       = useState('');
  const [newPin, setNewPin]     = useState('');
  const [error, setError]       = useState('');
  const [storedPin, setStoredPin] = useState('0000');
  const [staffId, setStaffId]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep(1); setEntry(''); setNewPin(''); setError('');
      loadCurrentPin().then(({ pin, staffId: sid }) => {
        setStoredPin(pin); setStaffId(sid);
      });
    }
  }, [visible]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigit = async (d) => {
    if (entry.length >= PIN_LENGTH) return;
    const next = entry + d;
    setEntry(next);
    setError('');

    if (next.length < PIN_LENGTH) return;

    if (step === 1) {
      if (next === storedPin) {
        setStep(2); setEntry('');
      } else {
        shake(); setError('Wrong PIN — try again.');
        setTimeout(() => setEntry(''), 600);
      }
    } else if (step === 2) {
      setNewPin(next); setStep(3); setEntry('');
    } else if (step === 3) {
      if (next === newPin) {
        setSaving(true);
        try {
          await saveNewPin(staffId, newPin);
          onClose();
          Alert.alert('PIN updated', `Your new revenue PIN has been saved.`);
        } catch (e) {
          shake(); setError('Could not save. Try again.');
          setTimeout(() => setEntry(''), 600);
        } finally {
          setSaving(false);
        }
      } else {
        shake(); setError('PINs don\'t match — re-enter new PIN.');
        setTimeout(() => { setStep(2); setEntry(''); setNewPin(''); }, 700);
      }
    }
  };

  const handleBack = () => setEntry(prev => prev.slice(0, -1));

  const stepConfig = {
    1: { label: 'Enter current PIN', sublabel: storedPin === '0000' ? 'Default is 0000' : '' },
    2: { label: 'Enter new PIN', sublabel: 'Choose a 4-digit PIN for revenue access' },
    3: { label: 'Confirm new PIN', sublabel: '' },
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Change Revenue PIN</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.stepBar}>
            {[1, 2, 3].map(s => (
              <View key={s} style={[styles.stepDot, s <= step && styles.stepDotActive]} />
            ))}
          </View>

          {saving ? (
            <View style={styles.saving}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.savingText}>Saving…</Text>
            </View>
          ) : (
            <Keypad
              entry={entry}
              onDigit={handleDigit}
              onBack={handleBack}
              error={error}
              shakeAnim={shakeAnim}
              label={stepConfig[step].label}
              sublabel={stepConfig[step].sublabel}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
