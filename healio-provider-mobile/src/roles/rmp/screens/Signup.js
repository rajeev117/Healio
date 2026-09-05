import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { CustomButton } from '../components/CustomButton';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import {
  signUpNewPhone, signInWithPhone, lookupPhoneAccount, accountKindLabelKey, supabase,
} from '../../../lib/supabase';
import OtpVerifyModal from '../../../components/OtpVerifyModal';

// Rules live in src/lib/validation so every signup form agrees. This screen
// used to be the only one with a real name check; now it shares it.
import { nameProblem, isValidPhone, isValidEmail } from '../../../lib/validation';

function Field({ label, error, children }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {!!error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={13} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function validate({ name, phone, email }, t) {
  const errs = {};
  const nameIssue = nameProblem(name);
  if (nameIssue === 'required')     errs.name = t('rmp_err_name_required');
  else if (nameIssue === 'invalid') errs.name = t('rmp_err_name_invalid');

  const digits = phone.replace(/\D/g, '');
  if (!digits)                  errs.phone = t('rmp_err_phone_required');
  else if (!isValidPhone(digits)) errs.phone = t('rmp_err_phone_invalid');

  // Address is optional. Email is optional, but validate format when provided.
  if (!isValidEmail(email)) errs.email = t('rmp_err_email_invalid');

  return errs;
}

export default function Signup({ navigation }) {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [name, setName]       = useState('');
  const [phone, setPhone]     = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail]     = useState('');
  const [errors, setErrors]   = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [otpVisible, setOtpVisible] = useState(false);
  // What lookupPhoneAccount said about the number, carried across the OTP step
  // — createAccount needs it to decide what an `alreadyRegistered` auth row means.
  const [phoneUnknown, setPhoneUnknown] = useState(false);

  const handleSubmit = async () => {
    const errs = validate({ name, phone, email }, t);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const digits = phone.replace(/\D/g, '');

      // Is this number already somebody's? Checked before auth is touched: a
      // phone maps to one derived auth account shared by every role, so signing
      // in "to create" would silently graft a Consultant profile onto whoever
      // already owns the number.
      const { kind, unknown } = await lookupPhoneAccount(digits);
      if (kind) {
        setErrors({ phone: t('signup_err_phone_taken', { kind: t(accountKindLabelKey(kind)) }) });
        return;
      }

      // The number is the Consultant's only credential — every later login is
      // an OTP to it. Confirm they hold it before any auth account is created
      // for it; createAccount runs only once the code checks out.
      setPhoneUnknown(!!unknown);
      setOtpVisible(true);
    } catch (e) {
      Alert.alert(t('rmp_err_signup_failed'), e?.message || t('login_err_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const createAccount = async () => {
    setOtpVisible(false);
    setSubmitting(true);
    try {
      const digits = phone.replace(/\D/g, '');
      const unknown = phoneUnknown;

      // Creates the account or refuses — never signs in. This is the backstop
      // when the lookup above is unavailable (migration-052 not applied).
      let { user, session, alreadyRegistered, error: authError } = await signUpNewPhone(digits);

      if (alreadyRegistered) {
        // Auth already has this phone but no identity row points at it. Either
        // it is an orphan from a signup that died before writing its profile
        // (retrying must work), or the lookup couldn't tell us and we must not
        // guess — refusing is the only safe answer in that case.
        if (unknown) {
          setErrors({ phone: t('signup_err_phone_taken', { kind: t('account_kind_other') }) });
          return;
        }
        const { error: signInError } = await signInWithPhone(digits);
        if (signInError) {
          Alert.alert(t('rmp_err_create_title'), signInError.message || t('login_err_generic'));
          return;
        }
        ({ data: { user } } = await supabase.auth.getUser());
        ({ data: { session } } = await supabase.auth.getSession());
        authError = null;
      }

      if (authError) {
        Alert.alert(t('rmp_err_create_title'), authError.message || t('login_err_generic'));
        return;
      }
      if (!user || !session) {
        Alert.alert(t('rmp_err_create_title'), t('rmp_err_no_session'));
        return;
      }

      const addressVal = address.trim() || null;
      const emailVal   = email.trim() || null;
      const row = {
        id: user.id,
        name: name.trim(),
        phone: `+91${digits}`,
        address: addressVal,
        email: emailVal,
        status: 'active',
      };

      // Persist the profile. address/email were added in migration-037; if that
      // migration hasn't been applied yet, Postgres returns 42703 (undefined
      // column) — retry without them so registration still succeeds.
      let { error: rowError } = await supabase.from('rmps').upsert(row, { onConflict: 'id' });
      if (rowError && (rowError.code === '42703' || /column/i.test(rowError.message || ''))) {
        const { address: _a, email: _e, ...basic } = row;
        ({ error: rowError } = await supabase.from('rmps').upsert(basic, { onConflict: 'id' }));
      }
      if (rowError) {
        Alert.alert(t('rmp_err_save_profile_title'), rowError.message || t('login_err_generic'));
        return;
      }

      login({
        userId: user.id,
        staffId: null,
        name: name.trim(),
        role: 'rmp',
        hospitalId: null,
        hospitalName: null,
        hospitalCity: '',
        rmpPhone: `+91${digits}`,
        rmpAddress: addressVal,
        rmpEmail: emailVal,
      });
      // Land the new RMP in their dashboard (mirrors the main Login flow).
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e) {
      Alert.alert(t('rmp_err_signup_failed'), e?.message || t('login_err_generic'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <View style={styles.logoBox}><Ionicons name="heart" size={26} color={COLORS.white} /></View>
          <Text style={styles.appName}>{t('rmp_create_account')}</Text>
          <Text style={styles.tagline}>{t('rmp_signup_tagline')}</Text>
        </View>

        <ScrollView style={styles.card} contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <Field label={t('rmp_full_name')} error={errors.name}>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder={t('rmp_ph_full_name')}
              placeholderTextColor={COLORS.textSecondary}
              value={name}
              onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: '' })); }}
              autoCapitalize="words"
              maxLength={60}
            />
          </Field>

          <Field label={t('rmp_mobile_number')} error={errors.phone}>
            <View style={[styles.phoneRow, errors.phone && styles.inputError]}>
              <View style={styles.countryCode}><Text style={styles.countryCodeText}>+91</Text></View>
              <TextInput
                style={styles.phoneInput}
                placeholder="98765 43210"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={t => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setErrors(e => ({ ...e, phone: '' })); }}
              />
            </View>
          </Field>

          <Field label={t('rmp_address_opt')}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Wagholi, Pune"
              placeholderTextColor={COLORS.textSecondary}
              value={address}
              onChangeText={setAddress}
              maxLength={120}
            />
          </Field>

          <Field label={t('rmp_email_opt')} error={errors.email}>
            <TextInput
              style={[styles.input, errors.email && styles.inputError]}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: '' })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={120}
            />
          </Field>

          <CustomButton
            title={submitting ? t('rmp_creating') : t('rmp_create_account')}
            disabled={submitting}
            onPress={handleSubmit}
            style={styles.submitBtn}
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>{t('rmp_have_account')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.switchLink}>{t('rmp_log_in')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OtpVerifyModal
        visible={otpVisible}
        phone={phone.replace(/\D/g, '')}
        onVerified={createAccount}
        onClose={() => setOtpVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.primary },
  flex: { flex: 1 },
  header: { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 20 : 40, paddingBottom: 28 },
  backBtn: { position: 'absolute', left: 20, top: Platform.OS === 'ios' ? 20 : 40 },
  logoBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  appName: { fontSize: 22, fontWeight: '900', color: COLORS.white },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },
  card: { backgroundColor: COLORS.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, flex: 1 },
  cardContent: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 24 },
  fieldWrap: { marginTop: 14 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 15, fontSize: 14.5, color: COLORS.text, backgroundColor: COLORS.surface },
  inputError: { borderColor: '#dc2626' },
  phoneRow: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  countryCode: { height: 48, backgroundColor: COLORS.surface, paddingHorizontal: 14, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border },
  countryCodeText: { fontSize: 14.5, fontWeight: '600', color: COLORS.text },
  phoneInput: { flex: 1, height: 48, paddingHorizontal: 15, fontSize: 14.5, color: COLORS.text, backgroundColor: COLORS.surface },
  passwordRow: { flexDirection: 'row', alignItems: 'center', height: 48, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 15, backgroundColor: COLORS.surface },
  passwordInput: { flex: 1, fontSize: 14.5, color: COLORS.text },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  errorText: { fontSize: 12, color: '#dc2626', flex: 1 },
  submitBtn: { marginTop: 22 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  switchText: { fontSize: 13.5, color: COLORS.textSecondary },
  switchLink: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
});
