import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { usePlatformConfig } from '../context/PlatformConfigContext';
import { supabase } from '../lib/supabase';
import ChangePinModal from '../components/ChangePinModal';
import styles from './DoctorHome.styles';

const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); } catch { return ''; } };
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// in_progress in DB = confirmed appointment, starts as 'waiting' in the queue UI.
// Doctor clicks "Consult" → UI status becomes 'in_progress' (currently seeing).
// Doctor clicks "Done"    → UI status becomes 'done', DB status → 'completed'.
const DB_TO_QUEUE = { scheduled: 'waiting', in_progress: 'waiting', completed: 'done' };

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning 👋';
  if (h < 17) return 'Good afternoon 👋';
  return 'Good evening 👋';
};

// ─────────────────────────────────────────────────────────────────────────────
// DoctorHome — shown when role === 'doctor'
// Doctor sees only THEIR appointments and THEIR patients
//
// When Supabase is connected, replace mock data with:
// const { data: myAppointments } = await supabase
//   .from('appointments')
//   .select('*, patients(name, age, gender, phone)')
//   .eq('doctor_staff_id', user.staffId)
//   .eq('date', today)
//   .order('scheduled_at');
// ─────────────────────────────────────────────────────────────────────────────


const STATUS_CONFIG = {
  waiting:     { label: 'Waiting',     bg: COLORS.warningSoft,  text: '#c05621' },
  in_progress: { label: 'In Progress', bg: COLORS.primarySoft,  text: COLORS.primary },
  done:        { label: 'Done',        bg: COLORS.successSoft,  text: COLORS.success },
};

function QueueCard({ item, onConsult, onDone }) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.waiting;
  return (
    <View style={styles.queueCard}>
      <View style={styles.tokenBadge}>
        <Text style={styles.tokenNo}>#{item.tokenNo}</Text>
      </View>
      <View style={styles.queueInfo}>
        <View style={styles.queueNameRow}>
          <Text style={styles.queueName}>{item.patientName}</Text>
          <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={styles.queueMeta}>{item.age}y · {item.gender} · {item.type}</Text>
        <View style={styles.queueTimeRow}>
          <Ionicons name="time-outline" size={11} color={COLORS.textSecondary} />
          <Text style={styles.queueTime}>{item.time}</Text>
        </View>
      </View>
      {item.status === 'waiting' && (
        <TouchableOpacity style={styles.consultBtn} onPress={() => onConsult(item)}>
          <Text style={styles.consultBtnText}>Consult</Text>
        </TouchableOpacity>
      )}
      {item.status === 'in_progress' && (
        <TouchableOpacity style={styles.doneBtn} onPress={() => onDone(item)}>
          <Ionicons name="checkmark" size={16} color={COLORS.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function DoctorHome({ navigation }) {
  const { user } = useAuth();
  const { isEnabled } = usePlatformConfig();
  const [queue, setQueue] = useState([]);
  const [pending, setPending] = useState([]);
  const [acting, setActing]   = useState(null);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const staffIdRef = useRef(null);

  // Notification banner (typed — matches the hospital screen)
  const [banner, setBanner] = useState(null); // { message, type }
  const bannerTimer = useRef(null);
  const showBanner = useCallback((message, type = 'info') => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ message, type });
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  // Resolve the doctor's staff id. If not linked yet, claim_account() links it
  // server-side (a direct UPDATE would be blocked by RLS).
  const resolveStaffId = useCallback(async () => {
    if (staffIdRef.current) return staffIdRef.current;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;

    // 1. Already linked by user_id
    let { data: staffRow } = await supabase
      .from('staff').select('id').eq('user_id', authUser.id).maybeSingle();

    // 2. Not linked → claim it server-side, then re-read
    if (!staffRow) {
      try { await supabase.rpc('claim_account'); } catch (_) {}
      const res = await supabase
        .from('staff').select('id').eq('user_id', authUser.id).maybeSingle();
      staffRow = res.data;
    }

    if (!staffRow) console.warn('[DoctorHome] could not resolve staff id for', authUser.email);
    staffIdRef.current = staffRow?.id || null;
    return staffIdRef.current;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const staffId = await resolveStaffId();
      console.log('[DoctorHome] staffId →', staffId);
      if (!staffId) return;

      // 1. Today's queue (confirmed/active/done)
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { data: qData } = await supabase
        .from('appointments')
        .select('id, type, status, scheduled_at, token_no, patient:profiles!patient_id(id, name, gender)')
        .eq('doctor_staff_id', staffId)
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .in('status', ['in_progress', 'completed'])
        .order('scheduled_at');
      setQueue((qData || []).filter(a => DB_TO_QUEUE[a.status]).map((a, i) => ({
        id: a.id,
        patientId: a.patient?.id || null,
        patientName: a.patient?.name || 'Patient', age: '—',
        gender: a.patient?.gender || '—',
        type: a.type === 'clinic' ? 'OPD' : (a.type || 'OPD'),
        time: fmtTime(a.scheduled_at),
        status: DB_TO_QUEUE[a.status] || 'waiting',
        tokenNo: a.token_no || i + 1,
      })));

      // 2. Pending booking requests (scheduled) — ANY date, needs confirmation
      const { data: pData } = await supabase
        .from('appointments')
        .select('id, type, status, scheduled_at, patient:profiles!patient_id(name, gender)')
        .eq('doctor_staff_id', staffId)
        .eq('status', 'scheduled')
        .order('scheduled_at');
      console.log('[DoctorHome] pending bookings →', pData?.length || 0);
      setPending((pData || []).map(a => ({
        id: a.id, patientName: a.patient?.name || 'Patient',
        gender: a.patient?.gender || '—',
        type: a.type === 'clinic' ? 'OPD' : (a.type || 'OPD'),
        time: fmtTime(a.scheduled_at), date: fmtDate(a.scheduled_at),
      })));
    } catch (e) { console.warn('[DoctorHome] loadData error', e?.message); }
  }, [resolveStaffId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // Realtime: notify the doctor of new/changed bookings for THEM, plus
  // lab/pharmacy orders THEY requested coming back ready — previously only
  // the patient was notified on those; the requesting doctor had no signal
  // at all that a report was ready or medicines were dispensed.
  useEffect(() => {
    let channel; let cancelled = false;
    (async () => {
      const staffId = await resolveStaffId();
      if (!staffId || cancelled) return;
      channel = supabase
        .channel(`doctor-appts-${staffId}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'appointments', filter: `doctor_staff_id=eq.${staffId}` },
          () => { showBanner('New appointment request — confirm it below.', 'new'); loadData(); }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `doctor_staff_id=eq.${staffId}` },
          (payload) => {
            const n = payload.new, o = payload.old;
            // Hospital confirmed a booking (not the doctor themselves)
            if (n.status === 'in_progress' && o.status === 'scheduled' && n.confirmed_by_role === 'hospital_admin') {
              showBanner('The hospital confirmed an appointment for you.', 'success');
            }
            // Patient rescheduled → reschedule_count bumped
            else if ((n.reschedule_count || 0) > (o.reschedule_count || 0)) {
              showBanner('A patient rescheduled — please re-confirm below.', 'new');
            }
            // Patient cancelled
            else if (n.status === 'cancelled' && o.status === 'scheduled') {
              showBanner('A patient cancelled their booking request.', 'warn');
            }
            loadData();
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'lab_orders', filter: `requested_by_staff_id=eq.${staffId}` },
          (payload) => {
            if (payload.new?.status === 'completed' && payload.old?.status !== 'completed') {
              showBanner('🧪 Lab report ready for a patient you referred.', 'success');
            }
          }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'pharmacy_orders', filter: `requested_by_staff_id=eq.${staffId}` },
          (payload) => {
            const s = payload.new?.status;
            if ((s === 'completed' || s === 'dispensed') && payload.old?.status !== s) {
              showBanner('💊 Medicines dispensed for a patient you sent to pharmacy.', 'success');
            }
          }
        )
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [resolveStaffId, loadData, showBanner]);

  const waiting    = queue.filter(q => q.status === 'waiting').length;
  const inProgress = queue.filter(q => q.status === 'in_progress').length;
  const done       = queue.filter(q => q.status === 'done').length;

  const persist = (id, status) => {
    if (String(id).includes('-')) {
      supabase.from('appointments').update({ status }).eq('id', id).then(() => {}, () => {});
    }
  };

  // Doctor confirms / declines a booking request
  const handleAccept = async (item) => {
    setActing(item.id);
    try {
      await supabase.from('appointments')
        .update({ status: 'in_progress', confirmed_by_role: 'doctor', confirmed_by_name: user?.name || 'Doctor' })
        .eq('id', item.id);
      showBanner(`Confirmed ${item.patientName}'s appointment. Hospital has been notified.`, 'success');
      loadData();
    } catch (e) {
      showBanner('Could not confirm — please try again.', 'warn');
    } finally {
      setActing(null);
    }
  };

  const handleDecline = async (item) => {
    setActing(item.id);
    try {
      await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', item.id);
      showBanner(`Declined ${item.patientName}'s request.`, 'warn');
      loadData();
    } catch (e) {
      showBanner('Could not decline — please try again.', 'warn');
    } finally {
      setActing(null);
    }
  };

  const handleConsult = (item) => {
    setQueue(prev => prev.map(q =>
      q.id === item.id ? { ...q, status: 'in_progress' } :
      q.status === 'in_progress' ? { ...q, status: 'waiting' } : q
    ));
    persist(item.id, 'in_progress');
    // Open the consultation panel so doctor can upload prescription, refer to lab/pharmacy etc.
    navigation.navigate('PatientActions', {
      patientId:     item.patientId,
      patientName:   item.patientName,
      appointmentId: item.id,
    });
  };

  const handleDone = (item) => {
    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q));
    persist(item.id, 'completed');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Notification banner */}
      {banner && (
        <View style={[styles.banner,
          banner.type === 'new'     && styles.bannerNew,
          banner.type === 'success' && styles.bannerSuccess,
          banner.type === 'warn'    && styles.bannerWarn,
        ]}>
          <Ionicons
            name={
              banner.type === 'success' ? 'checkmark-circle' :
              banner.type === 'warn'    ? 'alert-circle' :
              banner.type === 'new'     ? 'notifications' : 'information-circle'
            }
            size={16} color={COLORS.white} style={{ marginRight: 8 }}
          />
          <Text style={styles.bannerText}>{banner.message}</Text>
          <TouchableOpacity onPress={() => setBanner(null)}>
            <Ionicons name="close" size={16} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.doctorName}>{user?.name || 'Doctor'}</Text>
          <Text style={styles.hospitalName}>{user?.hospitalName} · {user?.hospitalCity}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setPinModalVisible(true)}>
            <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Stats strip */}
        <View style={styles.statsRow}>
          {[
            { label: 'Waiting',    value: waiting,    color: '#c05621', bg: COLORS.warningSoft },
            { label: 'In Progress',value: inProgress, color: COLORS.primary, bg: COLORS.primarySoft },
            { label: 'Done',       value: done,        color: COLORS.success, bg: COLORS.successSoft },
            { label: 'Total',      value: queue.length,color: COLORS.text,  bg: COLORS.surface },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quick actions — gated by admin feature flags */}
        <View style={styles.quickRow}>
          {[
            { icon: 'document-text', label: 'Prescriptions', to: 'Prescriptions',    color: '#eef6ff',         iconColor: '#2b6cb0' },
            { icon: 'people',        label: 'My Patients',   to: 'Patients',          color: COLORS.primarySoft, iconColor: COLORS.primary },
            { icon: 'chatbubble',    label: 'Chat',          to: 'Chat',              color: COLORS.successSoft, iconColor: COLORS.success,  flag: 'chat' },
            { icon: 'videocam',      label: 'Video Call',    to: 'VideoConsultation', color: '#fdf6e2',         iconColor: '#c05621',       flag: 'video_calls' },
          ].filter(a => !a.flag || isEnabled(a.flag)).map(a => (
            <TouchableOpacity key={a.label} style={[styles.quickCard, { backgroundColor: a.color }]}
              onPress={() => navigation.navigate(a.to)}>
              <Ionicons name={a.icon} size={22} color={a.iconColor} />
              <Text style={[styles.quickLabel, { color: a.iconColor }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Booking requests — doctor can confirm/decline */}
        {pending.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Booking Requests</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pending.length}</Text>
              </View>
            </View>
            <View style={styles.queueList}>
              {pending.map(item => (
                <View key={item.id} style={styles.requestCard}>
                  <View style={styles.requestTop}>
                    <View style={styles.reqAvatar}>
                      <Text style={styles.reqAvatarText}>
                        {(item.patientName || 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqName}>{item.patientName}</Text>
                      <Text style={styles.reqMeta}>{item.date} · {item.time} · {item.type}</Text>
                    </View>
                  </View>
                  {acting === item.id ? (
                    <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 8 }} />
                  ) : (
                    <View style={styles.reqActions}>
                      <TouchableOpacity style={styles.reqAccept} onPress={() => handleAccept(item)}>
                        <Ionicons name="checkmark" size={15} color={COLORS.white} />
                        <Text style={styles.reqAcceptText}>Confirm</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.reqDecline} onPress={() => handleDecline(item)}>
                        <Ionicons name="close" size={15} color="#dc2626" />
                        <Text style={styles.reqDeclineText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Today's queue */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Queue</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        <View style={styles.queueList}>
          {queue.length === 0 ? (
            <Text style={{ color: COLORS.textSecondary, fontSize: 14, paddingHorizontal: 16, paddingVertical: 20 }}>
              No patients in your queue yet.
            </Text>
          ) : queue.map(item => (
            <QueueCard key={item.id} item={item} onConsult={handleConsult} onDone={handleDone} />
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <ChangePinModal visible={pinModalVisible} onClose={() => setPinModalVisible(false)} />
    </SafeAreaView>
  );
}
