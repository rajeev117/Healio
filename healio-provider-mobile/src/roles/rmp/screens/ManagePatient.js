import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { fetchPatientFamily } from '../services/api';

// One place to manage a linked patient: book visits, raise an emergency
// admission, review their bookings. Reached right after linking (NewPatient)
// or by tapping a patient in the Patients tab.
export default function ManagePatient({ navigation, route }) {
  const patient = route?.params?.patient;

  // The account's dependents. Only readable once the patient is linked — the
  // rmp_patient_family gate keys on that — which is exactly true here, so this
  // is the first screen that can show the household.
  const [family, setFamily] = useState([]);
  useEffect(() => {
    if (!patient?.id) return;
    let alive = true;
    fetchPatientFamily(patient.id)
      .then(members => { if (alive) setFamily(members); })
      .catch(() => {});
    return () => { alive = false; };
  }, [patient?.id]);

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Manage Patient" onBack={() => navigation.goBack()} />
        <Text style={styles.empty}>No patient selected.</Text>
      </SafeAreaView>
    );
  }

  const meta = [
    patient.phone,
    patient.age != null ? `${patient.age} yrs` : null,
    patient.gender,
    patient.language,
  ].filter(Boolean).join(' · ');

  const Action = ({ icon, iconBg, iconColor, title, sub, onPress, danger }) => (
    <TouchableOpacity style={[styles.action, danger && styles.actionDanger]} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIcon, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, danger && { color: '#b91c1c' }]}>{title}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={danger ? '#b91c1c' : COLORS.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Manage Patient" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* Patient banner */}
        <View style={styles.banner}>
          <Avatar name={patient.name} size={54} />
          <View style={styles.bannerInfo}>
            <Text style={styles.bannerName}>{patient.name}</Text>
            <Text style={styles.bannerMeta}>{meta}</Text>
          </View>
          <View style={styles.linkedPill}>
            <Ionicons name="link" size={11} color={COLORS.primary} />
            <Text style={styles.linkedPillText}>Linked</Text>
          </View>
        </View>

        {/* Household — shown only when this account covers dependents, so the
            consultant knows before booking that there is someone to choose. */}
        {family.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>HOUSEHOLD</Text>
            <View style={styles.familyCard}>
              {family.map((m, i) => (
                <View key={m.id} style={[styles.familyRow, i > 0 && styles.familyRowDivided]}>
                  <Avatar name={m.name} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.familyName}>{m.name}</Text>
                    <Text style={styles.familyMeta}>
                      {[m.relation, m.age != null ? `${m.age} yrs` : null, m.gender].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              ))}
              <Text style={styles.familyNote}>
                Every booking below asks who it is for — pick a member and their records
                stay under their own profile.
              </Text>
            </View>
          </>
        )}

        {/* Emergency — kept on top: in a real emergency nobody should scroll */}
        <Text style={styles.sectionLabel}>EMERGENCY</Text>
        <Action
          icon="alarm-light"
          iconBg="#fee2e2"
          iconColor="#dc2626"
          title="Emergency Admission"
          sub="Alert a hospital now — they respond within 5 minutes"
          onPress={() => navigation.navigate('ConsentOTP', { patient, service: 'emergency' })}
          danger
        />

        <Text style={styles.sectionLabel}>CARE</Text>
        <Action
          icon="stethoscope"
          iconBg={COLORS.primarySoft}
          iconColor={COLORS.primary}
          title="Book Appointment"
          sub="Doctor consultation with OTP consent"
          onPress={() => navigation.navigate('ConsentOTP', { patient, service: 'doctor' })}
        />
        <Action
          icon="hospital-building"
          iconBg="#fff3e0"
          iconColor="#b45309"
          title="Book Hospital Visit"
          sub="Pick a hospital, then one of its doctors"
          onPress={() => navigation.navigate('ConsentOTP', { patient, service: 'hospital' })}
        />
        <Action
          icon="test-tube"
          iconBg="#f3e5f5"
          iconColor="#7b2d8e"
          title="Book Lab Tests"
          sub="Send the prescription — the lab prices it"
          onPress={() => navigation.navigate('ConsentOTP', { patient, service: 'lab' })}
        />
        <Action
          icon="pill"
          iconBg="#e8f5e9"
          iconColor="#1b7a3d"
          title="Order Medicines"
          sub="Send the prescription — the pharmacy prices it"
          onPress={() => navigation.navigate('ConsentOTP', { patient, service: 'pharmacy' })}
        />
        <Action
          icon="clipboard-text-outline"
          iconBg="#eef6ff"
          iconColor="#2b6cb0"
          title="View Bookings"
          sub="All appointments booked for your patients"
          onPress={() => navigation.navigate('Main', { screen: 'Bookings' })}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  empty: { textAlign: 'center', marginTop: 60, color: COLORS.textSecondary },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, padding: 16, marginTop: 20,
  },
  bannerInfo: { flex: 1 },
  bannerName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  bannerMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  linkedPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  linkedPillText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  sectionLabel: {
    fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary,
    letterSpacing: 0.6, marginTop: 24, marginBottom: 10,
  },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  actionDanger: { borderColor: '#fecaca', backgroundColor: '#fff7f7' },
  actionIcon: {
    width: 44, height: 44, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  actionSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  familyCard: {
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4,
  },
  familyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  familyRowDivided: { borderTopWidth: 1, borderTopColor: COLORS.border },
  familyName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  familyMeta: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2 },
  familyNote: {
    fontSize: 11, color: COLORS.textSecondary, lineHeight: 15.5,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingTop: 9, paddingBottom: 10,
  },
});
