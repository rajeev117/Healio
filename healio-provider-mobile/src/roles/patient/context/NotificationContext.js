// ─────────────────────────────────────────────────────────────────────────────
// Lightweight in-app notification center for referral events (lab/pharmacy/
// appointment updates). No native push infra exists yet (no expo-notifications,
// no device tokens) — this gives an immediate signal while the app is open
// (realtime banner) and a badge count for the next time it's opened, using
// the same Supabase Realtime + AsyncStorage patterns already used elsewhere
// (see Appointments.js's postgres_changes subscription and ApiService's
// _localCancelled cache).
// ─────────────────────────────────────────────────────────────────────────────
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';

const LAST_SEEN_KEY = '@healio_notifications_last_seen';

const NotificationContext = createContext({
  unreadCount: 0,
  banner: null,
  dismissBanner: () => {},
  markAllSeen: async () => {},
});

export function NotificationProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [banner, setBanner] = useState(null);
  const lastSeenRef = useRef(0);
  const bannerTimer = useRef(null);

  const showBanner = useCallback((title, body, icon) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ title, body, icon });
    bannerTimer.current = setTimeout(() => setBanner(null), 6000);
  }, []);

  const computeUnread = useCallback(async (userId) => {
    const sinceIso = new Date(lastSeenRef.current).toISOString();
    try {
      const [lab, pharm, appt] = await Promise.all([
        supabase.from('lab_orders').select('id', { count: 'exact', head: true }).eq('patient_id', userId).gt('updated_at', sinceIso),
        supabase.from('pharmacy_orders').select('id', { count: 'exact', head: true }).eq('patient_id', userId).gt('updated_at', sinceIso),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('patient_id', userId).gt('updated_at', sinceIso),
      ]);
      setUnreadCount((lab.count || 0) + (pharm.count || 0) + (appt.count || 0));
    } catch (_) { /* keep previous count */ }
  }, []);

  useEffect(() => {
    let channel;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LAST_SEEN_KEY);
        lastSeenRef.current = raw ? Number(raw) : 0;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await computeUnread(user.id);

        // Notify regardless of which family member is currently "active" —
        // the account owner should always know when ANY of their profiles
        // gets referred, even if they're not currently viewing that profile.
        channel = supabase
          .channel(`patient-referrals-${user.id}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'lab_orders', filter: `patient_id=eq.${user.id}` },
            () => { setUnreadCount(c => c + 1); showBanner('Sent to lab', "You've been referred to the lab for tests.", 'flask-outline'); })
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'pharmacy_orders', filter: `patient_id=eq.${user.id}` },
            () => { setUnreadCount(c => c + 1); showBanner('Sent to pharmacy', "You've been referred to the pharmacy for medicines.", 'bandage-outline'); })
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'lab_orders', filter: `patient_id=eq.${user.id}` },
            (payload) => {
              if (payload.new?.status === 'completed') {
                setUnreadCount(c => c + 1);
                showBanner('Lab report ready', 'Your lab report is ready. Check Records.', 'flask-outline');
              }
            })
          .on('postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'pharmacy_orders', filter: `patient_id=eq.${user.id}` },
            (payload) => {
              const s = payload.new?.status;
              if (s === 'completed' || s === 'dispensed') {
                setUnreadCount(c => c + 1);
                showBanner('Medicines ready', 'Your medicines have been dispensed.', 'bandage-outline');
              }
            })
          .subscribe();
      } catch (_) { /* badge just stays at 0 */ }
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [computeUnread, showBanner]);

  const dismissBanner = useCallback(() => setBanner(null), []);

  const markAllSeen = useCallback(async () => {
    const now = Date.now();
    lastSeenRef.current = now;
    setUnreadCount(0);
    try { await AsyncStorage.setItem(LAST_SEEN_KEY, String(now)); } catch (_) {}
  }, []);

  return (
    <NotificationContext.Provider value={{ unreadCount, banner, dismissBanner, markAllSeen }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotificationCenter = () => useContext(NotificationContext);
