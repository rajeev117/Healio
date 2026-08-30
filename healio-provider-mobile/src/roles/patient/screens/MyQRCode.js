import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { COLORS, SPACING } from '../constants/theme';
import { issueQrToken } from '../services/supabase';

const TTL_SECONDS = 90;           // matches the DB token expiry
const REFRESH_AT  = 15;           // re-issue when this many seconds remain

// We prefix the token so the provider scanner can recognise a Healio QR.
const QR_PREFIX = 'healio:patient:';

export default function MyQRCode({ navigation }) {
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [remaining, setRemaining] = useState(TTL_SECONDS);
  const tickRef = useRef(null);

  const refresh = useCallback(async () => {
    setError('');
    const t = await issueQrToken();
    if (!t) {
      setError('Could not generate your code. Pull to retry.');
      setLoading(false);
      return;
    }
    setToken(t);
    setRemaining(TTL_SECONDS);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Countdown + auto re-issue before expiry
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= REFRESH_AT) { refresh(); return TTL_SECONDS; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [refresh]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Check-in Code</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.intro}>
          Show this code at the hospital, lab, or pharmacy. They'll scan it to pull up your visit instantly.
        </Text>

        <View style={styles.qrCard}>
          {loading ? (
            <ActivityIndicator size="large" color={COLORS.primary} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={28} color={COLORS.error} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <QRCode
                value={`${QR_PREFIX}${token}`}
                size={230}
                color={COLORS.text}
                backgroundColor="#ffffff"
              />
              <View style={styles.refreshRow}>
                <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
                <Text style={styles.refreshText}>Refreshes in {remaining}s</Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.secureNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} />
          <Text style={styles.secureText}>
            For your safety this code rotates automatically and expires in 90 seconds. A screenshot won't work later.
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={refresh}>
          <Ionicons name="refresh" size={18} color={COLORS.primary} />
          <Text style={styles.refreshBtnText}>Refresh now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  body: { flex: 1, alignItems: 'center', padding: SPACING.l, gap: SPACING.l },
  intro: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginTop: SPACING.s },
  qrCard: {
    width: 290, height: 290, borderRadius: 28, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  refreshRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  refreshText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  errorBox: { alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  errorText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
  retryBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: COLORS.white, fontWeight: '700' },
  secureNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.secondary, borderRadius: 14, padding: 14,
  },
  secureText: { flex: 1, fontSize: 12, color: COLORS.primary, lineHeight: 18, fontWeight: '500' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  refreshBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
});
