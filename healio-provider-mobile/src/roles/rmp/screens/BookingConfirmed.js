import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { Avatar } from '../components/Avatar';
import { CustomButton } from '../components/CustomButton';

export default function BookingConfirmed({ navigation, route }) {
  const { booking } = route.params;
  const { patient, provider, slot, payment } = booking;

  const goHome = () => navigation.popToTop();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.badgeOuter}>
          <View style={styles.badgeInner}>
            <Ionicons name="checkmark" size={30} color={COLORS.white} />
          </View>
        </View>

        <Text style={styles.title}>Booking Confirmed</Text>
        <Text style={styles.subtitle}>Patient and provider have been notified.</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Avatar name={patient.name} />
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryName}>{patient.name}</Text>
              <Text style={styles.summaryMeta}>{slot.day} {slot.date} · {slot.time}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryBottom}>
            <Text style={styles.summaryName}>{provider.name}</Text>
            <Text style={styles.summaryMeta}>Service charge · {payment}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewBtn}
          onPress={() => { navigation.popToTop(); navigation.navigate('Main', { screen: 'Bookings' }); }}
        >
          <Text style={styles.viewBtnText}>View Booking</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.footer}>
        <CustomButton title="Done" onPress={goHome} />
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
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 110,
  },
  badgeInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 30 },
  subtitle: { fontSize: 13.5, color: COLORS.textSecondary, marginTop: 8 },
  summaryCard: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 28,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryInfo: { marginLeft: 12 },
  summaryName: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  summaryMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  summaryBottom: {},
  viewBtn: {
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  viewBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
