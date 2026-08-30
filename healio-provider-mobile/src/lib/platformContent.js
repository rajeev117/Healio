import { Alert, Linking } from 'react-native';
import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// platformContent — support & legal entries managed from the Healio admin
// panel (platform_content table, migration-056). Every role's app reads its
// own rows; a role-specific row overrides an 'all' row of the same kind.
//
//   const c = await fetchPlatformContent('hospital');
//   c.support_email → 'partners@healio.in' (or undefined if admin hasn't set it)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchPlatformContent(role) {
  try {
    const { data } = await supabase
      .from('platform_content')
      .select('role, kind, title, value')
      .in('role', [role, 'all']);
    const out = {};
    // 'all' first, then role-specific rows override
    (data || [])
      .sort((a, b) => (a.role === 'all' ? 0 : 1) - (b.role === 'all' ? 0 : 1))
      .forEach(r => { out[r.kind] = r.value; });
    return out;
  } catch (e) {
    return {};
  }
}

// Shared button handlers — same behaviour in every role's profile screen.
export function openSupport(content) {
  const email = content?.support_email;
  const phone = content?.support_phone;
  if (!email && !phone) {
    Alert.alert('Support', 'Support contact details will be available soon.');
    return;
  }
  const lines = [email && `Email: ${email}`, phone && `Phone: ${phone}`].filter(Boolean).join('\n');
  const buttons = [
    email && { text: 'Email us', onPress: () => Linking.openURL(`mailto:${email}`).catch(() => {}) },
    phone && { text: 'Call us', onPress: () => Linking.openURL(`tel:${phone}`).catch(() => {}) },
    { text: 'Close', style: 'cancel' },
  ].filter(Boolean);
  Alert.alert('Contact Support', lines, buttons);
}

export function openLegal(content) {
  const terms = content?.terms_url;
  const privacy = content?.privacy_url;
  if (!terms && !privacy) {
    Alert.alert('Legal', 'Terms of service and privacy policy will be published soon.');
    return;
  }
  const buttons = [
    terms && { text: 'Terms of Service', onPress: () => Linking.openURL(terms).catch(() => {}) },
    privacy && { text: 'Privacy Policy', onPress: () => Linking.openURL(privacy).catch(() => {}) },
    { text: 'Close', style: 'cancel' },
  ].filter(Boolean);
  Alert.alert('Legal Terms & Policies', 'Choose a document to open.', buttons);
}
