import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { CustomButton } from '../components/CustomButton';
import { useAuth } from '../../../context/AuthContext';
import { createBooking } from '../services/api';

const METHODS = [
  { id: 'cash', title: 'Cash', subtitle: 'Healthcare Consultant collects the service charge' },
  { id: 'upi', title: 'Online UPI', subtitle: 'Patient pays the service charge' },
];

export default function ServiceCharge({ navigation, route }) {
  const { patient, provider, slot } = route.params;
  const { user } = useAuth();
  const rmpId = user?.userId;
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await createBooking({
        rmpId,
        patientId: patient.id,
        hospitalId: provider.hospitalId,
        doctorId: provider.id,
        at: slot.at,
        payment: method === 'cash' ? 'Cash' : 'UPI',
        serviceCharge: provider.serviceCharge,
        // Set when the booking is for a household member rather than the
        // account holder (see SelectPatientProfile).
        familyMemberId: patient.familyMemberId || null,
      });
      const booking = { patient, provider, slot, payment: method === 'cash' ? 'Cash' : 'UPI' };
      navigation.navigate('BookingConfirmed', { booking });
    } catch (e) {
      Alert.alert('Booking Failed', e.message || 'Could not create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Service Charge" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.amountLabel}>AMOUNT DUE</Text>
        <Text style={styles.amount}>₹{provider.serviceCharge}</Text>

        {METHODS.map(m => {
          const isSelected = m.id === method;
          return (
            <TouchableOpacity key={m.id} style={[styles.methodCard, isSelected && styles.methodCardSelected]} onPress={() => setMethod(m.id)} activeOpacity={0.8}>
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodTitle}>{m.title}</Text>
                <Text style={styles.methodSubtitle}>{m.subtitle}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <CustomButton title={submitting ? 'Creating…' : 'Confirm & Book'} onPress={handleConfirm} disabled={submitting} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  amountLabel: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.6, textAlign: 'center', marginTop: 32 },
  amount: { fontSize: 42, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginTop: 6, marginBottom: 28 },
  methodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 18, marginBottom: 14 },
  methodCardSelected: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: COLORS.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  methodInfo: { marginLeft: 16 },
  methodTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  methodSubtitle: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 4 },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
