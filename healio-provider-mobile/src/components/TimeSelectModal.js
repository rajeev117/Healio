// ─────────────────────────────────────────────────────────────────────────────
// TimeSelectModal — pick an 'HH:MM' time.
//
// Replaces the free-text TextInputs the schedule editor used to use, where
// "9am", "0900" or an end time before the start time all saved happily and
// then generated no slots at all. Hand-rolled two-column list: the app has no
// date/time picker dependency and shouldn't gain one for this.
//
// Follows the app's bottom-sheet modal convention (ChangePinModal).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import { hhmmToMins, minsToHhmm, fmt12 } from '../lib/schedule';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 30, 40, 45, 50];
const ROW = 46;

export default function TimeSelectModal({
  visible,
  value,
  title = 'Select time',
  minTime,        // 'HH:MM' — times at or before this are disabled (end > start)
  onConfirm,
  onClose,
}) {
  const initial = hhmmToMins(value);
  const [hour, setHour] = useState(initial === null ? 9 : Math.floor(initial / 60));
  const [minute, setMinute] = useState(initial === null ? 0 : initial % 60);
  const hourScroll = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const mins = hhmmToMins(value);
    setHour(mins === null ? 9 : Math.floor(mins / 60));
    setMinute(mins === null ? 0 : mins % 60);
    // Bring the selected hour into view rather than always opening at midnight.
    const idx = mins === null ? 9 : Math.floor(mins / 60);
    requestAnimationFrame(() => {
      hourScroll.current?.scrollTo({ y: Math.max(0, (idx - 2) * ROW), animated: false });
    });
  }, [visible, value]);

  const floor = hhmmToMins(minTime);
  const selected = hour * 60 + minute;
  const tooEarly = floor !== null && selected <= floor;

  // A whole hour is unreachable when even its last minute option is too early.
  const hourDisabled = (h) =>
    floor !== null && h * 60 + MINUTES[MINUTES.length - 1] <= floor;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.preview}>{fmt12(minsToHhmm(selected))}</Text>

          <View style={styles.columns}>
            <View style={styles.column}>
              <Text style={styles.columnLabel}>Hour</Text>
              <ScrollView
                ref={hourScroll}
                style={styles.columnScroll}
                showsVerticalScrollIndicator={false}
              >
                {HOURS.map((h) => {
                  const disabled = hourDisabled(h);
                  const active = h === hour;
                  return (
                    <TouchableOpacity
                      key={h}
                      disabled={disabled}
                      onPress={() => setHour(h)}
                      style={[styles.cell, active && styles.cellActive, disabled && styles.cellDisabled]}
                    >
                      <Text style={[styles.cellText, active && styles.cellTextActive]}>
                        {String(h).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.column}>
              <Text style={styles.columnLabel}>Minute</Text>
              <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
                {MINUTES.map((m) => {
                  const disabled = floor !== null && hour * 60 + m <= floor;
                  const active = m === minute;
                  return (
                    <TouchableOpacity
                      key={m}
                      disabled={disabled}
                      onPress={() => setMinute(m)}
                      style={[styles.cell, active && styles.cellActive, disabled && styles.cellDisabled]}
                    >
                      <Text style={[styles.cellText, active && styles.cellTextActive]}>
                        {String(m).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {tooEarly && (
            <Text style={styles.warn}>Must be later than {fmt12(minTime)}.</Text>
          )}

          <TouchableOpacity
            style={[styles.cta, tooEarly && styles.ctaDisabled]}
            disabled={tooEarly}
            onPress={() => onConfirm(minsToHhmm(selected))}
          >
            <Ionicons name="checkmark" size={18} color={COLORS.white} />
            <Text style={styles.ctaText}>Set time</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 36, paddingHorizontal: SPACING.l,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 20, paddingBottom: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  preview: {
    fontSize: 30, fontWeight: '900', color: COLORS.primary,
    textAlign: 'center', marginTop: 4, marginBottom: 12,
  },
  columns: { flexDirection: 'row', gap: 14 },
  column: { flex: 1 },
  columnLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, textAlign: 'center',
  },
  columnScroll: {
    maxHeight: ROW * 4.5,
    backgroundColor: COLORS.surface,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  cell: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  cellActive: { backgroundColor: COLORS.primary },
  cellDisabled: { opacity: 0.3 },
  cellText: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  cellTextActive: { color: COLORS.white },
  warn: { fontSize: 12, color: COLORS.error, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  cta: {
    marginTop: 18, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
