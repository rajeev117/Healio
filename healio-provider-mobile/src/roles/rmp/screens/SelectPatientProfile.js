// ─────────────────────────────────────────────────────────────────────────────
// SelectPatientProfile — "who is this booking for?", between consent and the
// service flow.
//
// A linked patient is an ACCOUNT, and an account can cover a household: the
// dependents in `family_profiles`. Booking always writes patient_id = the
// account, plus a family_member_id naming the person actually being treated —
// without which a child's visit is filed as the parent's, and every record and
// prescription derived from it follows.
//
// Patients with no dependents (the common case) never see this screen: it
// forwards straight through.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getService } from '../constants/services';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { CustomButton } from '../components/CustomButton';
import { fetchPatientFamily } from '../services/api';

// 'self' is the account holder; anything else is a family_profiles id.
const SELF = 'self';

export default function SelectPatientProfile({ navigation, route }) {
  const { patient } = route.params;
  const service = getService(route.params?.service);

  const [family, setFamily] = useState([]);
  const [selectedId, setSelectedId] = useState(SELF);
  const [loading, setLoading] = useState(true);

  // Build the object every downstream screen treats as "the patient".
  //
  // `id` stays the ACCOUNT id — that is what patient_id and every RLS policy
  // key on — and `phone` stays the account holder's, since they are the contact
  // for the visit. Only `name` becomes the person being treated, which is what
  // makes every existing display and provider-queue `patientName` correct
  // without touching those screens.
  const buildSubject = useCallback((member) => (
    member
      ? {
          ...patient,
          name: member.name,
          familyMemberId: member.id,
          relation: member.relation,
          accountName: patient.name,
        }
      : { ...patient, familyMemberId: null }
  ), [patient]);

  const goNext = useCallback((member) => {
    navigation.replace(service.afterConsent, {
      patient: buildSubject(member),
      service: service.key,
    });
  }, [navigation, service, buildSubject]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const members = await fetchPatientFamily(patient.id);
      if (!alive) return;
      // Nothing to choose between — don't make them tap through an empty step.
      if (members.length === 0) { goNext(null); return; }
      setFamily(members);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [patient.id, goNext]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScreenHeader title="Who is this for?" onBack={() => navigation.goBack()} />
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  const selectedMember = family.find(m => m.id === selectedId) || null;

  const Row = ({ id, name, sub, isSelf }) => {
    const active = selectedId === id;
    return (
      <TouchableOpacity
        style={[styles.card, active && styles.cardSelected]}
        onPress={() => setSelectedId(id)}
        activeOpacity={0.8}
      >
        <Avatar name={name} size={44} />
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
        {isSelf && (
          <View style={styles.accountPill}>
            <Ionicons name="person" size={10} color={COLORS.primary} />
            <Text style={styles.accountPillText}>Account</Text>
          </View>
        )}
        <View style={[styles.radio, active && styles.radioSelected]}>
          {active && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Who is this for?" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.noteBar}>
          <Ionicons name="people-outline" size={16} color={COLORS.primary} />
          <Text style={styles.noteText}>
            This number covers a family. Pick the person you are {service.consentNote} for —
            their records stay under their own profile.
          </Text>
        </View>

        <Row
          id={SELF}
          name={patient.name}
          sub={[patient.phone, patient.age != null ? `${patient.age} yrs` : null, patient.gender]
            .filter(Boolean).join(' · ')}
          isSelf
        />

        <Text style={styles.sectionLabel}>FAMILY MEMBERS</Text>
        {family.map(m => (
          <Row
            key={m.id}
            id={m.id}
            name={m.name}
            sub={[m.relation, m.age != null ? `${m.age} yrs` : null, m.gender]
              .filter(Boolean).join(' · ')}
          />
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>

      <View style={styles.footer}>
        <CustomButton title="Continue" onPress={() => goNext(selectedMember)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  noteBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.primarySoft, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 18, marginBottom: 4,
  },
  noteText: { flex: 1, fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 17 },
  sectionLabel: {
    fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary,
    letterSpacing: 0.6, marginTop: 22, marginBottom: 4,
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginTop: 12,
  },
  cardSelected: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 14.5, fontWeight: '700', color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  accountPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.primarySoft, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3, marginRight: 10,
  },
  accountPillText: { fontSize: 9.5, fontWeight: '800', color: COLORS.primary },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    borderColor: COLORS.border, backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
