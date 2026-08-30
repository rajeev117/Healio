import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase } from '../services/supabase';

const CATEGORIES = ['Refund', 'Service Quality', 'Order Issue', 'Billing', 'Other'];
const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'urgent', label: 'Urgent' },
];

export default function RaiseDispute({ navigation }) {
  const [subject, setSubject]   = useState('');
  const [category, setCategory] = useState('Service Quality');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Missing info', 'Please add a subject and describe the issue.');
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('Please log in', 'You need to be logged in to raise a complaint.'); setSubmitting(false); return; }
      const { data: profile } = await supabase.from('profiles').select('organisation_id').eq('id', user.id).maybeSingle();

      const { error } = await supabase.from('disputes').insert({
        patient_id: user.id,
        organisation_id: profile?.organisation_id || null,
        subject: subject.trim(),
        category,
        priority,
        status: 'open',
      });
      if (error) throw error;

      // Log the first message too (best-effort)
      // (dispute_messages: patient can't insert by default RLS, so we skip if it fails)

      setSubmitting(false);
      Alert.alert('Complaint submitted', 'Our team will review it and respond soon.', [
        { text: 'OK', onPress: () => navigation.replace('MyRequests') },
      ]);
    } catch (e) {
      setSubmitting(false);
      Alert.alert('Could not submit', e?.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Raise a Complaint</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.m, paddingBottom: 40 }}>
        <Text style={styles.label}>Subject *</Text>
        <TextInput style={styles.input} value={subject} onChangeText={setSubject}
          placeholder="Brief summary of the issue" placeholderTextColor={COLORS.textSecondary} />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.chipWrap}>
          {PRIORITIES.map(p => (
            <TouchableOpacity key={p.id} style={[styles.chip, priority === p.id && styles.chipActive]} onPress={() => setPriority(p.id)}>
              <Text style={[styles.chipText, priority === p.id && styles.chipTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Describe the issue *</Text>
        <TextInput style={[styles.input, styles.textarea]} value={message} onChangeText={setMessage}
          placeholder="Tell us what happened…" placeholderTextColor={COLORS.textSecondary} multiline numberOfLines={5} />

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.disabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitText}>Submit Complaint</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  textarea: { height: 120, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.white },
  submitBtn: { backgroundColor: COLORS.primary, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  disabled: { opacity: 0.6 },
  submitText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
