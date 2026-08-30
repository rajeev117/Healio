import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';

// Parse "12 Jun 2026" into a sortable timestamp (newest first).
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const toTime = (d) => {
  const [day, mon, year] = d.split(' ');
  return new Date(Number(year), MONTHS[mon] ?? 0, Number(day)).getTime();
};

// Renders a patient's prescription images grouped date-wise (newest first),
// each labeled with the prescribing doctor. Tapping the card opens a full-screen
// viewer; the Checkout button opens the billing screen for that prescription.
export default function PrescriptionImageList({ prescriptions, patient, navigation }) {
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState(null);

  const groups = useMemo(() => {
    const byDate = {};
    (prescriptions || []).forEach(rx => {
      (byDate[rx.date] = byDate[rx.date] || []).push(rx);
    });
    return Object.keys(byDate)
      .sort((a, b) => toTime(b) - toTime(a))
      .map(date => ({ date, items: byDate[date] }));
  }, [prescriptions]);

  return (
    <View>
      {groups.map(group => (
        <View key={group.date} style={styles.group}>
          <View style={styles.dateHeader}>
            <View style={styles.dateDot} />
            <Text style={styles.dateLabel}>{group.date}</Text>
          </View>

          {group.items.map(rx => (
            <View key={rx.id} style={styles.rxCard}>
              <TouchableOpacity style={styles.rxMain} onPress={() => setPreview(rx)}>
                <Image source={{ uri: rx.image }} style={styles.thumb} resizeMode="cover" />
                <View style={styles.rxInfo}>
                  <Text style={styles.rxDoctor}>{rx.doctor}</Text>
                  <Text style={styles.rxDept}>{rx.department}</Text>
                  <Text style={styles.rxDiagnosis} numberOfLines={1}>{rx.diagnosis}</Text>
                  <View style={styles.imageBadge}>
                    <Ionicons name="image-outline" size={11} color={COLORS.textSecondary} />
                    <Text style={styles.imageBadgeText}>Prescription image</Text>
                  </View>
                </View>
                <Ionicons name="expand-outline" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.checkoutBtn}
                onPress={() => navigation?.navigate('Checkout', { patient, prescription: rx })}
              >
                <Ionicons name="cart-outline" size={16} color={COLORS.white} />
                <Text style={styles.checkoutBtnText}>Checkout</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}

      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}>
            <View>
              <Text style={styles.modalDoctor}>{preview?.doctor}</Text>
              <Text style={styles.modalMeta}>{preview?.date} · {preview?.department}</Text>
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setPreview(null)}>
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          {preview && (
            <Image source={{ uri: preview.image }} style={styles.modalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: SPACING.s },
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  dateLabel: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  rxCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rxMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 12,
  },
  checkoutBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '800' },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: 10,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rxInfo: { flex: 1 },
  rxDoctor: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  rxDept: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 1 },
  rxDiagnosis: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  imageBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  imageBadgeText: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalDoctor: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  modalMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: { flex: 1, width: '100%' },
});
