// The open/closed consulting shutter. An individual doctor owns their own hours
// — the control a hospital-affiliated doctor has no equivalent of, so it leads
// the independent home screen, exactly as it does for a standalone lab/pharmacy.
//
// Local-only for now: there is no opening-hours column on organisations. Stored
// per device so it reopens where it left off.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/theme';

export default function ShutterToggle({ storageKey, openLabel, closedLabel }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((v) => { if (v !== null) setOpen(v === '1'); })
      .catch(() => {});
  }, [storageKey]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      AsyncStorage.setItem(storageKey, next ? '1' : '0').catch(() => {});
      return next;
    });
  }, [storageKey]);

  return (
    <TouchableOpacity style={styles.row} onPress={toggle} activeOpacity={0.7}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: open ? COLORS.success : '#c9c9d1' }]} />
        <Text style={styles.label}>{open ? openLabel : closedLabel}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: open ? COLORS.success : '#dcdce2' }]}>
        <View style={[styles.knob, open ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white },
});
