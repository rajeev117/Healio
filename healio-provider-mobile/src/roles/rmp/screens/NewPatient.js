import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { Input } from '../components/Input';
import { CustomButton } from '../components/CustomButton';
import { Avatar } from '../components/Avatar';
import { useAuth } from '../../../context/AuthContext';
import { findPatientByPhone, linkExistingPatient } from '../services/api';

const LANGUAGES = ['English', 'हिन्दी', 'বাংলা'];
const PHONE_RE  = /^[6-9]\d{9}$/;

export default function NewPatient({ navigation }) {
  const { user } = useAuth();
  const rmpId = user?.userId;

  const [phone, setPhone]       = useState('');
  const [found, setFound]       = useState(null);
  const [language, setLanguage] = useState('English');
  const [error, setError]       = useState('');
  const [searching, setSearching] = useState(false);
  const [linking, setLinking]     = useState(false);

  const digits = phone.replace(/\D/g, '');

  const onPhoneChange = (t) => {
    setPhone(t.replace(/\D/g, '').slice(0, 10));
    setFound(null);
    setError('');
  };

  const handleFind = async () => {
    if (!PHONE_RE.test(digits)) {
      setError('Enter a valid 10-digit number (starts with 6–9).');
      return;
    }
    setError('');
    setFound(null);
    setSearching(true);
    try {
      const patient = await findPatientByPhone(`+91${digits}`);
      if (patient) setFound(patient);
      else setError("No patient is registered with this number. Ask them to sign up on the Healio patient app first, then link them here.");
    } catch (e) {
      setError(e.message || 'Could not search. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async () => {
    if (!found) return;
    setLinking(true);
    try {
      await linkExistingPatient(rmpId, found.id, language);
      // Land on the patient's manage hub: book, raise an emergency admission, etc.
      navigation.replace('ManagePatient', { patient: { ...found, language, status: 'Active' } });
    } catch (e) {
      Alert.alert('Could not link', e.message || 'Please try again.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScreenHeader title="Link Patient" onBack={() => navigation.goBack()} />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Info banner */}
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.noteText}>
            Enter the patient's registered mobile number to find and link them. Patients must first sign up on the Healio patient app.
          </Text>
        </View>

        {/* Phone lookup */}
        <Text style={styles.fieldLabel}>Mobile Number</Text>
        <View style={[styles.phoneRow, error && styles.inputError]}>
          <View style={styles.countryCode}><Text style={styles.countryCodeText}>+91</Text></View>
          <Input
            placeholder="98765 43210"
            value={phone}
            onChangeText={onPhoneChange}
            keyboardType="phone-pad"
            maxLength={10}
            style={styles.phoneInput}
          />
        </View>
        {!!error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={13} color="#dc2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Found patient preview */}
        {found && (
          <>
            <View style={styles.patientCard}>
              <Avatar name={found.name || 'Patient'} size={48} />
              <View style={styles.patientInfo}>
                <Text style={styles.patientName}>{found.name || 'Patient'}</Text>
                <Text style={styles.patientMeta}>
                  {found.phone}
                  {found.age != null ? ` · ${found.age} yrs` : ''}
                  {found.gender ? ` · ${found.gender}` : ''}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={COLORS.success || '#16a34a'} />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 18 }]}>Preferred Language</Text>
            <View style={styles.langRow}>
              {LANGUAGES.map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.langChip, language === lang && styles.chipSelected]}
                  onPress={() => setLanguage(lang)}
                >
                  <Text style={[styles.chipText, language === lang && styles.chipTextSelected]}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        {found ? (
          <CustomButton title={linking ? 'Linking…' : 'Link & Continue'} onPress={handleLink} disabled={linking} />
        ) : (
          <CustomButton
            title={searching ? 'Searching…' : 'Find Patient'}
            onPress={handleFind}
            disabled={searching || digits.length !== 10}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
  note: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: COLORS.primarySoft, borderRadius: 12, padding: 12, marginBottom: 18,
  },
  noteText: { flex: 1, fontSize: 12.5, color: COLORS.text, lineHeight: 18 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  inputError: { borderColor: '#dc2626', borderWidth: 1.5 },
  phoneRow: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', height: 48 },
  countryCode: { backgroundColor: COLORS.surface, paddingHorizontal: 14, justifyContent: 'center', borderRightWidth: 1, borderRightColor: COLORS.border },
  countryCodeText: { fontSize: 14.5, fontWeight: '600', color: COLORS.text },
  phoneInput: { flex: 1, borderWidth: 0 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  errorText: { fontSize: 12, color: '#dc2626', flex: 1 },
  patientCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 14, padding: 14, marginTop: 20,
  },
  patientInfo: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  patientMeta: { fontSize: 12.5, color: COLORS.textSecondary, marginTop: 3 },
  langRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  langChip: { paddingHorizontal: 20, height: 34, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipTextSelected: { color: COLORS.white },
  footer: { paddingHorizontal: 24, paddingBottom: 18, backgroundColor: COLORS.white },
});
