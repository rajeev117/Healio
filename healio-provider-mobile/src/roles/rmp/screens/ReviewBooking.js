import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { CustomButton } from '../components/CustomButton';

export default function ReviewBooking({ navigation, route }) {
  const { patient, provider, slot } = route.params;

  const rows = [
    { label: 'Patient', value: patient.name },
    // Only when booking for a household member — makes it obvious the visit is
    // not for the account holder whose number was verified.
    ...(patient.accountName
      ? [{ label: 'Account', value: `${patient.accountName} · ${patient.relation}` }]
      : []),
    { label: 'Provider', value: provider.name },
    { label: 'Date & time', value: `${slot.day} ${slot.date} · ${slot.time}` },
    { label: 'Service charge', value: `₹${provider.serviceCharge}` },
    { label: 'Consultation fee', value: 'Paid at visit' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Review Booking" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          {rows.map((row, i) => (
            <View key={row.label}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.noteText}>
            The patient will receive an SMS confirmation. Consultation fee is paid directly at the clinic.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <CustomButton
          title="Create Booking"
          onPress={() => navigation.navigate('ServiceCharge', { patient, provider, slot })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 26,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  rowLabel: { fontSize: 13.5, color: COLORS.textSecondary },
  rowValue: { fontSize: 13.5, fontWeight: '600', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border },
  noteCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  noteText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 17 },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
