// ─────────────────────────────────────────────────────────────────────────────
// Real device push notifications (Expo SDK 56).
//
// Before this, "push" only ever meant a row in `push_notifications` that the
// Notifications screens polled — nothing reached the phone. This module is the
// device half: it registers an Expo push token per install into
// `device_tokens` (migration-059) so the admin panel can hand those tokens to
// Expo's push service.
//
// Everything here fails SOFT. A denied permission, a missing projectId, or
// Expo Go on Android must never break login — the app just doesn't get push.
//   • Remote push is unavailable in Expo Go on Android since SDK 53; a
//     development build is required. Local notifications still work there.
//   • Web has no Expo push token at all.
// ─────────────────────────────────────────────────────────────────────────────
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

// Foreground behaviour. shouldShowAlert is deprecated in SDK 56 — banner/list
// are the replacements.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Set by app.json → extra.eas.projectId once the project is linked to EAS.
// getExpoPushTokenAsync falls back to this itself, but reading it up front
// lets us skip the call (and its noisy error) when it isn't configured yet.
const projectId =
  Constants?.expoConfig?.extra?.eas?.projectId ??
  Constants?.easConfig?.projectId ??
  null;

// Expo Go can't receive remote push on Android (SDK 53+). appOwnership is
// 'expo' only inside Expo Go; a dev/production build reports null.
const inExpoGo = Constants?.appOwnership === 'expo';

export const pushUnavailableReason = () => {
  if (Platform.OS === 'web')            return 'Push notifications are not supported on web.';
  if (!Device.isDevice)                 return 'Push notifications need a physical device.';
  if (inExpoGo && Platform.OS === 'android')
    return 'Expo Go cannot receive push on Android — use a development build.';
  if (!projectId)                       return 'No EAS projectId configured in app.json.';
  return null;
};

// Android needs a channel before anything will display.
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Healio',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#821c03',
  });
}

/**
 * Ask for permission and return this install's Expo push token, or null.
 * Never throws.
 */
export async function getPushToken() {
  if (pushUnavailableReason()) return null;
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    // Don't re-prompt someone who already said no — iOS only shows the system
    // dialog once anyway, and re-asking every launch is user-hostile.
    if (status !== 'granted' && existing.canAskAgain !== false) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;

    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data || null;
  } catch (e) {
    console.warn('[push] token registration skipped:', e?.message || e);
    return null;
  }
}

/**
 * Register (or refresh) this device against the logged-in user.
 * Call after a successful login and on every cold start with a session.
 *
 * @param {{ userId: string, role?: string, app?: 'patient'|'provider' }} who
 * @returns {Promise<string|null>} the token, or null when push isn't available
 */
export async function registerPushToken({ userId, role, app = 'provider' }) {
  if (!userId) return null;
  const token = await getPushToken();
  if (!token) return null;

  try {
    // Upsert on `token`: reinstalling or switching accounts on the same device
    // must move the row to the new user, not create a duplicate. The unique
    // index on token (migration-059) is what makes this an update.
    const { error } = await supabase
      .from('device_tokens')
      .upsert(
        {
          token,
          user_id: userId,
          app,
          role: role || null,
          platform: Platform.OS,
          enabled: true,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'token' },
      );
    if (error) throw error;
  } catch (e) {
    // migration-059 may not be applied yet — never block the caller.
    console.warn('[push] could not save device token:', e?.message || e);
    return null;
  }
  return token;
}

/**
 * Stop delivering to this device. Called on logout.
 *
 * Only flips `enabled`; ownership stays put. Nulling user_id would be rejected
 * by the row's own RLS policy (a write must leave the row owned by the writer),
 * and it isn't needed: the next person to sign in on this handset claims the
 * row through the "claim on re-login" policy, which re-points user_id and turns
 * delivery back on.
 */
export async function unregisterPushToken() {
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId })
      .then((r) => r?.data)
      .catch(() => null);
    if (!token) return;
    await supabase
      .from('device_tokens')
      .update({ enabled: false })
      .eq('token', token);
  } catch (_) { /* logout must never fail because of push */ }
}

/**
 * Wire foreground + tap handlers. Returns an unsubscribe function.
 *
 * @param {(notification:any)=>void} onReceive fired while the app is open
 * @param {(response:any)=>void}     onRespond fired when a notification is tapped
 */
export function addPushListeners(onReceive, onRespond) {
  const subs = [];
  try {
    if (onReceive) subs.push(Notifications.addNotificationReceivedListener(onReceive));
    if (onRespond) subs.push(Notifications.addNotificationResponseReceivedListener(onRespond));
  } catch (_) { /* not available in this runtime */ }
  return () => subs.forEach((s) => { try { s.remove(); } catch (_) {} });
}
