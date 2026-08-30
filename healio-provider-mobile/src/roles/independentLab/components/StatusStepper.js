// Vertical journey stepper — quote → collected → processing → ready → shared.
// Purely presentational; the caller decides which step is 'done' | 'now' | 'next'.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function StatusStepper({ steps = [] }) {
  return (
    <View style={styles.wrap}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const done = s.state === 'done';
        const now = s.state === 'now';
        return (
          <View key={s.label} style={styles.row}>
            <View style={styles.rail}>
              {done ? (
                <View style={styles.dotDone}>
                  <Ionicons name="checkmark" size={11} color={COLORS.white} />
                </View>
              ) : now ? (
                <View style={styles.dotNow} />
              ) : (
                <View style={styles.dotNext} />
              )}
              {!last && (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: done ? COLORS.success : now ? COLORS.primary : '#e8e0de' },
                    (done || now) && { opacity: 0.35 },
                  ]}
                />
              )}
            </View>

            <View style={[styles.body, last && { paddingBottom: 4 }]}>
              <Text style={[styles.label, !done && !now && styles.labelNext]}>{s.label}</Text>
              {!!s.meta && <Text style={[styles.meta, !done && !now && styles.metaNext]}>{s.meta}</Text>}
            </View>

            {now && (
              <View style={styles.livePill}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 2 },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  rail: { width: 16, alignItems: 'center' },
  dotDone: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.success, justifyContent: 'center', alignItems: 'center' },
  dotNow: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.primary },
  dotNext: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#e8e0de' },
  line: { width: 2, flex: 1, borderRadius: 1, marginTop: 4 },
  body: { flex: 1, paddingBottom: 18 },
  label: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  labelNext: { fontWeight: '600', color: '#9aa0a6' },
  meta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3 },
  metaNext: { color: '#b8b2b0' },
  livePill: { alignSelf: 'flex-start', backgroundColor: COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  liveText: { fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.6 },
});
