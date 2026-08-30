import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';
import { SLOT_STATE, DAY_STATE, getNextNDays } from '../../../lib/schedule';
import {
  fetchDoctorAppointments,
  fetchDoctorAvailability,
  fetchDoctorScheduleConflicts,
} from '../services/doctorData';

// ─────────────────────────────────────────────────────────────────────────────
// My Schedule — REAL data only.
//
// This screen used to render a hardcoded SCHEDULE = { Mon: {morning: [...] } }
// template with a comment claiming the backend had no availability table. It
// did (doctor_schedules, migration 013) — nothing read it. Now:
//   • the day strip shows the next 7 actual dates, not generic weekday names
//   • slots come from doctor_availability(), the same grid patients book from
//   • a taken slot is RED and names the patient — a doctor should be able to
//     tell at a glance what is spoken for
//   • leave and blocked slots are distinguished from booked ones
//   • an appointment stranded by a schedule change is flagged, not hidden
//
// A hospital-affiliated doctor and their hospital can BOTH edit this (RLS:
// can_manage_doctor_schedule), so the Edit button is here as well as on the
// hospital's Doctors → doctor → Open schedule path. Both land on the same
// root-stack DoctorSchedule screen.
// ─────────────────────────────────────────────────────────────────────────────

const sameInstant = (a, b) => {
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  return Number.isFinite(x) && x === y;
};

export default function Schedule({ navigation }) {
  const { t } = useLanguage();
  const week = getNextNDays(7);
  const [selected, setSelected] = useState(0);
  const [availability, setAvailability] = useState({ order: [], days: {} });
  const [appointments, setAppointments] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [avail, appts, cons] = await Promise.all([
        fetchDoctorAvailability(7),
        fetchDoctorAppointments(),
        fetchDoctorScheduleConflicts(),
      ]);
      setAvailability(avail);
      setAppointments(appts);
      setConflicts(cons);
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const day = availability.days[week[selected].iso] || { state: DAY_STATE.OFF, sessions: [], slots: [], counts: {} };
  const hasAnySchedule = Object.values(availability.days).some((d) => d.slots?.length);

  const upcomingCount = appointments.filter(
    (a) => !a.isPast && a.status !== 'cancelled' && a.status !== 'completed',
  ).length;

  // Who is in a given slot — so a red chip can carry a name, not just "Booked".
  const patientAt = (at) => {
    const appt = appointments.find(
      (a) => a.rawStatus !== 'cancelled' && a.rawStatus !== 'completed' && sameInstant(a.scheduledAt, at),
    );
    return appt?.patientName || null;
  };

  const conflictsOnDay = conflicts.filter(
    (c) => new Date(c.scheduledAt).toDateString() === week[selected].date.toDateString(),
  );

  const renderSlots = (slots) => (
    <View style={styles.slotsGrid}>
      {slots.map((slot) => {
        const booked = slot.state === SLOT_STATE.FULL;
        const blocked = slot.state === SLOT_STATE.BLOCKED;
        const past = slot.state === SLOT_STATE.PAST;
        const name = booked ? patientAt(slot.at) : null;
        return (
          <View
            key={`${slot.sessionId}-${slot.time}`}
            style={[
              styles.slot,
              booked && styles.bookedSlot,
              blocked && styles.blockedSlot,
              past && !booked && styles.pastSlot,
            ]}
          >
            <Ionicons
              name={booked ? 'person' : blocked ? 'close-circle-outline' : 'time-outline'}
              size={13}
              color={booked ? COLORS.white : blocked ? COLORS.error : COLORS.primary}
            />
            <View>
              <Text style={[styles.slotTime, booked && styles.bookedSlotTime]}>{slot.label}</Text>
              {booked && (
                <Text style={styles.bookedLabel} numberOfLines={1}>
                  {name || t('doc_booked')}
                  {slot.capacity > 1 ? ` · ${slot.booked}/${slot.capacity}` : ''}
                </Text>
              )}
              {blocked && <Text style={styles.blockedLabel}>{t('sched_legend_blocked')}</Text>}
              {!booked && !blocked && slot.capacity > 1 && slot.booked > 0 && (
                <Text style={styles.spotsLabel}>{slot.spotsLeft} left</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('doc_my_schedule')}</Text>
            <Text style={styles.headerSub}>{t('doc_upcoming_appts', { count: upcomingCount })}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('DoctorSchedule')}>
            <Ionicons name="create-outline" size={15} color={COLORS.white} />
            <Text style={styles.editBtnText}>{t('sched_edit')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day selector — real dates, so "Thu 28" means the 28th. */}
      <View style={styles.dayBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {week.map((d, i) => {
            const info = availability.days[d.iso];
            const isOff = !info || info.state !== DAY_STATE.OPEN;
            const isLeave = info?.state === DAY_STATE.LEAVE;
            return (
              <TouchableOpacity
                key={d.iso}
                style={[styles.dayChip, selected === i && styles.activeDayChip, isOff && styles.offDayChip]}
                onPress={() => setSelected(i)}
              >
                <Text style={[styles.dayText, selected === i && styles.activeDayText]}>{d.day}</Text>
                <Text style={[styles.dayNum, selected === i && styles.activeDayText]}>{d.num}</Text>
                {d.isToday
                  ? <Text style={[styles.todayTag, selected === i && styles.activeDayText]}>•</Text>
                  : <View style={{ height: 12 }} />}
                {isLeave && <View style={styles.leaveDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {!loading && !hasAnySchedule ? (
          <View style={styles.offBox}>
            <Ionicons name="calendar-outline" size={40} color={COLORS.border} />
            <Text style={styles.offTitle}>{t('sched_no_sessions')}</Text>
            <Text style={styles.offSub}>{t('sched_no_sessions_sub')}</Text>
            <TouchableOpacity style={styles.setupBtn} onPress={() => navigation.navigate('DoctorSchedule')}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
              <Text style={styles.setupBtnText}>{t('sched_setup')}</Text>
            </TouchableOpacity>
          </View>
        ) : day.state === DAY_STATE.LEAVE ? (
          <View style={styles.offBox}>
            <Ionicons name="moon-outline" size={40} color={COLORS.border} />
            <Text style={styles.offTitle}>{t('sched_on_leave')}</Text>
            <Text style={styles.offSub}>{t('doc_no_slots', { day: week[selected].day })}</Text>
          </View>
        ) : day.slots.length === 0 ? (
          <View style={styles.offBox}>
            <Ionicons name="moon-outline" size={40} color={COLORS.border} />
            <Text style={styles.offTitle}>{t('doc_day_off')}</Text>
            <Text style={styles.offSub}>{t('doc_no_slots', { day: week[selected].day })}</Text>
          </View>
        ) : (
          <>
            <View style={styles.legend}>
              <LegendDot color={COLORS.white} border={COLORS.border} label={t('sched_legend_free')} />
              <LegendDot color={COLORS.error} border={COLORS.error} label={t('sched_legend_booked')} />
              <LegendDot color={COLORS.dangerSoft} border={COLORS.error} label={t('sched_legend_blocked')} />
            </View>

            {day.sessions.map((session, i) => (
              <View key={session.id || i} style={styles.section}>
                <View style={styles.sessionHeader}>
                  <View style={[styles.sessionDot, { backgroundColor: SESSION_DOTS[i % SESSION_DOTS.length] }]} />
                  <Text style={styles.sessionTitle}>{session.name}</Text>
                  <Text style={styles.sessionCount}>{session.slots.length} {t('doc_slots')}</Text>
                </View>
                {renderSlots(session.slots)}
              </View>
            ))}

            {conflictsOnDay.length > 0 && (
              <View style={styles.conflictBox}>
                <Ionicons name="warning-outline" size={16} color={COLORS.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.conflictTitle}>{t('sched_conflict_badge')}</Text>
                  {conflictsOnDay.map((c) => (
                    <Text key={c.id} style={styles.conflictRow}>
                      {new Date(c.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      {' · '}{c.patientName}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.summaryCard}>
              <SummaryRow icon="time-outline" label={t('doc_total_slots')} value={`${day.counts.total || 0}`} color={COLORS.primary} />
              <SummaryRow icon="person" label={t('doc_booked')} value={`${day.counts.full || 0}`} color={COLORS.error} />
              <SummaryRow icon="radio-button-off-outline" label={t('doc_available')} value={`${day.counts.free || 0}`} color={COLORS.success} />
            </View>
          </>
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const SESSION_DOTS = ['#FF8A00', '#6B46C1', '#3182CE', '#16a34a'];

const LegendDot = ({ color, border, label }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendSwatch, { backgroundColor: color, borderColor: border }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const SummaryRow = ({ icon, label, value, color }) => (
  <View style={styles.summaryRow}>
    <View style={[styles.summaryIcon, { backgroundColor: color + '18' }]}>
      <Ionicons name={icon} size={16} color={color} />
    </View>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, { color }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: {
    backgroundColor: COLORS.primary, paddingHorizontal: 20,
    paddingTop: 12, paddingBottom: SPACING.l,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  editBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  dayBar: {
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dayScroll: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  dayChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, gap: 2, minWidth: 54,
  },
  activeDayChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  offDayChip: { opacity: 0.45 },
  dayText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  dayNum: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  activeDayText: { color: COLORS.white },
  todayTag: { fontSize: 12, fontWeight: '800', color: COLORS.primary, height: 12, lineHeight: 12 },
  leaveDot: { width: 5, height: 5, borderRadius: 4, backgroundColor: COLORS.error },

  container: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },
  offBox: { alignItems: 'center', marginTop: 70, gap: 10, paddingHorizontal: 24 },
  offTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textSecondary },
  offSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  setupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
  },
  setupBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },

  legend: { flexDirection: 'row', gap: 16, marginTop: SPACING.m, marginBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

  section: { marginTop: SPACING.m },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sessionDot: { width: 10, height: 10, borderRadius: 4 },
  sessionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, flex: 1 },
  sessionCount: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, gap: 6, maxWidth: 200,
  },
  slotTime: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  // Taken slots are red, not brand-coloured — this is the "you cannot have
  // this one" signal, and it has to read as such at a glance.
  bookedSlot: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  bookedSlotTime: { color: COLORS.white },
  bookedLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginTop: 1 },
  blockedSlot: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error, borderStyle: 'dashed' },
  blockedLabel: { fontSize: 10, color: COLORS.error, fontWeight: '700', marginTop: 1 },
  pastSlot: { opacity: 0.45 },
  spotsLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 1 },

  conflictBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: SPACING.m,
    backgroundColor: COLORS.warningSoft, borderWidth: 1, borderColor: '#eccf7a',
    borderRadius: 12, padding: 14,
  },
  conflictTitle: { fontSize: 12, fontWeight: '800', color: '#8a6100' },
  conflictRow: { fontSize: 12, color: '#8a6100', marginTop: 3 },

  summaryCard: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16, marginTop: SPACING.l,
    borderWidth: 1, borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.hairline, gap: 12,
  },
  summaryIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  summaryValue: { fontSize: 20, fontWeight: '800' },
});
