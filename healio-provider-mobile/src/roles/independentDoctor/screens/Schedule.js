import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useLanguage } from '../../../context/LanguageContext';
import { SLOT_STATE, DAY_STATE, getNextNDays, fmt12 } from '../../../lib/schedule';
import {
  fetchDoctorAppointments,
  fetchDoctorAvailability,
  fetchDoctorScheduleConflicts,
} from '../services/doctorData';

// ─────────────────────────────────────────────────────────────────────────────
// My Schedule — REAL data only:
//   • the day strip shows the next 7 actual dates (not generic weekdays)
//   • slots come from doctor_availability() — the same server-generated grid a
//     patient books against, so what is shown here IS what is bookable
//   • a taken slot is RED and names the patient; leave and blocked slots are
//     visually distinct from booked ones
//   • an appointment stranded by a schedule change is flagged, never hidden
//
// For an individual doctor this is the only place their availability is set —
// there is no hospital admin to do it for them, so the empty state pushes
// straight into setup rather than assuming someone else will.
// ─────────────────────────────────────────────────────────────────────────────

const sameInstant = (a, b) => {
  const x = new Date(a).getTime();
  const y = new Date(b).getTime();
  return Number.isFinite(x) && x === y;
};

export default function Schedule({ navigation }) {
  const { t } = useLanguage();
  const week = getNextNDays(7);
  const [selected, setSelected] = useState(0);           // index into week
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

  const selectedDay = week[selected].day;
  const day = availability.days[week[selected].iso]
    || { state: DAY_STATE.OFF, sessions: [], slots: [], counts: {} };

  const hasSchedule = Object.values(availability.days).some((d) => d.slots?.length);
  const workingDay = day.slots.length > 0 && day.state !== DAY_STATE.LEAVE;
  const totalSlots = day.counts.total || 0;

  // Appointments on the SELECTED DATE (not just the same weekday)
  const dayAppointments = appointments.filter((a) => {
    if (!a.scheduledAt || a.status === 'cancelled') return false;
    return new Date(a.scheduledAt).toDateString() === week[selected].date.toDateString();
  });

  const upcomingCount = appointments.filter(
    (a) => !a.isPast && a.status !== 'cancelled' && a.status !== 'completed',
  ).length;

  const conflictsOnDay = conflicts.filter(
    (c) => new Date(c.scheduledAt).toDateString() === week[selected].date.toDateString(),
  );

  // Who is in a given slot — a red chip should carry a name, not just "Booked".
  const patientAt = (at) => {
    const appt = appointments.find(
      (a) => a.status !== 'cancelled' && a.status !== 'completed' && sameInstant(a.scheduledAt, at),
    );
    return appt?.patientName || null;
  };

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
                  {name || t('idoc_booked')}
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
        <View style={styles.ring} pointerEvents="none" />
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{t('idoc_my_schedule')}</Text>
            <Text style={styles.headerSub}>{t('idoc_upcoming_count', { n: upcomingCount })}</Text>
          </View>
          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('DoctorSchedule')}>
            <Ionicons name="create-outline" size={16} color={COLORS.white} />
            <Text style={styles.editBtnText}>{t('idoc_edit')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Date selector — real dates, starting today */}
      <View style={styles.dayBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          {week.map((w, i) => {
            const info = availability.days[w.iso];
            const isOff = hasSchedule && (!info || info.state !== DAY_STATE.OPEN);
            const isLeave = info?.state === DAY_STATE.LEAVE;
            return (
              <TouchableOpacity
                key={w.iso}
                style={[styles.dayChip, selected === i && styles.activeDayChip, isOff && styles.offDayChip]}
                onPress={() => setSelected(i)}
              >
                <Text style={[styles.dayText, selected === i && styles.activeDayText, isOff && styles.offDayText]}>{w.day}</Text>
                <Text style={[styles.dayNum, selected === i && styles.activeDayText, isOff && styles.offDayText]}>{w.num}</Text>
                {w.isToday && <Text style={[styles.todayTag, selected === i && { color: 'rgba(255,255,255,0.85)' }]}>{t('idoc_today')}</Text>}
                {isLeave && <View style={styles.leaveDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {!hasSchedule ? (
          // No weekly schedule saved yet — honest empty state, no fake template
          <View style={styles.offBox}>
            <Ionicons name="calendar-outline" size={40} color={COLORS.borderStrong} />
            <Text style={styles.offTitle}>{t('idoc_no_schedule')}</Text>
            <Text style={styles.offSub}>{t('idoc_no_schedule_sub')}</Text>
            <TouchableOpacity style={styles.setupBtn} onPress={() => navigation.navigate('DoctorSchedule')}>
              <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
              <Text style={styles.setupBtnText}>{t('idoc_setup_schedule')}</Text>
            </TouchableOpacity>
          </View>
        ) : !workingDay ? (
          <View style={styles.offBox}>
            <Ionicons name="moon-outline" size={40} color={COLORS.borderStrong} />
            <Text style={styles.offTitle}>
              {day.state === DAY_STATE.LEAVE ? t('sched_on_leave') : t('idoc_day_off')}
            </Text>
            <Text style={styles.offSub}>
              {t('idoc_no_sessions_on', { day: selectedDay, num: week[selected].num })}
              {dayAppointments.length > 0 ? ` — ${t('idoc_but_booked', { n: dayAppointments.length })}` : ''}
            </Text>
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
                  <View style={[styles.sessionDot, { backgroundColor: i === 0 ? COLORS.warning : COLORS.tintVioletInk }]} />
                  <Text style={styles.sessionTitle}>
                    {session.name}
                    {session.slots.length
                      ? ` · ${fmt12(session.slots[0].time)} – ${fmt12(session.slots[session.slots.length - 1].time)}`
                      : ''}
                  </Text>
                  <Text style={styles.sessionCount}>{t('idoc_n_slots', { n: session.slots.length })}</Text>
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
          </>
        )}

        {workingDay && (
          <View style={styles.summaryCard}>
            <SummaryRow icon="time-outline" label={t('idoc_total_slots')} value={`${totalSlots}`} color={COLORS.primary} />
            <SummaryRow icon="person" label={t('idoc_booked')} value={`${day.counts.full || 0}`} color={COLORS.error} />
            <SummaryRow icon="radio-button-off-outline" label={t('idoc_available')} value={`${day.counts.free || 0}`} color={COLORS.tintBlueInk} />
          </View>
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  safe: { flex: 1, backgroundColor: COLORS.primary },
  header: {
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: SIZES.headerRadiusLeft,
    borderBottomRightRadius: SIZES.headerRadiusRight,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: SPACING.l,
    overflow: 'hidden',
  },
  ring: {
    position: 'absolute', top: -86, right: -58,
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 28, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 25, fontWeight: '900', color: COLORS.white, letterSpacing: -0.5 },
  headerSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  editBtnText: { color: COLORS.white, fontSize: 12.5, fontWeight: '700' },

  dayBar: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dayScroll: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  dayChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, gap: 2, minWidth: 54,
  },
  activeDayChip: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  offDayChip: { opacity: 0.5 },
  dayText: { fontSize: 11.5, fontWeight: '700', color: COLORS.textSecondary },
  dayNum: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  activeDayText: { color: COLORS.white },
  offDayText: { color: COLORS.textSecondary },
  todayTag: { fontSize: 9, fontWeight: '800', color: COLORS.primary },

  container: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },
  offBox: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 24 },
  offTitle: { fontSize: 19, fontWeight: '800', color: COLORS.textSecondary },
  offSub: { fontSize: 13.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  setupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12,
  },
  setupBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },

  section: { marginTop: SPACING.m },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sessionDot: { width: 10, height: 10, borderRadius: 5 },
  sessionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, flex: 1 },
  sessionCount: { fontSize: 11.5, color: COLORS.textSecondary, fontWeight: '700' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slot: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, gap: 6, maxWidth: 200,
  },
  slotTime: { fontSize: 12.5, fontWeight: '600', color: COLORS.text },
  // Taken slots are red, not brand-coloured. This is the "you cannot have this
  // one" signal, and it has to read as such at a glance.
  bookedSlot: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  bookedSlotTime: { color: COLORS.white },
  bookedLabel: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginTop: 1 },
  blockedSlot: { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.error, borderStyle: 'dashed' },
  blockedLabel: { fontSize: 10, color: COLORS.error, fontWeight: '700', marginTop: 1 },
  pastSlot: { opacity: 0.45 },
  spotsLabel: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginTop: 1 },
  leaveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.error, marginTop: 2 },

  legend: { flexDirection: 'row', gap: 16, marginTop: SPACING.m, marginBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

  conflictBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: SPACING.m,
    backgroundColor: COLORS.warningSoft, borderWidth: 1, borderColor: '#eccf7a',
    borderRadius: 14, padding: 14,
  },
  conflictTitle: { fontSize: 12.5, fontWeight: '800', color: '#8a6100' },
  conflictRow: { fontSize: 12, color: '#8a6100', marginTop: 3 },

  summaryCard: {
    backgroundColor: COLORS.white, borderRadius: SIZES.radiusLg, padding: 16, marginTop: SPACING.l,
    borderWidth: 1, borderColor: COLORS.border,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 12,
  },
  summaryIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  summaryLabel: { flex: 1, fontSize: 13.5, fontWeight: '600', color: COLORS.text },
  summaryValue: { fontSize: 20, fontWeight: '900' },
});
