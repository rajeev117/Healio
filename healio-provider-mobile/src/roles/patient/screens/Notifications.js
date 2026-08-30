import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase } from '../services/supabase';
import { getActiveFamilyMemberId, fetchWithFamilyFallback } from '../services/activeProfile';
import { useNotificationCenter } from '../context/NotificationContext';

const FALLBACK_NOTIFICATIONS = [
  { id: 'n1', title: 'Welcome to Healio', body: 'Browse doctors, book appointments and manage your health.', time: 'now', icon: 'heart-outline', unread: true },
];

const timeAgo = (iso) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Map appointment status → patient-facing notification
const APPT_NOTIF = {
  scheduled:   { title: 'Booking request sent',   icon: 'time-outline',     body: (d) => `Your request with ${d} is awaiting confirmation.` },
  in_progress: { title: 'Appointment confirmed',  icon: 'checkmark-circle-outline', body: (d) => `${d} has accepted your appointment. You're all set!` },
  suggested:   { title: 'New time suggested',     icon: 'calendar-outline', body: (d) => `${d} suggested a new time. Open Appointments to review.` },
  cancelled:   { title: 'Appointment declined',   icon: 'close-circle-outline', body: (d) => `Your appointment with ${d} was declined. You can rebook.` },
  completed:   { title: 'Appointment completed',  icon: 'checkmark-done-outline', body: (d) => `Your visit with ${d} is complete.` },
};

export default function Notifications({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const { markAllSeen } = useNotificationCenter();

  // Clear the Home bell badge as soon as the patient opens this screen.
  useEffect(() => { markAllSeen(); }, [markAllSeen]);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const items = [];
        const familyId = getActiveFamilyMemberId();

        if (user) {
          // 1. The patient's own appointments
          const appts = await fetchWithFamilyFallback(() => supabase
            .from('appointments')
            .select('id, status, scheduled_at, updated_at, created_at, staff(name), organisations(name)')
            .eq('patient_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(30), familyId);
          (appts || []).forEach(a => {
            const cfg = APPT_NOTIF[a.status];
            if (!cfg) return;
            const who = a.staff?.name || a.organisations?.name || 'the provider';
            const ts = a.updated_at || a.created_at || a.scheduled_at;
            items.push({
              id: `appt-${a.id}`, title: cfg.title, body: cfg.body(who),
              icon: cfg.icon, _ts: new Date(ts).getTime(), time: timeAgo(ts), unread: true,
            });
          });

          // 2. Lab orders
          const labs = await fetchWithFamilyFallback(() => supabase
            .from('lab_orders')
            .select('id, status, created_at, updated_at')
            .eq('patient_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(15), familyId);
          (labs || []).forEach(l => {
            const ts = l.updated_at || l.created_at;
            const done = l.status === 'completed';
            items.push({
              id: `lab-${l.id}`,
              title: done ? 'Lab report ready' : 'Sent to lab',
              body: done ? 'Your lab report is ready. Check Records.' : 'You have been referred to the lab for tests.',
              icon: 'flask-outline', _ts: new Date(ts).getTime(), time: timeAgo(ts), unread: true,
            });
          });

          // 3. Pharmacy orders
          const pharm = await fetchWithFamilyFallback(() => supabase
            .from('pharmacy_orders')
            .select('id, status, created_at, updated_at')
            .eq('patient_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(15), familyId);
          (pharm || []).forEach(o => {
            const ts = o.updated_at || o.created_at;
            const done = o.status === 'completed' || o.status === 'dispensed';
            items.push({
              id: `ph-${o.id}`,
              title: done ? 'Medicines ready' : 'Sent to pharmacy',
              body: done ? 'Your medicines have been dispensed.' : 'You have been referred to the pharmacy.',
              icon: 'bandage-outline', _ts: new Date(ts).getTime(), time: timeAgo(ts), unread: true,
            });
          });
        }

        // 4. Admin broadcasts
        const { data: broadcasts } = await supabase
          .from('push_notifications')
          .select('id, title, body, audience, sent_at')
          .in('audience', ['All Users', 'All Patients'])
          .order('sent_at', { ascending: false })
          .limit(20);
        (broadcasts || []).forEach(n => items.push({
          id: `bc-${n.id}`, title: n.title, body: n.body,
          icon: 'megaphone-outline', _ts: new Date(n.sent_at).getTime(), time: timeAgo(n.sent_at), unread: true,
        }));

        items.sort((a, b) => (b._ts || 0) - (a._ts || 0));
        setNotifications(items.length ? items : FALLBACK_NOTIFICATIONS);
      } catch (e) {
        setNotifications(FALLBACK_NOTIFICATIONS);
      }
    })();
  }, []);

  const unreadCount = useMemo(() => notifications.filter(item => item.unread).length, [notifications]);
  const todayCount = useMemo(() => notifications.slice(0, 2).length, [notifications]);

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, unread: false } : item));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(item => ({ ...item, unread: false })));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Text style={styles.headerSub}>{unreadCount} unread updates</Text>
        </View>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={styles.headerAction}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <StatCard value={unreadCount} label="Unread" />
          <StatCard value={todayCount} label="Today" />
          <StatCard value={notifications.length} label="Total" />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recent updates</Text>
          {notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.notificationRow, item.unread && styles.unreadRow]}
              onPress={() => markAsRead(item.id)}
            >
              <View style={[styles.iconWrap, item.unread && styles.iconWrapActive]}>
                <Ionicons name={item.icon} size={18} color={item.unread ? COLORS.white : COLORS.primary} />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.titleText}>{item.title}</Text>
                <Text style={styles.bodyText}>{item.body}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.timeText}>{item.time}</Text>
                {item.unread ? <View style={styles.dot} /> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.clearBtn} onPress={() => setNotifications(prev => prev.filter(item => item.unread))}>
          <Ionicons name="trash-outline" size={18} color={COLORS.primary} />
          <Text style={styles.clearText}>Clear read notifications</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const StatCard = ({ value, label }) => (
  <View style={styles.statCard}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: SPACING.m,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  headerAction: { fontSize: 12, color: COLORS.primary, fontWeight: '800' },
  content: { padding: SPACING.m, paddingBottom: SPACING.xl },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.m },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 3, fontWeight: '700' },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.m,
  },
  sectionTitle: { fontSize: 15, fontWeight: '900', color: COLORS.text, marginBottom: SPACING.m },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F3F5',
  },
  unreadRow: { backgroundColor: '#F8FBFF' },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconWrapActive: { backgroundColor: COLORS.primary },
  textCol: { flex: 1 },
  titleText: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  bodyText: { fontSize: 12, lineHeight: 18, color: COLORS.textSecondary, marginTop: 3 },
  metaCol: { alignItems: 'flex-end' },
  timeText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 8 },
  clearBtn: {
    marginTop: SPACING.m,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  clearText: { color: COLORS.primary, fontWeight: '800' },
});
