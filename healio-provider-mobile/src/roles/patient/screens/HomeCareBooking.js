import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { supabase } from '../services/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// HomeCareBooking — book home visit services
//   Step 1 — Select service type
//   Step 2 — Date & time slot
//   Step 3 — Address
//   Step 4 — Confirm & pay
//
// When Supabase connected:
//   await supabase.from('homecare_orders').insert({ patient_id, service, date, time, address, total, status: 'booked' });
// ─────────────────────────────────────────────────────────────────────────────

const SERVICES = [
  { id: 'hc1', name: 'Doctor Home Visit',       icon: 'medkit',          price: 500, duration: '30–45 min', desc: 'Licensed doctor visits your home for consultation' },
  { id: 'hc2', name: 'Nurse Visit',              icon: 'person',          price: 350, duration: '45–60 min', desc: 'Certified nurse for dressings, injections & monitoring' },
  { id: 'hc3', name: 'IV Infusion',              icon: 'water',           price: 700, duration: '60–90 min', desc: 'IV drip administration by trained medical professional' },
  { id: 'hc4', name: 'Physiotherapy at Home',    icon: 'body',            price: 600, duration: '45–60 min', desc: 'Physiotherapist for post-surgery or injury recovery' },
  { id: 'hc5', name: 'Blood Sample Collection',  icon: 'flask',           price: 150, duration: '15–20 min', desc: 'Technician collects samples for lab tests' },
  { id: 'hc6', name: 'Post-Op Care',             icon: 'bandage',         price: 800, duration: '60–90 min', desc: 'Post-surgery wound care and recovery support' },
  { id: 'hc7', name: 'Elder Care Attendant',     icon: 'people',          price: 400, duration: 'Per visit',  desc: 'Professional attendant for elderly care & support' },
  { id: 'hc8', name: 'Caregiver (Half Day)',     icon: 'home',            price: 600, duration: '4 hours',   desc: 'Trained caregiver for continuous home support' },
];

const TIME_SLOTS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'];

function getNext7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      full: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate(),
      isToday: i === 0,
    });
  }
  return days;
}

const STEPS = ['Service', 'Schedule', 'Address', 'Confirm'];

export default function HomeCareBooking({ navigation, route }) {
  const { balance, deductBalance } = useWallet();
  const days = getNext7Days();

  const [step, setStep]               = useState(0);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [address, setAddress]         = useState('');
  const [notes, setNotes]             = useState('');
  const [booking, setBooking]         = useState(false);

  const total = selectedService?.price || 0;

  const canNext = () => {
    if (step === 0) return !!selectedService;
    if (step === 1) return selectedDate && selectedTime;
    if (step === 2) return address.trim().length > 5;
    return true;
  };

  const handleConfirm = async () => {
    if (balance < total) {
      Alert.alert('Insufficient Balance', `You need ₹${total}. Current wallet: ₹${balance}.`,
        [{ text: 'Top Up', onPress: () => navigation.navigate('Wallet') }, { text: 'Cancel', style: 'cancel' }]);
      return;
    }
    setBooking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('homecare_orders').insert({
          patient_id: user.id,
          service: selectedService.name,
          service_id: selectedService.id,
          scheduled_date: selectedDate,
          scheduled_time: selectedTime,
          address,
          notes: notes || null,
          total,
          status: 'booked',
        });
      }
    } catch (dbErr) {
      console.warn('homecare_orders insert:', dbErr);
    }
    deductBalance(total);
    setBooking(false);
    Alert.alert('Booking Confirmed! 🏠',
      `${selectedService.name} has been booked.\n\nDate: ${selectedDate} at ${selectedTime}\nAddress: ${address}\n\nA confirmation will be sent via SMS.`,
      [{ text: 'Track Order', onPress: () => navigation.replace('OrderTracking') },
       { text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Home Care</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step bar */}
      <View style={styles.stepBar}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step && styles.stepDotActive, i < step && styles.stepDotDone]}>
              {i < step ? <Ionicons name="checkmark" size={12} color={COLORS.white} />
                : <Text style={[styles.stepNum, i <= step && styles.stepNumActive]}>{i + 1}</Text>}
            </View>
            <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.m, paddingBottom: 120 }}>

        {/* Step 0: Select service */}
        {step === 0 && (
          <View style={{ gap: 10 }}>
            <Text style={styles.sectionTitle}>Choose Service</Text>
            {SERVICES.map(svc => (
              <TouchableOpacity key={svc.id}
                style={[styles.serviceCard, selectedService?.id === svc.id && styles.serviceCardActive]}
                onPress={() => setSelectedService(svc)}>
                <View style={[styles.serviceIcon, { backgroundColor: selectedService?.id === svc.id ? COLORS.primarySoft : COLORS.surface }]}>
                  <Ionicons name={svc.icon} size={22} color={selectedService?.id === svc.id ? COLORS.primary : COLORS.textSecondary} />
                </View>
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{svc.name}</Text>
                  <Text style={styles.serviceDesc}>{svc.desc}</Text>
                  <View style={styles.serviceMeta}>
                    <Ionicons name="time-outline" size={11} color={COLORS.textSecondary} />
                    <Text style={styles.serviceMetaText}>{svc.duration}</Text>
                  </View>
                </View>
                <Text style={styles.servicePrice}>₹{svc.price}</Text>
                {selectedService?.id === svc.id && (
                  <View style={styles.selectedCheck}>
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 1: Schedule */}
        {step === 1 && (
          <View style={{ gap: 16 }}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {days.map(d => (
                  <TouchableOpacity key={d.full} style={[styles.dayChip, selectedDate === d.full && styles.dayChipActive]}
                    onPress={() => setSelectedDate(d.full)}>
                    <Text style={[styles.dayName, selectedDate === d.full && styles.dayChipActiveText]}>{d.day}</Text>
                    <Text style={[styles.dayNum, selectedDate === d.full && styles.dayChipActiveText]}>{d.date}</Text>
                    {d.isToday && <Text style={styles.todayTag}>Today</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.sectionTitle}>Select Time</Text>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map(slot => (
                <TouchableOpacity key={slot} style={[styles.timeChip, selectedTime === slot && styles.timeChipActive]}
                  onPress={() => setSelectedTime(slot)}>
                  <Text style={[styles.timeText, selectedTime === slot && styles.timeTextActive]}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <View style={{ gap: 14 }}>
            <Text style={styles.sectionTitle}>Service Address</Text>
            <TextInput style={styles.addressInput} value={address} onChangeText={setAddress}
              placeholder="Flat no., building, street, area, city…"
              placeholderTextColor={COLORS.textSecondary} multiline numberOfLines={3} />
            <Text style={styles.sectionTitle}>Special Instructions (optional)</Text>
            <TextInput style={styles.addressInput} value={notes} onChangeText={setNotes}
              placeholder="E.g. ring the bell twice, gate code, floor number…"
              placeholderTextColor={COLORS.textSecondary} multiline numberOfLines={2} />
            <View style={styles.safetyNote}>
              <Ionicons name="shield-checkmark" size={16} color={COLORS.success} />
              <Text style={styles.safetyText}>All Healio caregivers are background-verified and carry valid ID. You will receive the caregiver's name and contact before they arrive.</Text>
            </View>
          </View>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedService && (
          <View style={{ gap: 14 }}>
            <Text style={styles.sectionTitle}>Booking Summary</Text>
            <View style={styles.summaryCard}>
              {[
                { label: 'Service',   value: selectedService.name },
                { label: 'Duration',  value: selectedService.duration },
                { label: 'Date',      value: selectedDate },
                { label: 'Time',      value: selectedTime },
                { label: 'Address',   value: address },
                ...(notes ? [{ label: 'Notes', value: notes }] : []),
              ].map(({ label, value }) => (
                <View key={label}>
                  <Text style={styles.summaryLabel}>{label}</Text>
                  <Text style={styles.summaryValue}>{value}</Text>
                  <View style={styles.divider} />
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₹{total}</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceMeta}>Wallet balance</Text>
                <Text style={[styles.balanceMeta, { color: balance >= total ? COLORS.success : COLORS.error }]}>₹{balance}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        {selectedService && (
          <View style={styles.bottomService}>
            <Text style={styles.bottomServiceName} numberOfLines={1}>{selectedService.name}</Text>
            <Text style={styles.bottomServicePrice}>₹{selectedService.price}</Text>
          </View>
        )}
        <TouchableOpacity style={[styles.nextBtn, !canNext() && styles.nextBtnDisabled]}
          disabled={!canNext() || booking}
          onPress={() => step < 3 ? setStep(s => s + 1) : handleConfirm()}>
          <Text style={styles.nextBtnText}>{booking ? 'Confirming…' : step < 3 ? 'Continue' : 'Confirm & Pay'}</Text>
          {!booking && <Ionicons name={step < 3 ? 'arrow-forward' : 'checkmark-circle'} size={18} color={COLORS.white} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.m, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  stepBar: { flexDirection: 'row', paddingHorizontal: SPACING.m, paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepItem: { flex: 1, alignItems: 'center', gap: 4 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  stepDotDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepNum: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  stepNumActive: { color: COLORS.primary },
  stepLabel: { fontSize: 9, fontWeight: '600', color: COLORS.textSecondary },
  stepLabelActive: { color: COLORS.primary, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  serviceCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: SPACING.m, backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, borderWidth: 1.5, borderColor: COLORS.border },
  serviceCardActive: { borderColor: COLORS.primary },
  serviceIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  serviceInfo: { flex: 1, gap: 3 },
  serviceName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  serviceDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  serviceMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  serviceMetaText: { fontSize: 11, color: COLORS.textSecondary },
  servicePrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  selectedCheck: { position: 'absolute', top: 12, right: 12 },
  dayChip: { width: 56, paddingVertical: 10, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border, alignItems: 'center', gap: 2 },
  dayChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayChipActiveText: { color: COLORS.white },
  dayName: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary },
  dayNum: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  todayTag: { fontSize: 8, fontWeight: '700', color: COLORS.primary },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border },
  timeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  timeTextActive: { color: COLORS.white, fontWeight: '700' },
  addressInput: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.surface, textAlignVertical: 'top' },
  safetyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#ebfaf0', padding: 14, borderRadius: 12 },
  safetyText: { flex: 1, fontSize: 12, color: COLORS.text, lineHeight: 18 },
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg, padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  balanceMeta: { fontSize: 11, color: COLORS.textSecondary },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.background, borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.m, gap: 10 },
  bottomService: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomServiceName: { fontSize: 13, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
  bottomServicePrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14 },
  nextBtnDisabled: { opacity: 0.5 },
  nextBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
