import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase } from '../lib/supabase';
import styles from './HomeCareOrderDetail.styles';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:    { label: 'Scheduled',    bg: COLORS.warningSoft,  text: '#c05621',   icon: 'time-outline' },
  confirmed:  { label: 'Active',       bg: '#ebfaf0',           text: '#2f855a',   icon: 'checkmark-circle-outline' },
  processing: { label: 'In Progress',  bg: COLORS.primarySoft,  text: COLORS.primary, icon: 'refresh-circle-outline' },
  completed:  { label: 'Completed',    bg: '#eef6ff',           text: '#2b6cb0',   icon: 'checkmark-done-circle-outline' },
  cancelled:  { label: 'Cancelled',    bg: '#fff5f5',           text: '#9b2c2c',   icon: 'close-circle-outline' },
};

// Which buttons show for each current status
const NEXT_ACTIONS = {
  pending:    [{ key: 'confirmed',  label: 'Start Care',       danger: false },
               { key: 'cancelled', label: 'Cancel Order',     danger: true  }],
  confirmed:  [{ key: 'processing', label: 'Mark In Progress', danger: false },
               { key: 'cancelled', label: 'Cancel Order',     danger: true  }],
  processing: [{ key: 'completed',  label: 'Mark Completed',   danger: false },
               { key: 'cancelled', label: 'Cancel Order',     danger: true  }],
  completed:  [],
  cancelled:  [],
};

const isUUID = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));

const fmt = (d) => {
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return '—'; }
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function HomeCareOrderDetail({ navigation, route }) {
  const passedOrder = route?.params?.order;
  // dbId is the real Supabase UUID; id might be a human order_id like "HC-001"
  const rawId = passedOrder?.dbId || passedOrder?.id;

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // ── Load full order from Supabase ──────────────────────────────────────────
  const load = useCallback(async () => {
    if (!rawId) { setLoading(false); return; }
    try {
      const query = isUUID(rawId)
        ? supabase
            .from('homecare_orders')
            .select('*, profiles!patient_id(name, phone, gender, date_of_birth)')
            .eq('id', rawId)
            .maybeSingle()
        : supabase
            .from('homecare_orders')
            .select('*, profiles!patient_id(name, phone, gender, date_of_birth)')
            .eq('order_id', rawId)
            .maybeSingle();

      const { data } = await query;
      if (data) setDetail(data);
    } catch (e) { /* use passedOrder as fallback */ }
    finally { setLoading(false); }
  }, [rawId]);

  useEffect(() => { load(); }, [load]);

  // ── Status update ──────────────────────────────────────────────────────────
  const updateStatus = async (newStatus) => {
    const dbId = detail?.id;
    if (!dbId) { Alert.alert('Error', 'Order ID not found.'); return; }
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('homecare_orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', dbId);
      if (error) throw error;
      setDetail((prev) => ({ ...prev, status: newStatus }));
    } catch (e) {
      Alert.alert('Update failed', e?.message || 'Could not update status. Try again.');
    } finally { setUpdating(false); }
  };

  const confirmAction = (action) => {
    const cfg = STATUS_CFG[action.key] || {};
    Alert.alert(
      action.label,
      `Change status to "${cfg.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', style: action.danger ? 'destructive' : 'default', onPress: () => updateStatus(action.key) },
      ]
    );
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const dbStatus     = detail?.status || 'pending';
  const cfg          = STATUS_CFG[dbStatus] || STATUS_CFG.pending;
  const nextActions  = NEXT_ACTIONS[dbStatus] || [];
  const patient      = detail?.profiles;
  const serviceName  = detail?.service_name || passedOrder?.package || 'Home Care';
  const orderId      = detail?.order_id || (isUUID(passedOrder?.id) ? '—' : passedOrder?.id) || '—';
  const patientName  = patient?.name || passedOrder?.patient || '—';
  const patientPhone = patient?.phone;
  const notes        = detail?.notes;
  const createdAt    = detail?.created_at;
  const updatedAt    = detail?.updated_at;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Home Care Order</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Status banner */}
          <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={22} color={cfg.text} />
            <Text style={[styles.statusText, { color: cfg.text }]}>{cfg.label}</Text>
            {orderId !== '—' && (
              <Text style={[styles.orderIdBadge, { color: cfg.text, borderColor: cfg.text }]}>
                #{orderId}
              </Text>
            )}
          </View>

          {/* Service */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>SERVICE DETAILS</Text>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="home-outline" size={16} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailKey}>Service</Text>
                <Text style={styles.detailVal}>{serviceName}</Text>
              </View>
            </View>

            {notes ? (
              <View style={[styles.detailRow, { marginTop: 12 }]}>
                <View style={styles.detailIcon}>
                  <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailKey}>Notes</Text>
                  <Text style={styles.detailVal}>{notes}</Text>
                </View>
              </View>
            ) : null}

            {createdAt ? (
              <View style={[styles.detailRow, { marginTop: 12 }]}>
                <View style={styles.detailIcon}>
                  <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.detailKey}>Order placed</Text>
                  <Text style={styles.detailVal}>{fmt(createdAt)}</Text>
                </View>
              </View>
            ) : null}

            {updatedAt ? (
              <View style={[styles.detailRow, { marginTop: 12 }]}>
                <View style={styles.detailIcon}>
                  <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.detailKey}>Last updated</Text>
                  <Text style={styles.detailVal}>{fmt(updatedAt)}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* Patient */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>PATIENT</Text>
            <View style={styles.patientRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {patientName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.patientName}>{patientName}</Text>
                {patient?.gender ? (
                  <Text style={styles.patientMeta}>{patient.gender}</Text>
                ) : null}
                {patientPhone ? (
                  <View style={styles.phoneRow}>
                    <Ionicons name="call-outline" size={13} color={COLORS.primary} />
                    <Text style={styles.patientPhone}>{patientPhone}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Status progress steps */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ORDER PROGRESS</Text>
            <View style={styles.steps}>
              {['pending', 'confirmed', 'processing', 'completed'].map((step, i) => {
                const stepCfg = STATUS_CFG[step];
                const isDone = ['pending', 'confirmed', 'processing', 'completed']
                  .indexOf(dbStatus) >= i;
                const isCancelled = dbStatus === 'cancelled';
                return (
                  <React.Fragment key={step}>
                    <View style={styles.stepItem}>
                      <View style={[
                        styles.stepDot,
                        isDone && !isCancelled && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                        isCancelled && { backgroundColor: COLORS.border },
                      ]}>
                        {isDone && !isCancelled && (
                          <Ionicons name="checkmark" size={10} color={COLORS.white} />
                        )}
                      </View>
                      <Text style={[
                        styles.stepLabel,
                        isDone && !isCancelled && { color: COLORS.primary, fontWeight: '700' },
                      ]}>
                        {stepCfg.label}
                      </Text>
                    </View>
                    {i < 3 && (
                      <View style={[
                        styles.stepLine,
                        isDone && !isCancelled && i < ['pending','confirmed','processing','completed'].indexOf(dbStatus) && { backgroundColor: COLORS.primary },
                      ]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
            {dbStatus === 'cancelled' && (
              <Text style={styles.cancelledNote}>This order was cancelled.</Text>
            )}
          </View>

          {/* Action buttons */}
          {nextActions.length > 0 && (
            <View style={styles.actionsCard}>
              <Text style={styles.sectionLabel}>ACTIONS</Text>
              <View style={{ gap: 10 }}>
                {nextActions.map((action) => (
                  <TouchableOpacity
                    key={action.key}
                    style={[styles.actionBtn, action.danger && styles.actionBtnDanger, updating && { opacity: 0.6 }]}
                    onPress={() => confirmAction(action)}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator
                        size="small"
                        color={action.danger ? COLORS.error : COLORS.white}
                      />
                    ) : (
                      <Text style={[styles.actionBtnText, action.danger && styles.actionBtnTextDanger]}>
                        {action.label}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
