import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Modal, TextInput, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRecords } from '../controllers/RecordController';
import { useLanguage } from '../context/LanguageContext';
import { ApiService } from '../services/ApiService';

const RECORD_TYPES = [
  { id: 'prescription', label: 'Prescription' },
  { id: 'lab_report',   label: 'Lab Report' },
  { id: 'other',         label: 'Other' },
];

export default function Records({ route, navigation }) {
  const { t } = useLanguage();
  const { loading, records, refresh } = useRecords();
  const [selectedCategory, setSelectedCategory] = useState(route?.params?.category || 'All');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (route.params?.category) setSelectedCategory(route.params.category);
  }, [route.params?.category]);

  const matchesCategory = (r) => {
    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Medicine') return r.category === 'Medicine' || r.category === 'Pharmacy';
    return r.category === selectedCategory;
  };

  // ── Group hospital-linked records into per-visit cards ─────────────────────
  // (payments/pharmacy stay as a flat list under their own categories — only
  // clinical records, which carry a doctor/hospital, make sense as "a visit").
  const { visits, uploads, flatOthers } = useMemo(() => {
    const clinical = records.filter(r => r.organisationId && r.uploadedBy !== 'patient');
    const patientUploads = records.filter(r => r.uploadedBy === 'patient');
    const other = records.filter(r => !r.organisationId && r.uploadedBy !== 'patient'); // payments, pharmacy orders

    const groups = new Map();
    clinical.forEach((r) => {
      const key = r.appointmentId || `${r.organisationId}-${r.doctorName}-${r.date}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key, date: r.date, _ts: r._ts,
          organisationName: r.organisationName, doctorName: r.doctorName,
          items: [],
        });
      }
      groups.get(key).items.push(r);
    });
    const visitList = Array.from(groups.values())
      .map(v => ({ ...v, items: v.items.filter(matchesCategory) }))
      .filter(v => v.items.length > 0)
      .sort((a, b) => (b._ts || 0) - (a._ts || 0));

    const uploadList = patientUploads.filter(matchesCategory).sort((a, b) => (b._ts || 0) - (a._ts || 0));
    const otherList = other.filter(matchesCategory).sort((a, b) => (b._ts || 0) - (a._ts || 0));

    return { visits: visitList, uploads: uploadList, flatOthers: otherList };
  }, [records, selectedCategory]);

  const totalShown = visits.reduce((s, v) => s + v.items.length, 0) + uploads.length + flatOthers.length;

  const openFile = (url) => {
    if (!url) { Alert.alert('No file', 'This record has no attached document.'); return; }
    Linking.openURL(url).catch(() => Alert.alert('Cannot open file', 'Unable to open this document.'));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {selectedCategory !== 'All' ? (
          <TouchableOpacity onPress={() => setSelectedCategory('All')} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>{selectedCategory === 'All' ? t('medical_records') : (selectedCategory === 'Medicine' ? t('medicine') : t(selectedCategory.toLowerCase().replace(' ', '_')))}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowAddModal(true)}>
            <Ionicons name="add" size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ReportsHub')}>
            <View style={styles.exportBtn}>
              <Ionicons name="share-outline" size={20} color={COLORS.primary} />
              <Text style={styles.exportText}>{t('export_report')}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>{t('centralized_vault')}</Text>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 50 }} />
        ) : (
          <>
            <View style={styles.grid}>
              {['Prescriptions', 'Lab Reports', 'Medical History', 'Payments', 'Medicine'].map((cat) => {
                const count = cat === 'Medicine' ? records.filter(r => r.category === 'Medicine' || r.category === 'Pharmacy').length : records.filter(r => r.category === cat).length;
                const icon = cat === 'Prescriptions' ? 'document-text-outline' :
                            cat === 'Lab Reports' ? 'flask-outline' :
                            cat === 'Medical History' ? 'medical-outline' :
                            cat === 'Medicine' ? 'medkit-outline' : 'wallet-outline';
                const isActive = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.card, isActive && styles.activeCard]}
                    onPress={() => setSelectedCategory(isActive ? 'All' : cat)}
                  >
                    <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                      <Ionicons name={icon} size={28} color={isActive ? COLORS.white : COLORS.primary} />
                    </View>
                    <Text style={[styles.label, isActive && styles.activeLabel]}>{cat === 'Medicine' ? t('medicine') : t(cat.toLowerCase().replace(' ', '_'))}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{count} {t('items')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {totalShown === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={50} color={COLORS.border} />
                <Text style={styles.emptyText}>{t('no_records')}</Text>
              </View>
            ) : (
              <>
                {/* ── My Visits — grouped by hospital + doctor + date ────────────── */}
                {visits.length > 0 && (
                  <View style={styles.recentSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>My Visits</Text>
                      {selectedCategory !== 'All' && (
                        <TouchableOpacity onPress={() => setSelectedCategory('All')}>
                          <Text style={{ color: COLORS.primary, fontWeight: '600' }}>{t('clear_filter')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {visits.map(v => (
                      <VisitCard key={v.key} visit={v} onOpenFile={openFile} />
                    ))}
                  </View>
                )}

                {/* ── My Uploads — patient-added documents, not tied to a visit ──── */}
                {uploads.length > 0 && (
                  <View style={styles.recentSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>My Uploads</Text>
                      <TouchableOpacity onPress={() => setShowAddModal(true)}>
                        <Text style={{ color: COLORS.primary, fontWeight: '600' }}>+ Add</Text>
                      </TouchableOpacity>
                    </View>
                    {uploads.map(record => (
                      <TimelineItem
                        key={record.id}
                        title={record.title} desc="Added by you" date={record.date}
                        icon={record.icon} details={record.details}
                        onDownload={() => openFile(record.fileUrl)}
                      />
                    ))}
                  </View>
                )}

                {/* ── Payments / pharmacy orders — unchanged flat list ───────────── */}
                {flatOthers.length > 0 && (
                  <View style={styles.recentSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>{selectedCategory === 'All' ? 'Other' : t(selectedCategory.toLowerCase().replace(' ', '_'))}</Text>
                    </View>
                    {flatOthers.map(record => (
                      <TimelineItem
                        key={record.id}
                        title={record.title} desc={record.provider} date={record.date}
                        icon={record.icon} details={record.details} amount={record.amount} status={record.status}
                        onDownload={() => Alert.alert('Downloading', `Downloading ${record.title}...`)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <AddRecordModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={() => { setShowAddModal(false); refresh(); }}
      />
    </SafeAreaView>
  );
}

// ── A visit = one hospital encounter. Groups all records from that visit. ───
const VisitCard = ({ visit, onOpenFile }) => (
  <View style={styles.visitCard}>
    <View style={styles.visitHeader}>
      <View style={styles.visitIconWrap}>
        <Ionicons name="business" size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.visitDoctor}>{visit.doctorName || 'Doctor visit'}</Text>
        <Text style={styles.visitHospital}>{visit.organisationName || 'Hospital'}</Text>
      </View>
      <Text style={styles.visitDate}>{visit.date}</Text>
    </View>
    {visit.items.map((item, i) => (
      <TouchableOpacity
        key={item.id}
        style={[styles.visitRow, i === visit.items.length - 1 && { borderBottomWidth: 0 }]}
        onPress={() => onOpenFile(item.fileUrl)}
      >
        <Ionicons name={item.icon} size={16} color={COLORS.primary} style={{ marginRight: 10 }} />
        <Text style={styles.visitRowTitle} numberOfLines={1}>{item.title}</Text>
        {item.fileUrl ? <Ionicons name="open-outline" size={16} color={COLORS.textSecondary} /> : null}
      </TouchableOpacity>
    ))}
  </View>
);

const TimelineItem = ({ title, desc, date, icon, details, amount, status, onDownload }) => (
  <View style={styles.timelineItem}>
    <View style={styles.timelineLine} />
    <View style={styles.timelineIcon}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
    </View>
    <View style={styles.timelineContent}>
      <View style={styles.timelineHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.timelineTitle}>{title}</Text>
          {amount && <Text style={styles.timelineAmount}>{amount}</Text>}
        </View>
        <TouchableOpacity onPress={onDownload} style={styles.downloadIconBtn}>
          <Ionicons name="cloud-download-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.timelineDesc}>{desc}</Text>
      {details && <Text style={styles.timelineDetails}>{details}</Text>}
      <View style={styles.timelineFooterRow}>
        <Text style={styles.timelineDate}>{date}</Text>
        {status && (
          <View style={[styles.statusBadge, { backgroundColor: status === 'Normal' || status === 'Paid' ? '#e8f5e9' : '#fff3e0' }]}>
            <Text style={[styles.statusText, { color: status === 'Normal' || status === 'Paid' ? '#2e7d32' : '#ef6c00' }]}>{status}</Text>
          </View>
        )}
      </View>
    </View>
  </View>
);

// ── Add Record modal — patient uploads their own document into the vault ───
const AddRecordModal = ({ visible, onClose, onSaved }) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('prescription');
  const [asset, setAsset] = useState(null);
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setType('prescription'); setAsset(null); };

  const pickImage = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to attach a document.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) setAsset(result.assets[0]);
    } catch {
      Alert.alert('Not available', 'Run "npx expo install expo-image-picker" then restart the app.');
    }
  };

  const handleSave = async () => {
    if (!asset) { Alert.alert('Add a photo', 'Pick a photo of the document to upload.'); return; }
    setSaving(true);
    try {
      await ApiService.addPatientRecord({ title: title.trim(), type, asset });
      reset();
      onSaved();
    } catch (e) {
      Alert.alert('Could not save', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.addModalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Record</Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Type</Text>
          <View style={styles.typeRow}>
            {RECORD_TYPES.map(rt => (
              <TouchableOpacity
                key={rt.id}
                style={[styles.typePill, type === rt.id && styles.typePillActive]}
                onPress={() => setType(rt.id)}
              >
                <Text style={[styles.typePillText, type === rt.id && styles.typePillTextActive]}>{rt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Title (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Blood test from City Lab"
            placeholderTextColor={COLORS.textSecondary}
            value={title}
            onChangeText={setTitle}
          />

          <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
            <Ionicons name={asset ? 'checkmark-circle' : 'image-outline'} size={20} color={COLORS.primary} />
            <Text style={styles.pickBtnText}>{asset ? 'Photo selected — tap to change' : 'Choose photo from gallery'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.confirmBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.confirmBtnText}>Save Record</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12
  },
  exportText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 4
  },
  container: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACING.m },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.l, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: SPACING.m,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  activeCard: { borderColor: COLORS.primary, backgroundColor: COLORS.secondary },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  activeIconContainer: { backgroundColor: COLORS.primary },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  activeLabel: { color: COLORS.primary },
  badge: { backgroundColor: COLORS.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '700' },
  recentSection: { marginTop: SPACING.m },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.l },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },

  // Visit card
  visitCard: {
    backgroundColor: COLORS.white, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.m, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4,
  },
  visitHeader: {
    flexDirection: 'row', alignItems: 'center', padding: SPACING.m,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  visitIconWrap: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  visitDoctor: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  visitHospital: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  visitDate: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '700' },
  visitRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.m, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F3F5',
  },
  visitRowTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },

  timelineItem: { flexDirection: 'row', marginBottom: 20, position: 'relative' },
  timelineLine: {
    position: 'absolute',
    left: 19,
    top: 36,
    bottom: -22,
    width: 2,
    backgroundColor: COLORS.border
  },
  timelineIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    zIndex: 1
  },
  timelineContent: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  downloadIconBtn: {
    padding: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    marginLeft: 8
  },
  timelineAmount: { fontSize: 15, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  timelineDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontWeight: '500' },
  timelineDetails: {
    fontSize: 11,
    color: COLORS.text,
    marginTop: 6,
    fontStyle: 'italic',
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.primary + '40',
    lineHeight: 16,
  },
  timelineFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  timelineDate: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  statusBadge: { marginLeft: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 30 },
  emptyText: { color: COLORS.textSecondary, marginTop: 10 },

  // Add Record modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  addModalContent: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 30, borderTopRightRadius: 30,
    padding: SPACING.l,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: SPACING.m, paddingBottom: SPACING.m,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  inputLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 8, marginTop: SPACING.s },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.s },
  typePill: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  typePillActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.primary },
  typePillText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  typePillTextActive: { color: COLORS.primary, fontWeight: '700' },
  textInput: {
    height: 50, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    backgroundColor: COLORS.surface, paddingHorizontal: 15, fontSize: 14, color: COLORS.text,
  },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: SPACING.m, padding: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed', backgroundColor: COLORS.secondary,
  },
  pickBtnText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.primary },
  confirmBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 26,
    alignItems: 'center', marginTop: SPACING.l,
  },
  confirmBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
