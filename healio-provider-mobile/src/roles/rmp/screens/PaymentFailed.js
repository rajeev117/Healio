import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { CustomButton } from '../components/CustomButton';

export default function PaymentFailed({ navigation, route }) {
  const { booking } = route.params;
  const { patient, provider } = booking;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.badgeOuter}>
          <View style={styles.badgeInner}>
            <Ionicons name="close" size={28} color={COLORS.white} />
          </View>
        </View>

        <Text style={styles.title}>Payment Failed</Text>
        <Text style={styles.subtitle}>
          The UPI payment didn't go through. You can retry or cancel this booking.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryName}>{patient.name} · {provider.name}</Text>
          <Text style={styles.summaryMeta}>Service charge ₹{provider.serviceCharge} · UPI</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <CustomButton
          title="Retry Payment"
          onPress={() => navigation.navigate('BookingConfirmed', { booking })}
        />
        <CustomButton
          title="Cancel Booking"
          variant="dangerSoft"
          onPress={() => navigation.popToTop()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24, alignItems: 'center' },
  badgeOuter: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: COLORS.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 110,
  },
  badgeInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 30 },
  subtitle: {
    fontSize: 13.5,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
  summaryCard: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 28,
  },
  summaryName: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  summaryMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 4 },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
