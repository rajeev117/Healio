import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { CustomButton } from '../components/CustomButton';
import { fetchAvailableSlots } from '../services/api';
import { SLOT_STATE } from '../../../lib/schedule';

function buildDates() {
  const today = new Date();
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return {
      id: d.toISOString().slice(0, 10),
      day: DAYS[d.getDay()],
      date: d.getDate(),
      dateStr: d.toISOString().slice(0, 10),
    };
  });
}

const DATES = buildDates();
const SLOT_MONTH = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

export default function SlotSelection({ navigation, route }) {
  const { patient, provider } = route.params;
  const [dateId, setDateId] = useState(DATES[0].id);
  const [slot, setSlot] = useState(null);   // the whole slot object
  const [slotTimes, setSlotTimes] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSlot(null);
    setLoading(true);
    fetchAvailableSlots(provider.id, dateId)
      .then(slots => setSlotTimes(slots))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [provider.id, dateId]);

  const selectedDate = DATES.find(d => d.id === dateId);

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Select Slot" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.providerCard}>
          <Avatar name={provider.name.replace('Dr ', '')} />
          <View style={styles.providerInfo}>
            <Text style={styles.providerName}>{provider.name}</Text>
            <Text style={styles.providerMeta}>{provider.specialty} · ₹{provider.serviceCharge} service</Text>
          </View>
        </View>

        <View style={styles.dateHeader}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <Text style={styles.monthLabel}>{SLOT_MONTH}</Text>
        </View>
        <View style={styles.dateRow}>
          {DATES.map(d => {
            const isSelected = d.id === dateId;
            return (
              <TouchableOpacity key={d.id} style={[styles.dateChip, isSelected && styles.dateChipSelected]} onPress={() => { setDateId(d.id); setSlot(null); }}>
                <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>{d.day}</Text>
                <Text style={[styles.dateNum, isSelected && styles.dateTextSelected]}>{d.date}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.primary} />
        ) : Object.entries(slotTimes).map(([period, times]) => times.length > 0 ? (
          <View key={period}>
            <Text style={styles.periodLabel}>{period}</Text>
            <View style={styles.timeRow}>
              {times.map(s => {
                const isSelected = slot?.time === s.time && slot?.sessionId === s.sessionId;
                const taken = s.state === SLOT_STATE.FULL;
                const off = s.state === SLOT_STATE.BLOCKED || s.state === SLOT_STATE.PAST;
                return (
                  <TouchableOpacity
                    key={`${s.sessionId}-${s.time}`}
                    disabled={taken || off}
                    style={[
                      styles.timeChip,
                      isSelected && styles.timeChipSelected,
                      taken && styles.timeChipTaken,
                      off && styles.timeChipOff,
                    ]}
                    onPress={() => setSlot(s)}
                  >
                    <Text style={[
                      styles.timeText,
                      isSelected && styles.dateTextSelected,
                      taken && styles.timeTextTaken,
                    ]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null)}
      </ScrollView>
      <View style={styles.footer}>
        <CustomButton
          title="Continue"
          disabled={!slot}
          onPress={() => navigation.navigate('ReviewBooking', {
            patient,
            provider,
            // `at` is the server-resolved instant — carried through to
            // createBooking so the booking lands on the slot that was tapped.
            slot: {
              day: selectedDate.day,
              date: selectedDate.date,
              dateStr: selectedDate.dateStr,
              month: SLOT_MONTH,
              time: slot.label,
              at: slot.at,
            },
          })}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  providerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 14, padding: 12, marginTop: 24 },
  providerInfo: { marginLeft: 12 },
  providerName: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  providerMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  monthLabel: { fontSize: 12.5, color: COLORS.textSecondary },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dateChip: { width: 58, height: 72, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  dateChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  // A slot someone else holds stays visible and reads as taken, rather than
  // silently disappearing from the list as it used to.
  timeChipTaken: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error },
  timeChipOff: { opacity: 0.4, borderStyle: 'dashed' },
  timeTextTaken: { color: COLORS.error, textDecorationLine: 'line-through' },
  dateDay: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '500' },
  dateNum: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  dateTextSelected: { color: COLORS.white },
  periodLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginTop: 22, marginBottom: 10 },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { width: 68, height: 34, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  timeChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  timeText: { fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
