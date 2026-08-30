// ─────────────────────────────────────────────────────────────────────────────
// PrescriptionRequest — "tell the provider what you need" step, shared by the
// pharmacy order and lab booking flows.
//
// The patient either attaches a prescription (photo, gallery image or PDF),
// types the details as free text, or both — the parent screen gates its
// Continue button on `hasRequest()`, which requires at least one of the two.
//
// Attachments stay on the device for now: the picked file's uri/name/size are
// passed up so the order payload can carry them. Uploading to storage is a
// separate step, wired where the order is submitted.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';

export const MAX_ATTACHMENTS = 5;

/** At least one of the two inputs must be filled to continue. */
export const hasRequest = (attachments = [], notes = '') =>
  attachments.length > 0 || notes.trim().length > 0;

export function formatBytes(size) {
  if (!size || size <= 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const SOURCES = [
  { id: 'camera',  icon: 'camera-outline', label: 'Camera' },
  { id: 'gallery', icon: 'image-outline',  label: 'Gallery' },
  { id: 'pdf',     icon: 'document-outline', label: 'PDF' },
];

const missingModule = (pkg) =>
  Alert.alert('Not available', `Run "npx expo install ${pkg}" and restart the app.`);

export default function PrescriptionRequest({
  attachments,
  onAttachmentsChange,
  notes,
  onNotesChange,
  title = 'Upload prescription',
  subtitle = 'Attach a clear photo or PDF of your doctor’s prescription.',
  notesLabel = 'Medicine details or message',
  notesPlaceholder = 'Type what you need, or add a note for the pharmacy…',
  helper = 'Attach a prescription, type the details, or both — at least one is needed to continue.',
  rxNote,
}) {
  const [busy, setBusy] = useState(false);

  const addAttachment = (file) => {
    if (attachments.length >= MAX_ATTACHMENTS) {
      Alert.alert('Limit reached', `You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    onAttachmentsChange([...attachments, file]);
  };

  const removeAttachment = (id) =>
    onAttachmentsChange(attachments.filter((a) => a.id !== id));

  const pickImage = async (fromCamera) => {
    setBusy(true);
    try {
      const ImagePicker = require('expo-image-picker');
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert(
          'Permission needed',
          fromCamera
            ? 'Allow camera access to photograph your prescription.'
            : 'Allow photo library access to attach your prescription.'
        );
        return;
      }
      const options = { quality: 0.7, mediaTypes: ['images'] };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      const asset = !result.canceled && result.assets?.[0];
      if (!asset) return;
      addAttachment({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'image',
        uri: asset.uri,
        name: asset.fileName || `prescription-${attachments.length + 1}.jpg`,
        size: asset.fileSize || 0,
        mimeType: asset.mimeType || 'image/jpeg',
      });
    } catch (e) {
      missingModule('expo-image-picker');
    } finally {
      setBusy(false);
    }
  };

  const pickPdf = async () => {
    setBusy(true);
    try {
      const DocumentPicker = require('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      const asset = !result.canceled && result.assets?.[0];
      if (!asset) return;
      addAttachment({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        kind: 'pdf',
        uri: asset.uri,
        name: asset.name || 'prescription.pdf',
        size: asset.size || 0,
        mimeType: asset.mimeType || 'application/pdf',
      });
    } catch (e) {
      missingModule('expo-document-picker');
    } finally {
      setBusy(false);
    }
  };

  const pick = (sourceId) => {
    if (busy) return;
    if (sourceId === 'camera') return pickImage(true);
    if (sourceId === 'gallery') return pickImage(false);
    return pickPdf();
  };

  const full = attachments.length >= MAX_ATTACHMENTS;

  return (
    <View style={{ gap: 14 }}>
      {/* ── Attachments ─────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.headIcon}>
            <Ionicons name="document-attach-outline" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSub}>{subtitle}</Text>
          </View>
        </View>

        <View style={styles.sourceRow}>
          {SOURCES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.sourceTile, (busy || full) && styles.sourceTileDisabled]}
              onPress={() => pick(s.id)}
              disabled={busy || full}
              activeOpacity={0.85}
            >
              <Ionicons name={s.icon} size={20} color={COLORS.primary} />
              <Text style={styles.sourceLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {attachments.length === 0 ? (
          <View style={styles.emptyDrop}>
            <Ionicons name="cloud-upload-outline" size={22} color={COLORS.textSecondary} />
            <Text style={styles.emptyDropText}>No file attached yet</Text>
            <Text style={styles.emptyDropHint}>JPG, PNG or PDF · up to {MAX_ATTACHMENTS} files</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {attachments.map((file) => (
              <View key={file.id} style={styles.fileRow}>
                {file.kind === 'image' ? (
                  <Image source={{ uri: file.uri }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.pdfThumb]}>
                    <Ionicons name="document-text" size={20} color={COLORS.primary} />
                  </View>
                )}
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
                  <Text style={styles.fileMeta}>
                    {file.kind === 'pdf' ? 'PDF document' : 'Image'}
                    {formatBytes(file.size) ? ` · ${formatBytes(file.size)}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeAttachment(file.id)}
                  style={styles.removeBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ))}
            {full && (
              <Text style={styles.limitNote}>Maximum {MAX_ATTACHMENTS} files attached.</Text>
            )}
          </View>
        )}
      </View>

      {/* ── Free-text details ───────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.headIcon}>
            <Ionicons name="create-outline" size={18} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{notesLabel}</Text>
            <Text style={styles.cardSub}>Optional if you’ve attached a prescription.</Text>
          </View>
        </View>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={onNotesChange}
          placeholder={notesPlaceholder}
          placeholderTextColor={COLORS.textSecondary}
          multiline
          maxLength={1000}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>{notes.length}/1000</Text>
      </View>

      {/* ── Guidance ────────────────────────────────────────────────────── */}
      <View style={styles.helperRow}>
        <Ionicons
          name={hasRequest(attachments, notes) ? 'checkmark-circle' : 'information-circle-outline'}
          size={15}
          color={hasRequest(attachments, notes) ? COLORS.success : COLORS.textSecondary}
        />
        <Text style={styles.helperText}>{helper}</Text>
      </View>
      {!!rxNote && (
        <View style={styles.rxRow}>
          <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.textSecondary} />
          <Text style={styles.helperText}>{rxNote}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: SIZES.radiusLg,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.m, gap: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  cardSub: { fontSize: 11.5, color: COLORS.textSecondary, marginTop: 2, lineHeight: 16 },

  sourceRow: { flexDirection: 'row', gap: 10 },
  sourceTile: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderStyle: 'dashed', backgroundColor: COLORS.background,
  },
  sourceTileDisabled: { opacity: 0.5 },
  sourceLabel: { fontSize: 11.5, fontWeight: '700', color: COLORS.primary },

  emptyDrop: {
    alignItems: 'center', gap: 4, paddingVertical: 16, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  emptyDropText: { fontSize: 12.5, fontWeight: '700', color: COLORS.textSecondary },
  emptyDropHint: { fontSize: 10.5, color: COLORS.textSecondary },

  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 10, borderRadius: 12,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  thumb: { width: 42, height: 42, borderRadius: 9, backgroundColor: COLORS.primarySoft },
  pdfThumb: { alignItems: 'center', justifyContent: 'center' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 12.5, fontWeight: '700', color: COLORS.text },
  fileMeta: { fontSize: 10.5, color: COLORS.textSecondary, marginTop: 2 },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.dangerSoft,
  },
  limitNote: { fontSize: 10.5, color: COLORS.textSecondary, textAlign: 'center' },

  notesInput: {
    minHeight: 118, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    fontSize: 14, lineHeight: 20, color: COLORS.text, backgroundColor: COLORS.background,
  },
  counter: { fontSize: 10.5, color: COLORS.textSecondary, textAlign: 'right', marginTop: -8 },

  helperRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 },
  rxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4, marginTop: -6 },
  helperText: { flex: 1, fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 16 },
});
