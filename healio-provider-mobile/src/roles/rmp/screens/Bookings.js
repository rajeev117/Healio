import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Avatar } from '../components/Avatar';
import { StatusPill } from '../components/StatusPill';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { supabase } from '../../../lib/supabase';
import { STATUS, listRequests, subscribe as subscribeRequests } from '../../../lib/orderRequests';
import { fetchRmpBookings } from '../services/api';

// Values stay English (used for status comparison); only the label is translated.
const FILTERS = ['All', 'Confirmed', 'Pending', 'Completed'];
const FILTER_KEYS = { All: 'filter_all', Confirmed: 'status_confirmed', Pending: 'status_pending', Completed: 'status_completed' };

// Lab / pharmacy requests live in their own lifecycle — fold it into the same
// vocabulary the appointment filters use.
const REQUEST_STATUS = {
  [STATUS.AWAITING_REVIEW]: 'Pending',
  [STATUS.QUOTED]: 'Pending',
  [STATUS.CONFIRMED]: 'Confirmed',
  [STATUS.DECLINED]: 'Cancelled',
  [STATUS.CANCELLED]: 'Cancelled',
};

const isSameDay = (ts) => new Date(ts).toDateString() === new Date().toDateString();

export default function Bookings({ navigation }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const rmpId = user?.userId;
  const [allBookings, setAllBookings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  // Lab and pharmacy orders the RMP raised on a patient's behalf. They are not
  // appointments — they live in the shared order-request store the provider
  // modules price from — so they are loaded alongside and shown in one list.
  const loadRequests = useCallback(async () => {
    if (!rmpId) return;
    const all = await listRequests();
    setRequests(all.filter(r => r.rmpId === rmpId));
  }, [rmpId]);

  const load = useCallback(async () => {
    if (!rmpId) return;
    setLoading(true);
    try {
      const data = await fetchRmpBookings(rmpId);
      setAllBookings(data);
      await loadRequests();
    } catch (e) {
      console.warn('Bookings load error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [rmpId, loadRequests]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A provider pricing a request updates the store from inside the same app.
  useEffect(() => subscribeRequests(loadRequests), [loadRequests]);

  // Realtime: when the hospital/doctor confirms (or otherwise changes) one of
  // this RMP's bookings, refresh the list so it reflects without a manual pull.
  useEffect(() => {
    if (!rmpId) return;
    const channel = supabase
      .channel(`rmp-bookings-${rmpId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'appointments', filter: `rmp_id=eq.${rmpId}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [rmpId, load]);

  const appointmentItems = allBookings.map(b => ({
    key: `appt-${b.id}`,
    patientName: b.patientName,
    title: `${b.providerName} · ${b.time}`,
    sub: `${b.date} · ₹${b.serviceCharge} · ${b.payment === 'Cash' ? t('rmp_payment_cash') : b.payment}`,
    status: b.status,
    isToday: b.isToday,
    onPress: () => navigation.navigate('PatientJourney', { booking: b }),
  }));

  const requestItems = requests.map(r => {
    const when = new Date(r.createdAt);
    return {
      key: `req-${r.id}`,
      patientName: r.patientName || 'Patient',
      badge: r.kind === 'lab' ? 'Lab' : 'Pharmacy',
      title: `${r.providerName} · ${when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
      sub: `${isSameDay(r.createdAt) ? t('rmp_section_today') : when.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} · ${r.invoice ? `₹${r.invoice.total}` : 'Awaiting price'} · ${r.fulfilmentLabel}`,
      status: REQUEST_STATUS[r.status] || 'Pending',
      isToday: isSameDay(r.createdAt),
      onPress: () => navigation.navigate('OrderRequestStatus', { requestId: r.id }),
    };
  });

  const all = [...appointmentItems, ...requestItems];
  const filtered = filter === 'All' ? all : all.filter(b => b.status === filter);
  const sections = ['Today', 'Earlier'].map(section => ({
    section,
    items: filtered.filter(b => (b.isToday ? 'Today' : 'Earlier') === section),
  })).filter(s => s.items.length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title={t('rmp_bookings_title')} />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <View style={styles.chipRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} style={[styles.chip, filter === f && styles.chipSelected]} onPress={() => setFilter(f)}>
              <Text style={[styles.chipText, filter === f && styles.chipTextSelected]}>{t(FILTER_KEYS[f])}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {sections.map(({ section, items }) => (
          <View key={section}>
            <Text style={styles.sectionLabel}>{t(section === 'Today' ? 'rmp_section_today' : 'rmp_section_earlier').toUpperCase()}</Text>
            {items.map(booking => (
              <TouchableOpacity
                key={booking.key}
                style={styles.bookingCard}
                onPress={booking.onPress}
                activeOpacity={0.8}
              >
                <Avatar name={booking.patientName} />
                <View style={styles.bookingInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.bookingName}>{booking.patientName}</Text>
                    {!!booking.badge && (
                      <View style={styles.kindBadge}><Text style={styles.kindBadgeText}>{booking.badge}</Text></View>
                    )}
                  </View>
                  <Text style={styles.bookingMeta}>{booking.title}</Text>
                  <Text style={styles.bookingSub}>{booking.sub}</Text>
                </View>
                <View style={styles.bookingRight}>
                  <StatusPill label={booking.status} />
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} style={styles.chevron} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {sections.length === 0 && (
          <Text style={styles.empty}>
            {filter === 'All' ? t('rmp_no_bookings_all') : t('rmp_no_bookings_filtered', { filter: t(FILTER_KEYS[filter]) })}
          </Text>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 6 },
  chip: { paddingHorizontal: 16, height: 34, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipTextSelected: { color: COLORS.white },
  sectionLabel: { fontSize: 11.5, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.6, marginTop: 20, marginBottom: 10 },
  bookingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, marginBottom: 12 },
  bookingInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookingName: { fontSize: 14.5, fontWeight: '600', color: COLORS.text },
  kindBadge: { backgroundColor: COLORS.primarySoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  kindBadgeText: { fontSize: 9.5, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.3 },
  bookingMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  bookingSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 3 },
  bookingRight: { alignItems: 'flex-end' },
  chevron: { marginTop: 6 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 40, fontSize: 13.5 },
});
