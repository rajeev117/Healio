import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import styles from './HomeCareHome.styles';

// ─── Status maps ──────────────────────────────────────────────────────────────
const DB_TO_HC = {
  pending:    'Scheduled',
  confirmed:  'Active',
  processing: 'In Progress',
  completed:  'Completed',
  cancelled:  'Cancelled',
};

const STATUS_CONFIG = {
  Scheduled:  { bg: COLORS.warningSoft,  text: '#c05621',      icon: 'time-outline',                 nextLabel: 'Activate',       nextDB: 'confirmed'  },
  Active:     { bg: '#ebfaf0',           text: '#2f855a',      icon: 'checkmark-circle-outline',      nextLabel: 'Start Visit',    nextDB: 'processing' },
  'In Progress': { bg: COLORS.primarySoft, text: COLORS.primary, icon: 'refresh-circle-outline',     nextLabel: 'View & Complete', nextDB: null         },
  Completed:  { bg: '#eef6ff',           text: '#2b6cb0',      icon: 'checkmark-done-circle-outline', nextLabel: null,             nextDB: null         },
  Cancelled:  { bg: '#fff5f5',           text: '#9b2c2c',      icon: 'close-circle-outline',          nextLabel: null,             nextDB: null         },
};

const fmtT = (iso) => {
  try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};
const fmtD = (iso) => {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }
  catch { return ''; }
};

// ─── Order card ───────────────────────────────────────────────────────────────
function OrderCard({ order, onNext, onDetail }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.Scheduled;

  return (
    <View style={styles.orderCard}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.85}>
        <View style={styles.orderTop}>
          <View style={styles.orderIdRow}>
            <Text style={styles.orderId}>{order.orderId}</Text>
            <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={11} color={cfg.text} />
              <Text style={[styles.statusText, { color: cfg.text }]}>{order.status}</Text>
            </View>
          </View>
          <Text style={styles.patientName}>{order.patient}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="home-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{order.service}</Text>
            <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} style={{ marginLeft: 8 }} />
            <Text style={styles.metaText}>{order.date}</Text>
            <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} style={{ marginLeft: 8 }} />
            <Text style={styles.metaText}>{order.time}</Text>
          </View>
        </View>

        {expanded && (
          <View style={styles.expandSection}>
            {!!order.notes && (
              <Text style={styles.notesText}>📝 {order.notes}</Text>
            )}
            {!!order.phone && (
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={13} color={COLORS.primary} />
                <Text style={styles.phoneText}>{order.phone}</Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      {cfg.nextLabel && (
        <TouchableOpacity
          style={[styles.nextBtn, cfg.nextDB === null && styles.detailBtn]}
          onPress={() => cfg.nextDB ? onNext(order, cfg.nextDB) : onDetail(order)}
        >
          <Ionicons
            name={cfg.nextDB ? 'arrow-forward' : 'open-outline'}
            size={14}
            color={COLORS.white}
          />
          <Text style={styles.nextBtnText}>{cfg.nextLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeCareHome({ navigation }) {
  const { user } = useAuth();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('Active');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.hospitalId) return;
      const { data } = await supabase
        .from('homecare_orders')
        .select('id, order_id, status, service_name, notes, created_at, profiles!patient_id(name, phone)')
        .eq('organisation_id', user.hospitalId)
        .order('created_at', { ascending: false });

      setOrders((data || []).map(o => ({
        id:       o.id,
        dbId:     o.id,
        orderId:  o.order_id || '#HC',
        patient:  o.profiles?.name || '—',
        phone:    o.profiles?.phone || '',
        service:  o.service_name || 'Home Care',
        notes:    o.notes || '',
        status:   DB_TO_HC[o.status] || 'Scheduled',
        rawStatus: o.status,
        date:     fmtD(o.created_at),
        time:     fmtT(o.created_at),
      })));
    } catch (_) { /* show empty */ }
    finally { setLoading(false); }
  }, [user?.hospitalId]);

  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  // ── Derived counts ─────────────────────────────────────────────────────────
  const scheduled   = orders.filter(o => o.status === 'Scheduled').length;
  const active      = orders.filter(o => o.status === 'Active' || o.status === 'In Progress').length;
  const completed   = orders.filter(o => o.status === 'Completed').length;

  const handleNext = async (order, nextDB) => {
    setOrders(prev => prev.map(o =>
      o.id === order.id ? { ...o, status: DB_TO_HC[nextDB] || order.status } : o
    ));
    try {
      await supabase.from('homecare_orders').update({ status: nextDB }).eq('id', order.id);
    } catch (_) {}
  };

  const handleDetail = (order) => {
    navigation.navigate('HomeCareOrderDetail', { order });
  };

  const activeOrders   = orders.filter(o => !['Completed', 'Cancelled'].includes(o.status));
  const doneOrders     = orders.filter(o =>  ['Completed', 'Cancelled'].includes(o.status));
  const displayOrders  = activeTab === 'Active' ? activeOrders : doneOrders;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.role}>Home Care</Text>
          <Text style={styles.hospitalName}>{user?.hospitalName || 'Hospital'}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          {scheduled > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{scheduled}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Scheduled', value: scheduled,       color: '#c05621',      bg: COLORS.warningSoft },
          { label: 'Active',    value: active,           color: COLORS.primary, bg: COLORS.primarySoft },
          { label: 'Done',      value: completed,        color: COLORS.success, bg: COLORS.successSoft },
          { label: 'Total',     value: orders.length,   color: COLORS.text,    bg: COLORS.surface     },
        ].map(s => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {['Active', 'Done'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab} ({tab === 'Active' ? activeOrders.length : doneOrders.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACING.m, gap: 12 }}>
          {displayOrders.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="home" size={48} color={COLORS.border} />
              <Text style={styles.emptyTitle}>No orders</Text>
              <Text style={styles.emptyText}>
                {activeTab === 'Active' ? 'No active home care orders right now.' : 'No completed orders yet.'}
              </Text>
            </View>
          ) : (
            displayOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onNext={handleNext}
                onDetail={handleDetail}
              />
            ))
          )}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
