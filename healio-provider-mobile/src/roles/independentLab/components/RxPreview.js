// The prescription(s) behind a request.
//
// Sourced from checkin_prescriptions (migration-043), which only returns rows
// when the patient has scanned THIS lab's QR in the last 24h — the scan is the
// consent. A direct select on `prescriptions` would return nothing here: that
// policy keys on my_org_id(), which is null for an org admin, and an
// independent lab's referral was written at someone else's hospital anyway.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { fetchCheckinPrescriptions } from '../services/api';

const when = (ts) =>
  new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function RxPreview({ patientId }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchCheckinPrescriptions(patientId)
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [patientId]);

  if (rows === null) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={[styles.card, styles.empty]}>
        <View style={styles.emptyIcon}>
          <Ionicons name="qr-code-outline" size={20} color={COLORS.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>No prescription shared yet</Text>
        <Text style={styles.emptyBody}>
          Ask the patient to scan your lab QR. That scan is what shares their prescriptions with you,
          and it stays open for 24 hours.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {rows.map((rx, i) => (
        <TouchableOpacity
          key={rx.id}
          style={[styles.row, i > 0 && styles.rowDivider]}
          onPress={() => rx.file_url && Linking.openURL(rx.file_url)}
          disabled={!rx.file_url}
        >
          <View style={styles.thumb}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.thumbTag}>Rx</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.doctor}>{rx.doctor_name}</Text>
            <Text style={styles.meta}>{rx.hospital_name}</Text>
            <Text style={styles.meta}>{when(rx.created_at)}</Text>
          </View>
          {!!rx.file_url && <Ionicons name="chevron-forward" size={16} color={COLORS.borderStrong} />}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.white, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  center: { alignItems: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowDivider: { borderTopWidth: 1, borderTopColor: '#f4ebe8', marginTop: 10, paddingTop: 12 },
  thumb: {
    width: 60, height: 74, borderRadius: 12, backgroundColor: COLORS.mutedSoft,
    justifyContent: 'center', alignItems: 'center', gap: 5,
  },
  thumbTag: { fontSize: 9, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1 },
  doctor: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  meta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 22, gap: 8 },
  emptyIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.mutedSoft,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  emptyBody: { fontSize: 11.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 17, paddingHorizontal: 10 },
});
