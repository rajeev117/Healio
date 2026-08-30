import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';

const TONES = {
  success: { bg: COLORS.successSoft, fg: COLORS.success },
  warning: { bg: COLORS.warningSoft, fg: COLORS.warning },
  danger: { bg: COLORS.dangerSoft, fg: COLORS.error },
  muted: { bg: COLORS.mutedSoft, fg: COLORS.textSecondary },
};

const STATUS_TONES = {
  active: 'success',
  confirmed: 'success',
  pending: 'warning',
  expired: 'warning',
  cancelled: 'danger',
  failed: 'danger',
};

// Tone stays keyed to the English status value; only the visible label is
// translated (falls back to the raw label for anything unmapped).
const LABEL_KEYS = {
  confirmed: 'status_confirmed',
  pending: 'status_pending',
  completed: 'status_completed',
  cancelled: 'status_cancelled',
  active: 'status_active',
  verified: 'status_verified',
  expired: 'status_expired',
  failed: 'status_failed',
};

export const StatusPill = ({ label, tone }) => {
  const { t } = useLanguage();
  const key = String(label).toLowerCase();
  const resolved = TONES[tone || STATUS_TONES[key] || 'muted'];
  const display = LABEL_KEYS[key] ? t(LABEL_KEYS[key]) : label;
  return (
    <View style={[styles.pill, { backgroundColor: resolved.bg }]}>
      <Text style={[styles.text, { color: resolved.fg }]}>{display}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '600' },
});
