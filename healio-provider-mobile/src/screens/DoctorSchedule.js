// ─────────────────────────────────────────────────────────────────────────────
// DoctorSchedule — where a doctor's availability is actually defined.
//
// Dual-mode, as before:
//   • route.params.doctorId present → the hospital is editing one of its
//     doctors (Doctors → DoctorDetail → Open schedule).
//   • no param → the signed-in doctor is editing their own.
// Registered on the ROOT stack (App.js), so every role reaches the same screen.
// RLS decides who may actually write: the doctor themselves, the org admin, or
// front-desk staff (can_manage_doctor_schedule, migration 058).
//
// What changed: this used to load ONE row with .limit(1).maybeSingle(), so a
// doctor could never have a morning and an evening OPD. It now manages the
// full set of sessions plus time off, and everything it writes is what the
// booking screens read — doctor_availability() generates their grid from here.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../lib/store';
import { useLanguage } from '../context/LanguageContext';
import { COLORS, SPACING } from '../constants/theme';
import { supabase } from '../lib/supabase';
import CalendarPicker from '../components/CalendarPicker';
import TimeSelectModal from '../components/TimeSelectModal';
import {
  DAYS, SLOT_OPTIONS, buildSlots, fmt12, localDay,
  fetchSessions, saveSession, deleteSession,
  fetchExceptions, addException, removeException,
  fetchConflicts, fetchDayAvailability,
} from '../lib/schedule';
import styles from './DoctorSchedule.styles';

const newSession = (capacity = 1) => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name: 'OPD',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  start_time: '09:00',
  end_time: '13:00',
  slot_mins: 15,
  capacity,
  is_active: true,
});

export default function DoctorSchedule({ navigation, route }) {
  const { t } = useLanguage();
  const paramDoctorId = route?.params?.doctorId;
  const storeDoctor = useStore((state) => state.doctors.find((item) => item.id === paramDoctorId));

  const [doctor, setDoctor] = useState(storeDoctor || null);
  const [orgId, setOrgId] = useState(null);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState(null);
  const [userId, setUserId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [removedIds, setRemovedIds] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [conflicts, setConflicts] = useState([]);

  // Modal state
  const [timePicker, setTimePicker] = useState(null);   // { index, field, value, min }
  const [datePicker, setDatePicker] = useState(null);   // 'leave' | 'block'
  const [blockDay, setBlockDay] = useState(null);       // { iso, slots, selected:Set }

  // ── Resolve who we're editing, and under which organisation ────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUserId(authUser?.id || null);

        let staff = storeDoctor || null;
        if (!paramDoctorId && authUser) {
          // A doctor viewing their own schedule — resolve their staff row.
          const { data } = await supabase
            .from('staff')
            .select('id, name, role, department, specialty, organisation_id, patients_per_slot')
            .eq('user_id', authUser.id)
            .maybeSingle();
          if (data) staff = data;
        } else if (paramDoctorId && !storeDoctor) {
          const { data } = await supabase
            .from('staff')
            .select('id, name, role, department, specialty, organisation_id, patients_per_slot')
            .eq('id', paramDoctorId)
            .maybeSingle();
          if (data) staff = data;
        }
        if (staff) setDoctor(staff);

        const resolvedOrg = staff?.organisation_id || await useStore.getState().resolveOrgId();
        setOrgId(resolvedOrg || null);
        if (resolvedOrg) {
          const { data: org } = await supabase
            .from('organisations').select('name, type, default_patients_per_slot')
            .eq('id', resolvedOrg).maybeSingle();
          setOrgName(org?.name || '');
          setOrgType(org?.type || null);
        }
      } catch (_) { /* handled by the empty state */ }
    })();
  }, [paramDoctorId, storeDoctor]);

  const doctorId = doctor?.id;

  const load = useCallback(async () => {
    if (!doctorId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [rows, excs, cons] = await Promise.all([
        fetchSessions(doctorId),
        fetchExceptions(doctorId),
        fetchConflicts(doctorId),
      ]);
      setSessions(rows);
      setExceptions(excs);
      setConflicts(cons);
      setRemovedIds([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => { load(); }, [load]);

  // An independent doctor IS their own clinic — there is no hospital sharing
  // the schedule with them, so the co-management banner would be nonsense.
  const sharedWithHospital = orgType && orgType !== 'clinic';

  const defaultCapacity = Math.max(1, Number(doctor?.patients_per_slot) || 1);

  // ── Session editing (local until Save) ────────────────────────────────────
  const patchSession = (index, patch) =>
    setSessions((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const toggleDay = (index, day) =>
    setSessions((prev) => prev.map((s, i) => {
      if (i !== index) return s;
      const days = s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day];
      return { ...s, days: DAYS.filter((d) => days.includes(d)) };
    }));

  const removeSession = (index) => {
    const target = sessions[index];
    Alert.alert(t('sched_delete_session'), t('sched_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('sched_delete_session'),
        style: 'destructive',
        onPress: () => {
          if (target?.id && !String(target.id).startsWith('new-')) {
            setRemovedIds((prev) => [...prev, target.id]);
          }
          setSessions((prev) => prev.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  const save = async () => {
    if (!doctorId) { Alert.alert(t('sched_no_doctor')); return; }
    if (!orgId) { Alert.alert(t('sched_no_org')); return; }
    const bad = sessions.find((s) => s.days.length === 0);
    if (bad) { Alert.alert(t('sched_no_days'), bad.name || 'OPD'); return; }

    setSaving(true);
    try {
      for (const id of removedIds) await deleteSession(id);
      for (const session of sessions) {
        await saveSession(session, { doctorStaffId: doctorId, organisationId: orgId, userId });
      }
      const [rows, cons] = await Promise.all([
        fetchSessions(doctorId),
        fetchConflicts(doctorId),
      ]);
      setSessions(rows);
      setConflicts(cons);
      setRemovedIds([]);

      // Bookings are never destroyed by a schedule change — say what happened.
      if (cons.length) {
        Alert.alert(
          t('sched_conflicts_title', { n: cons.length }),
          t('sched_conflicts_sub'),
        );
      } else {
        Alert.alert(t('sched_saved'));
      }
    } catch (e) {
      Alert.alert(t('sched_save_failed'), e?.message || '');
    } finally {
      setSaving(false);
    }
  };

  // ── Time off ──────────────────────────────────────────────────────────────
  const markDayOff = async (date) => {
    try {
      await addException({ date: localDay(date) }, {
        doctorStaffId: doctorId, organisationId: orgId, userId,
      });
      setExceptions(await fetchExceptions(doctorId));
      setConflicts(await fetchConflicts(doctorId));
    } catch (e) {
      Alert.alert(t('sched_save_failed'), e?.message || '');
    }
  };

  const openBlockDay = async (date) => {
    const iso = localDay(date);
    const day = await fetchDayAvailability(doctorId, iso);
    setBlockDay({ iso, slots: day.slots, selected: [] });
  };

  const confirmBlockSlots = async () => {
    if (!blockDay?.selected.length) { setBlockDay(null); return; }
    try {
      for (const time of blockDay.selected) {
        const slot = blockDay.slots.find((s) => s.time === time);
        await addException(
          { date: blockDay.iso, startTime: time, endTime: endOfSlot(slot, blockDay.slots) },
          { doctorStaffId: doctorId, organisationId: orgId, userId },
        );
      }
      setBlockDay(null);
      setExceptions(await fetchExceptions(doctorId));
      setConflicts(await fetchConflicts(doctorId));
    } catch (e) {
      Alert.alert(t('sched_save_failed'), e?.message || '');
    }
  };

  const dropException = async (id) => {
    try {
      await removeException(id);
      setExceptions(await fetchExceptions(doctorId));
      setConflicts(await fetchConflicts(doctorId));
    } catch (e) {
      Alert.alert(t('sched_save_failed'), e?.message || '');
    }
  };

  const title = paramDoctorId
    ? (doctor?.name || t('sched_title_mine'))
    : t('sched_title_mine');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={styles.docCard}>
            <Text style={styles.docName}>{doctor?.name || 'Doctor'}</Text>
            <Text style={styles.docSub}>{doctor?.department || doctor?.specialty || doctor?.speciality || 'General'}</Text>
            {sharedWithHospital && (
              <Text style={styles.docNote}>
                {orgName ? t('sched_managed_by', { name: orgName }) : t('sched_managed_by_hospital')}
              </Text>
            )}
          </View>

          {conflicts.length > 0 && (
            <View style={styles.conflictBox}>
              <Ionicons name="warning-outline" size={18} color="#8a6100" />
              <View style={{ flex: 1 }}>
                <Text style={styles.conflictTitle}>{t('sched_conflicts_title', { n: conflicts.length })}</Text>
                <Text style={styles.conflictSub}>{t('sched_conflicts_sub')}</Text>
              </View>
            </View>
          )}

          {/* ── Sessions ─────────────────────────────────────────────────── */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{t('sched_sessions')}</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setSessions((prev) => [...prev, newSession(defaultCapacity)])}
            >
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.addBtnText}>{t('sched_add_session')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionSub}>{t('sched_sessions_sub')}</Text>

          {sessions.length === 0 && (
            <View style={styles.emptyBox}>
              <Ionicons name="calendar-outline" size={34} color={COLORS.border} />
              <Text style={styles.emptyTitle}>{t('sched_no_sessions')}</Text>
              <Text style={styles.emptySub}>{t('sched_no_sessions_sub')}</Text>
            </View>
          )}

          {sessions.map((session, index) => {
            const slots = buildSlots(session.start_time, session.end_time, session.slot_mins);
            return (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <TextInput
                    style={styles.nameInput}
                    value={session.name}
                    onChangeText={(v) => patchSession(index, { name: v })}
                    placeholder={t('sched_session_name_ph')}
                    placeholderTextColor={COLORS.textSecondary}
                  />
                  <TouchableOpacity onPress={() => removeSession(index)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>{t('sched_working_days')}</Text>
                <View style={styles.chipWrap}>
                  {DAYS.map((day) => {
                    const active = session.days.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        onPress={() => toggleDay(index, day)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{day}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{t('sched_start')}</Text>
                    <TouchableOpacity
                      style={styles.timeBtn}
                      onPress={() => setTimePicker({ index, field: 'start_time', value: session.start_time })}
                    >
                      <Ionicons name="time-outline" size={15} color={COLORS.primary} />
                      <Text style={styles.timeBtnText}>{fmt12(session.start_time)}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{t('sched_end')}</Text>
                    <TouchableOpacity
                      style={styles.timeBtn}
                      onPress={() => setTimePicker({
                        index, field: 'end_time', value: session.end_time, min: session.start_time,
                      })}
                    >
                      <Ionicons name="time-outline" size={15} color={COLORS.primary} />
                      <Text style={styles.timeBtnText}>{fmt12(session.end_time)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.label}>{t('sched_slot_length')}</Text>
                <View style={styles.chipWrap}>
                  {SLOT_OPTIONS.map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => patchSession(index, { slot_mins: m })}
                      style={[styles.chip, session.slot_mins === m && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, session.slot_mins === m && styles.chipTextActive]}>{m}m</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>{t('sched_capacity')}</Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => patchSession(index, { capacity: Math.max(1, session.capacity - 1) })}
                  >
                    <Ionicons name="remove" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>{session.capacity}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => patchSession(index, { capacity: Math.min(20, session.capacity + 1) })}
                  >
                    <Ionicons name="add" size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.stepHint}>{t('sched_capacity_hint')}</Text>
                </View>

                <Text style={styles.preview}>{t('sched_slot_preview', { n: slots.length })}</Text>
              </View>
            );
          })}

          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
            <Text style={styles.saveText}>{saving ? t('sched_saving') : t('sched_save')}</Text>
          </TouchableOpacity>

          {/* ── Time off ─────────────────────────────────────────────────── */}
          <View style={[styles.sectionHead, { marginTop: SPACING.l }]}>
            <Text style={styles.sectionTitle}>{t('sched_time_off')}</Text>
          </View>
          <Text style={styles.sectionSub}>{t('sched_time_off_sub')}</Text>

          <View style={styles.row}>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setDatePicker('leave')}>
              <Ionicons name="moon-outline" size={16} color={COLORS.primary} />
              <Text style={styles.ghostBtnText}>{t('sched_mark_day_off')}</Text>
            </TouchableOpacity>
            <View style={{ width: 10 }} />
            <TouchableOpacity style={styles.ghostBtn} onPress={() => setDatePicker('block')}>
              <Ionicons name="close-circle-outline" size={16} color={COLORS.primary} />
              <Text style={styles.ghostBtnText}>{t('sched_block_slots')}</Text>
            </TouchableOpacity>
          </View>

          {exceptions.length === 0 ? (
            <Text style={styles.mutedNote}>{t('sched_no_time_off')}</Text>
          ) : (
            exceptions.map((exc) => (
              <View key={exc.id} style={styles.excRow}>
                <Ionicons
                  name={exc.start_time ? 'close-circle-outline' : 'moon-outline'}
                  size={16}
                  color={COLORS.error}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.excDate}>
                    {new Date(`${exc.exception_date}T00:00:00`).toLocaleDateString('en-IN', {
                      weekday: 'short', day: '2-digit', month: 'short',
                    })}
                    {' · '}
                    {exc.start_time ? fmt12(exc.start_time) : t('sched_full_day')}
                  </Text>
                  {!!exc.reason && <Text style={styles.excReason}>{exc.reason}</Text>}
                </View>
                <TouchableOpacity onPress={() => dropException(exc.id)} hitSlop={8}>
                  <Text style={styles.excRemove}>{t('sched_remove')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <TimeSelectModal
        visible={!!timePicker}
        value={timePicker?.value}
        minTime={timePicker?.min}
        title={timePicker?.field === 'end_time' ? t('sched_end') : t('sched_start')}
        onClose={() => setTimePicker(null)}
        onConfirm={(hhmm) => {
          const { index, field } = timePicker;
          patchSession(index, { [field]: hhmm });
          // Keep end after start when the start is pushed past it.
          if (field === 'start_time') {
            const s = sessions[index];
            if (buildSlots(hhmm, s.end_time, s.slot_mins).length === 0) {
              patchSession(index, { start_time: hhmm, end_time: bumpHour(hhmm) });
            }
          }
          setTimePicker(null);
        }}
      />

      <CalendarPicker
        visible={!!datePicker}
        value={new Date()}
        minDate={new Date()}
        maxDate={maxLeaveDate()}
        onClose={() => setDatePicker(null)}
        onChange={(date) => {
          const mode = datePicker;
          setDatePicker(null);
          if (!date) return;
          if (mode === 'leave') markDayOff(date); else openBlockDay(date);
        }}
      />

      <BlockSlotsModal
        state={blockDay}
        t={t}
        onToggle={(time) => setBlockDay((prev) => ({
          ...prev,
          selected: prev.selected.includes(time)
            ? prev.selected.filter((x) => x !== time)
            : [...prev.selected, time],
        }))}
        onClose={() => setBlockDay(null)}
        onConfirm={confirmBlockSlots}
      />
    </SafeAreaView>
  );
}

// The end of a slot is the start of the next one in the same session; for the
// last slot fall back to a minute later, which the RPC treats as "just this".
function endOfSlot(slot, slots) {
  if (!slot) return null;
  const sameSession = slots.filter((s) => s.sessionId === slot.sessionId);
  const idx = sameSession.findIndex((s) => s.time === slot.time);
  return sameSession[idx + 1]?.time || null;
}

const bumpHour = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Leave more than a year out isn't a schedule, it's a guess.
function maxLeaveDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

function BlockSlotsModal({ state, t, onToggle, onClose, onConfirm }) {
  const pretty = useMemo(
    () => (state ? new Date(`${state.iso}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short',
    }) : ''),
    [state],
  );
  if (!state) return null;
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{t('sched_pick_slots_to_block', { date: pretty })}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {state.slots.length === 0 ? (
            <Text style={styles.mutedNote}>{t('sched_no_slots_that_day')}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View style={styles.chipWrap}>
                {state.slots.map((slot) => {
                  const picked = state.selected.includes(slot.time);
                  const taken = slot.state === 'full';
                  return (
                    <TouchableOpacity
                      key={`${slot.sessionId}-${slot.time}`}
                      disabled={taken}
                      onPress={() => onToggle(slot.time)}
                      style={[
                        styles.chip,
                        picked && styles.chipDanger,
                        taken && styles.chipTaken,
                      ]}
                    >
                      <Text style={[
                        styles.chipText,
                        picked && styles.chipTextActive,
                        taken && styles.chipTextTaken,
                      ]}>
                        {slot.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={onConfirm}>
            <Ionicons name="close-circle" size={18} color={COLORS.white} />
            <Text style={styles.saveText}>{t('sched_block_selected', { n: state.selected.length })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
