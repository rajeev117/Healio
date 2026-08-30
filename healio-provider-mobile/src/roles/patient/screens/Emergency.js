import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Linking, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Emergency screen
// Accessible from Services → Emergency
// When Supabase is connected:
//   - Nearby hospitals pulled from supabase.from('organisations').select()
//     filtered by location (PostGIS or lat/lng radius)
//   - Emergency contacts stored in user profile
// ─────────────────────────────────────────────────────────────────────────────

const EMERGENCY_NUMBERS = [
  { label: 'Ambulance',        number: '108',        icon: 'car',              color: '#dc2626', bg: '#fee2e2' },
  { label: 'Police',           number: '100',        icon: 'shield',            color: '#1d4ed8', bg: '#dbeafe' },
  { label: 'Fire Brigade',     number: '101',        icon: 'flame',             color: '#ea580c', bg: '#ffedd5' },
  { label: 'Healio Emergency', number: '1800-123-9999', icon: 'medical-bag',        color: COLORS.primary, bg: '#fdf2f0' },
];

const NEARBY_HOSPITALS = [
  { id: 'h1', name: 'City Hospital Dhaka',    distance: '0.8 km', time: '4 min',  phone: '+880 2 9886601', beds: 12, emergency: true },
  { id: 'h2', name: 'MediCare Clinic',        distance: '1.4 km', time: '7 min',  phone: '+880 2 9886602', beds: 4,  emergency: false },
  { id: 'h3', name: 'Apollo Diagnostics',     distance: '2.1 km', time: '10 min', phone: '+880 2 9886603', beds: 0,  emergency: false },
];

const FIRST_AID_TIPS = [
  { title: 'Choking',       icon: 'person',     tip: 'Perform 5 back blows then 5 abdominal thrusts. Call 108.' },
  { title: 'Heart Attack',  icon: 'heart',      tip: 'Have them sit or lie down. Loosen tight clothing. Call 108 immediately.' },
  { title: 'Burns',         icon: 'flame',      tip: 'Cool with running water for 10+ min. Do not apply ice or butter.' },
  { title: 'Bleeding',      icon: 'water',      tip: 'Apply firm pressure with a clean cloth. Elevate the wound.' },
];

export default function Emergency({ navigation }) {
  const [sosActive, setSosActive] = useState(false);

  const callNumber = (number) => {
    Linking.openURL(`tel:${number.replace(/[^0-9]/g, '')}`).catch(() =>
      Alert.alert('Cannot make call', 'Please dial ' + number + ' manually.')
    );
  };

  const handleSOS = () => {
    Alert.alert(
      '🚨 Send SOS?',
      'This will call 108 and send your location to your emergency contacts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send SOS', style: 'destructive',
          onPress: () => {
            setSosActive(true);
            callNumber('108');
            // → When Supabase is connected:
            // await supabase.from('sos_alerts').insert({
            //   patient_id: user.id,
            //   location: currentLocation,
            //   triggered_at: new Date().toISOString(),
            // });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Emergency</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* SOS Button */}
        <View style={styles.sosSection}>
          <TouchableOpacity
            style={[styles.sosBtn, sosActive && styles.sosBtnActive]}
            onPress={handleSOS}
            activeOpacity={0.85}>
            <Ionicons name="alert-circle" size={36} color={COLORS.white} />
            <Text style={styles.sosBtnText}>SOS</Text>
            <Text style={styles.sosBtnSub}>Tap to call 108 + alert contacts</Text>
          </TouchableOpacity>
        </View>

        {/* Emergency numbers */}
        <Text style={styles.sectionTitle}>Emergency Numbers</Text>
        <View style={styles.numbersGrid}>
          {EMERGENCY_NUMBERS.map(item => (
            <TouchableOpacity key={item.label} style={[styles.numberCard, { backgroundColor: item.bg }]}
              onPress={() => callNumber(item.number)}>
              <View style={[styles.numberIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={[styles.numberLabel, { color: item.color }]}>{item.label}</Text>
              <Text style={styles.numberValue}>{item.number}</Text>
              <View style={[styles.callPill, { backgroundColor: item.color }]}>
                <Ionicons name="call" size={12} color={COLORS.white} />
                <Text style={styles.callPillText}>Call</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Nearby hospitals */}
        <Text style={styles.sectionTitle}>Nearest Hospitals</Text>
        <View style={styles.hospitalsSection}>
          {NEARBY_HOSPITALS.map(h => (
            <View key={h.id} style={styles.hospitalCard}>
              <View style={styles.hospitalLeft}>
                <View style={[styles.hospitalIcon, { backgroundColor: h.emergency ? '#fee2e2' : COLORS.primarySoft }]}>
                  <MaterialCommunityIcons name="hospital-building" size={18} color={h.emergency ? '#dc2626' : COLORS.primary} />
                </View>
                <View style={styles.hospitalInfo}>
                  <View style={styles.hospitalNameRow}>
                    <Text style={styles.hospitalName}>{h.name}</Text>
                    {h.emergency && (
                      <View style={styles.emergencyBadge}>
                        <Text style={styles.emergencyBadgeText}>24hr ER</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.hospitalMeta}>{h.distance} · ~{h.time} drive</Text>
                  {h.beds > 0 && <Text style={styles.hospitalBeds}>{h.beds} emergency beds available</Text>}
                </View>
              </View>
              <TouchableOpacity onPress={() => callNumber(h.phone)} style={styles.hospitalCallBtn}>
                <Ionicons name="call" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* First aid tips */}
        <Text style={styles.sectionTitle}>Quick First Aid</Text>
        <View style={{ paddingHorizontal: SPACING.m, gap: 10 }}>
          {FIRST_AID_TIPS.map(tip => (
            <View key={tip.title} style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Ionicons name={tip.icon} size={18} color={COLORS.primary} />
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipText}>{tip.tip}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  sosSection: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#fff5f5' },
  sosBtn: {
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowColor: '#dc2626', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  sosBtnActive: { backgroundColor: '#991b1b' },
  sosBtnText: { fontSize: 28, fontWeight: '900', color: COLORS.white },
  sosBtnSub: { fontSize: 9, color: 'rgba(255,255,255,0.8)', textAlign: 'center', paddingHorizontal: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, paddingHorizontal: SPACING.m, marginTop: 20, marginBottom: 12 },
  numbersGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.m, gap: 10 },
  numberCard: {
    width: '47%', padding: 14, borderRadius: 16, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  numberIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numberLabel: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  numberValue: { fontSize: 14, fontWeight: '700', color: COLORS.text, fontFamily: 'monospace' },
  callPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  callPillText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  hospitalsSection: { paddingHorizontal: SPACING.m, gap: 10 },
  hospitalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    padding: SPACING.m, borderWidth: 1, borderColor: COLORS.border,
  },
  hospitalLeft:    { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  hospitalIcon:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hospitalInfo:    { flex: 1, gap: 3 },
  hospitalNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hospitalName:    { fontSize: 13, fontWeight: '700', color: COLORS.text, flex: 1 },
  emergencyBadge:  { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  emergencyBadgeText: { fontSize: 9, fontWeight: '800', color: '#dc2626' },
  hospitalMeta:    { fontSize: 11, color: COLORS.textSecondary },
  hospitalBeds:    { fontSize: 11, color: COLORS.success, fontWeight: '600' },
  hospitalCallBtn: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  tipCard: {
    flexDirection: 'row', gap: 12, backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusLg, padding: SPACING.m,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'flex-start',
  },
  tipIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tipContent: { flex: 1 },
  tipTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  tipText:   { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
});
