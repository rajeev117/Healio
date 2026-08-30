import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FeatureScreen from '../components/FeatureScreen';
import { COLORS } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useStore } from '../lib/store';
import { useFocusEffect } from '@react-navigation/native';
import styles from './Notifications.styles';

const PROVIDER_AUDIENCES = ['All Users', 'All Providers', 'Providers'];

// Appointment status → provider-facing notification
const APPT_NOTIF = {
  scheduled:   (p) => ({ title: 'New booking request', sub: `${p} requested an appointment — needs confirmation.` }),
  in_progress: (p) => ({ title: 'Appointment confirmed', sub: `${p}'s appointment is confirmed.` }),
  suggested:   (p) => ({ title: 'Time suggested', sub: `You suggested a new time to ${p}.` }),
  cancelled:   (p) => ({ title: 'Appointment cancelled', sub: `${p}'s appointment was cancelled.` }),
  completed:   (p) => ({ title: 'Appointment completed', sub: `${p}'s visit is complete.` }),
};

const timeAgo = (iso) => {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

export default function Notifications({ navigation }) {
  const [items, setItems] = React.useState([]);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const orgId = await useStore.getState().resolveOrgId();
      const feed = [];

      if (orgId) {
        // 1. Org appointments
        const { data: appts } = await supabase
          .from('appointments')
          .select('id, status, updated_at, created_at, scheduled_at, patient:profiles!patient_id(name)')
          .eq('organisation_id', orgId)
          .order('updated_at', { ascending: false })
          .limit(30);
        (appts || []).forEach(a => {
          const fn = APPT_NOTIF[a.status];
          if (!fn) return;
          const n = fn(a.patient?.name || 'A patient');
          const ts = a.updated_at || a.created_at || a.scheduled_at;
          feed.push({ id: `appt-${a.id}`, ...n, _ts: new Date(ts).getTime(), time: timeAgo(ts) });
        });

        // 2. Lab orders completed (report ready → notify doctor)
        const { data: labs } = await supabase
          .from('lab_orders')
          .select('id, status, updated_at, created_at, profiles!patient_id(name)')
          .eq('organisation_id', orgId)
          .order('updated_at', { ascending: false })
          .limit(15);
        (labs || []).forEach(l => {
          const ts = l.updated_at || l.created_at;
          const done = l.status === 'completed';
          feed.push({
            id: `lab-${l.id}`,
            title: done ? 'Lab report ready' : 'New lab order',
            sub: `${l.profiles?.name || 'Patient'} — ${done ? 'report uploaded' : 'awaiting sample'}.`,
            _ts: new Date(ts).getTime(), time: timeAgo(ts),
          });
        });

        // 3. Pharmacy orders
        const { data: pharm } = await supabase
          .from('pharmacy_orders')
          .select('id, status, updated_at, created_at, profiles!patient_id(name)')
          .eq('organisation_id', orgId)
          .order('updated_at', { ascending: false })
          .limit(15);
        (pharm || []).forEach(o => {
          const ts = o.updated_at || o.created_at;
          const done = o.status === 'completed' || o.status === 'dispensed';
          feed.push({
            id: `ph-${o.id}`,
            title: done ? 'Medicines dispensed' : 'New pharmacy order',
            sub: `${o.profiles?.name || 'Patient'} — ${done ? 'medicines given' : 'awaiting dispense'}.`,
            _ts: new Date(ts).getTime(), time: timeAgo(ts),
          });
        });
      }

      // 4. Admin broadcasts
      const { data } = await supabase
        .from('push_notifications')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20);
      (data || [])
        .filter((n) => !n.audience || PROVIDER_AUDIENCES.includes(n.audience))
        .forEach((n) => feed.push({ id: `bc-${n.id}`, title: n.title, sub: n.body, _ts: new Date(n.sent_at).getTime(), time: timeAgo(n.sent_at) }));

      feed.sort((a, b) => (b._ts || 0) - (a._ts || 0));
      setItems(feed);
    } catch (e) {
      setItems([]);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  return (
    <FeatureScreen
      navigation={navigation}
      title="Notifications"
      subtitle="Operational alerts and announcements from the Healio team."
      badge="Inbox"
      primaryAction={{ label: 'Open earnings', onPress: () => navigation.navigate('Earnings') }}
      secondaryAction={{ label: 'Settings', onPress: () => navigation.navigate('Settings') }}
      sections={[
        {
          title: 'Recent updates',
          children: (
            <View style={{ gap: 10 }}>
              {items.length === 0 ? (
                <Text style={styles.empty}>{loaded ? 'No notifications yet.' : 'Loading…'}</Text>
              ) : items.map((item) => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.badge} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{item.title}</Text>
                    {!!item.sub && <Text style={styles.sub}>{item.sub}</Text>}
                  </View>
                  <Text style={styles.time}>{item.time}</Text>
                </View>
              ))}
            </View>
          ),
        },
      ]}
    />
  );
}
