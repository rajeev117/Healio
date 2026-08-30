import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Linking } from 'react-native';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { uploadRecordFile } from '../lib/uploads';
import { useAuth } from '../context/AuthContext';
import styles from './PatientRecords.styles';

const RECORD_TYPES = [
  { key: 'visit', label: 'Visit / Diagnosis' },
  { key: 'xray', label: 'X-ray / Imaging' },
  { key: 'lab_report', label: 'Lab Report' },
  { key: 'vitals', label: 'Vitals' },
  { key: 'other', label: 'Other' },
];
const VITAL_FIELDS = [
  { key: 'bp', label: 'BP (mmHg)' },
  { key: 'pulse', label: 'Pulse (bpm)' },
  { key: 'temp', label: 'Temp (°F)' },
  { key: 'spo2', label: 'SpO₂ (%)' },
  { key: 'weight', label: 'Weight (kg)' },
  { key: 'sugar', label: 'Sugar (mg/dL)' },
];

const fmt = (d) => { try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return ''; } };
const emptyRecord = { id: null, type: 'visit', title: '', diagnosis: '', notes: '', vitals: {}, image_url: null };

export default function PatientRecords({ navigation, route }) {
  const { user } = useAuth();
  const patientId = route?.params?.patientId;
  const patientName = route?.params?.patientName || 'Patient';
  // Every staff role can CREATE records (e.g. OPD adds an X-ray).
  const canCreate = true;
  // Doctors/admins can edit any record; others edit only what they authored.
  const isClinician = user?.role === 'doctor' || user?.role === 'hospital_admin';
  const [myStaffId, setMyStaffId] = useState(null);
  const canEditRecord = (r) => isClinician || (myStaffId && r.created_by_staff_id === myStaffId);
  const [uploading, setUploading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [notes, setNotes] = useState([]);
  const [recModal, setRecModal] = useState(false);
  const [form, setForm] = useState(emptyRecord);
  const [saving, setSaving] = useState(false);
  const [noteModal, setNoteModal] = useState(false);
  const [noteTarget, setNoteTarget] = useState(null); // record id the note attaches to
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async () => {
    if (!patientId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [rec, nt] = await Promise.all([
        supabase.from('health_records').select('*, staff:created_by_staff_id(name)').eq('patient_id', patientId).order('recorded_at', { ascending: false }),
        supabase.from('record_notes').select('*').eq('patient_id', patientId).order('created_at', { ascending: true }),
      ]);
      setRecords(rec.data || []);
      setNotes(nt.data || []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  // Resolve my staff id so authors can edit their own records.
  useEffect(() => {
    (async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return;
      const { data } = await supabase.from('staff').select('id').eq('user_id', u.id).maybeSingle();
      if (data) setMyStaffId(data.id);
    })();
  }, []);

  const resolveOrgAndStaff = async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return { orgId: null, staffId: null };
    const { data: staffRow } = await supabase.from('staff').select('id, organisation_id').eq('user_id', u.id).maybeSingle();
    if (staffRow) return { orgId: staffRow.organisation_id, staffId: staffRow.id };
    const { data: orgRow } = await supabase.from('organisations').select('id').eq('admin_user_id', u.id).maybeSingle();
    return { orgId: orgRow?.id || null, staffId: null };
  };

  const openNew = () => {
    // OPD assistants most often add X-rays, so default their new record to imaging.
    setForm({ ...emptyRecord, type: user?.role === 'opd_assistant' ? 'xray' : 'visit' });
    setRecModal(true);
  };
  const openEdit = (r) => {
    setForm({ id: r.id, type: r.type || 'visit', title: r.title || '', diagnosis: r.diagnosis || '', notes: r.notes || '', vitals: r.vitals || {}, image_url: r.image_url || null });
    setRecModal(true);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to attach an image.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const a = res.assets[0];
    const ext = (a.uri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
    await doUpload(a.uri, a.mimeType || `image/${ext}`, ext);
  };

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]?.uri) return;
    const a = res.assets[0];
    await doUpload(a.uri, a.mimeType || 'application/pdf', 'pdf');
  };

  const doUpload = async (uri, mime, ext) => {
    try {
      setUploading(true);
      const url = await uploadRecordFile(uri, patientId, mime, ext);
      setForm(f => ({ ...f, image_url: url }));
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not upload the file.');
    } finally { setUploading(false); }
  };

  const attachFile = () => {
    Alert.alert('Attach', 'Choose what to attach', [
      { text: 'Image (X-ray photo)', onPress: pickImage },
      { text: 'PDF report', onPress: pickPdf },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const saveRecord = async () => {
    if (!form.title.trim()) { Alert.alert('Title required', 'Give the record a title.'); return; }
    setSaving(true);
    try {
      const { orgId, staffId } = await resolveOrgAndStaff();
      if (!orgId) { Alert.alert('No organisation', 'Could not resolve your hospital.'); setSaving(false); return; }
      const payload = {
        patient_id: patientId,
        organisation_id: orgId,
        created_by_staff_id: staffId,
        created_by_role: user?.role || 'doctor',
        type: form.type,
        title: form.title.trim(),
        diagnosis: form.diagnosis.trim() || null,
        notes: form.notes.trim() || null,
        vitals: form.vitals || {},
        image_url: form.image_url || null,
        uploaded_by: user?.role || 'doctor',
        updated_at: new Date().toISOString(),
      };
      let error;
      if (form.id) ({ error } = await supabase.from('health_records').update(payload).eq('id', form.id));
      else ({ error } = await supabase.from('health_records').insert(payload));
      if (error) throw error;
      setRecModal(false);
      await load();
    } catch (e) {
      Alert.alert('Save failed', e?.message || 'Could not save the record.');
    } finally { setSaving(false); }
  };

  const openNote = (recordId) => { setNoteTarget(recordId); setNoteText(''); setNoteModal(true); };
  const saveNote = async () => {
    if (!noteText.trim()) return;
    try {
      const { orgId, staffId } = await resolveOrgAndStaff();
      const { error } = await supabase.from('record_notes').insert({
        record_id: noteTarget,
        patient_id: patientId,
        organisation_id: orgId,
        author_staff_id: staffId,
        author_name: user?.name || 'Staff',
        author_role: user?.role || 'staff',
        note: noteText.trim(),
      });
      if (error) throw error;
      setNoteModal(false);
      await load();
    } catch (e) {
      Alert.alert('Could not add note', e?.message || 'Try again.');
    }
  };

  const notesFor = (recordId) => notes.filter(n => n.record_id === recordId);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Records · {patientName}</Text>
        {canCreate ? (
          <TouchableOpacity onPress={openNew} style={styles.addBtn}>
            <Ionicons name="add" size={20} color={COLORS.white} />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: SPACING.m }} showsVerticalScrollIndicator={false}>
          {!isClinician && (
            <Text style={styles.roleNote}>
              You can add your own records (e.g. X-ray) and notes. You can edit only what you created — a doctor's record stays read-only.
            </Text>
          )}

          {records.length === 0 ? (
            <Text style={styles.empty}>No clinical records yet.</Text>
          ) : records.map((r) => {
            const v = r.vitals || {};
            const vitalsList = VITAL_FIELDS.filter(f => v[f.key]).map(f => `${f.label.split(' ')[0]}: ${v[f.key]}`);
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{r.title}</Text>
                    <Text style={styles.cardMeta}>
                      {(r.type || 'record')} · {fmt(r.recorded_at)} · {r.staff?.name || r.created_by_role || 'Clinician'}
                    </Text>
                  </View>
                  {canEditRecord(r) && (
                    <TouchableOpacity onPress={() => openEdit(r)} style={styles.editBtn}>
                      <Ionicons name="create-outline" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                  )}
                </View>
                {!!r.diagnosis && <Text style={styles.diag}>Diagnosis: {r.diagnosis}</Text>}
                {!!r.notes && <Text style={styles.notesText}>{r.notes}</Text>}
                {!!r.image_url && (
                  <TouchableOpacity style={styles.imageLink} onPress={() => Linking.openURL(r.image_url)}>
                    <Ionicons name={String(r.image_url).toLowerCase().endsWith('.pdf') ? 'document-text-outline' : 'image-outline'} size={16} color={COLORS.primary} />
                    <Text style={styles.imageLinkText}>{String(r.image_url).toLowerCase().endsWith('.pdf') ? 'View PDF report' : 'View image / scan'}</Text>
                  </TouchableOpacity>
                )}
                {vitalsList.length > 0 && (
                  <View style={styles.vitalsRow}>
                    {vitalsList.map(x => <View key={x} style={styles.vitalChip}><Text style={styles.vitalChipText}>{x}</Text></View>)}
                  </View>
                )}

                {/* Appended notes (OPD / pharmacy / others) */}
                {notesFor(r.id).map(n => (
                  <View key={n.id} style={styles.noteItem}>
                    <Ionicons name="chatbox-ellipses-outline" size={14} color={COLORS.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noteText}>{n.note}</Text>
                      <Text style={styles.noteMeta}>{n.author_name || 'Staff'} · {n.author_role} · {fmt(n.created_at)}</Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity style={styles.addNoteBtn} onPress={() => openNote(r.id)}>
                  <Ionicons name="add" size={14} color={COLORS.primary} />
                  <Text style={styles.addNoteText}>Add note</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* Create / edit record modal */}
      <Modal visible={recModal} animationType="slide" transparent onRequestClose={() => setRecModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{form.id ? 'Edit Record' : 'New Record'}</Text>
              <TouchableOpacity onPress={() => setRecModal(false)}><Ionicons name="close" size={22} color={COLORS.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                {RECORD_TYPES.map(rt => (
                  <TouchableOpacity key={rt.key} style={[styles.typeChip, form.type === rt.key && styles.typeChipActive]} onPress={() => setForm(f => ({ ...f, type: rt.key }))}>
                    <Text style={[styles.typeChipText, form.type === rt.key && styles.typeChipTextActive]}>{rt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Title *</Text>
              <TextInput style={styles.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. Follow-up visit" placeholderTextColor={COLORS.textSecondary} />

              <Text style={styles.label}>Diagnosis</Text>
              <TextInput style={styles.input} value={form.diagnosis} onChangeText={v => setForm(f => ({ ...f, diagnosis: v }))} placeholder="Primary diagnosis" placeholderTextColor={COLORS.textSecondary} />

              <Text style={styles.label}>Attachment (X-ray image or PDF report)</Text>
              <TouchableOpacity style={styles.attachBtn} onPress={attachFile} disabled={uploading}>
                {uploading
                  ? <ActivityIndicator color={COLORS.primary} size="small" />
                  : <><Ionicons name={form.image_url ? 'checkmark-circle' : 'cloud-upload-outline'} size={18} color={COLORS.primary} />
                      <Text style={styles.attachText}>{form.image_url ? 'Attached — replace' : 'Attach image / PDF'}</Text></>}
              </TouchableOpacity>

              <Text style={styles.label}>Vitals</Text>
              <View style={styles.vitalsGrid}>
                {VITAL_FIELDS.map(vf => (
                  <View key={vf.key} style={styles.vitalInputWrap}>
                    <Text style={styles.vitalLabel}>{vf.label}</Text>
                    <TextInput
                      style={styles.vitalInput}
                      value={form.vitals?.[vf.key] || ''}
                      onChangeText={v => setForm(f => ({ ...f, vitals: { ...f.vitals, [vf.key]: v } }))}
                      placeholder="—" placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                ))}
              </View>

              <Text style={styles.label}>Clinical notes</Text>
              <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Treatment, advice, follow-up…" placeholderTextColor={COLORS.textSecondary} multiline />

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveRecord} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Saving…' : (form.id ? 'Update Record' : 'Save Record')}</Text>
              </TouchableOpacity>
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add note modal */}
      <Modal visible={noteModal} animationType="fade" transparent onRequestClose={() => setNoteModal(false)}>
        <View style={[styles.overlay, { justifyContent: 'center', padding: 24 }]}>
          <View style={styles.noteSheet}>
            <Text style={styles.sheetTitle}>Add Note</Text>
            <TextInput
              style={[styles.input, { height: 90, textAlignVertical: 'top', marginTop: 12 }]}
              value={noteText} onChangeText={setNoteText} multiline autoFocus
              placeholder="Your note on this record…" placeholderTextColor={COLORS.textSecondary}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setNoteModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, marginTop: 0 }]} onPress={saveNote}>
                <Text style={styles.saveText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
