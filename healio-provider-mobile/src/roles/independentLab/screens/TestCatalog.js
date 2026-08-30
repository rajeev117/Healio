// The lab's own price list — what it offers, what it charges, how fast, and
// whether it will collect at home.
//
// LOCAL STATE ONLY, backed by AsyncStorage (services/catalog.js). There is no
// lab_tests table yet; the rows are already shaped like the future one so
// switching over is a fetch swap.
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import AppBar from '../components/AppBar';
import {
  listTests, upsertTest, toggleLive, removeTest, catalogStats, CATEGORIES, subscribe,
} from '../services/catalog';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const BLANK = { name: '', code: '', category: 'Pathology', price: '', turnaround_hours: '', home_collection: false, is_live: true };

export default function TestCatalog({ navigation }) {
  const insets = useSafeAreaInsets();
  const [tests, setTests] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => { listTests().then(setTests).catch(() => setTests([])); }, []);
  useEffect(() => { load(); return subscribe(setTests); }, [load]);

  const stats = useMemo(() => catalogStats(tests), [tests]);

  const visible = tests.filter((t) => {
    const inCat = category === 'All' || t.category === category;
    const q = query.trim().toLowerCase();
    const inQuery = !q || t.name.toLowerCase().includes(q) || String(t.code || '').toLowerCase().includes(q);
    return inCat && inQuery;
  });

  const save = async () => {
    if (!editing.name.trim()) { Alert.alert('Name needed', 'Give the test a name.'); return; }
    await upsertTest({
      ...editing,
      name: editing.name.trim(),
      code: editing.code.trim() || null,
      price: Number(editing.price) || 0,
      turnaround_hours: Number(editing.turnaround_hours) || 0,
    });
    setEditing(null);
  };

  const confirmRemove = (t) => {
    Alert.alert('Remove test', `Take "${t.name}" off your catalog?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeTest(t.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar
        title="Test catalog"
        subtitle={`${stats.live} live · ${tests.length} total`}
        actionLabel="Add"
        onAction={() => setEditing({ ...BLANK })}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tests, panels or codes"
            placeholderTextColor={COLORS.borderStrong}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, category === c && styles.chipOn]}
              onPress={() => setCategory(c)}
            >
              <Text style={[styles.chipText, category === c && styles.chipTextOn]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.tiles}>
          <Tile value={String(stats.live)} label="Live tests" />
          <Tile value={inr(stats.avgPrice)} label="Avg price" tint={COLORS.primary} />
          <Tile value={`${stats.medianTat} hrs`} label="Median TAT" />
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.noticeText}>
            Your catalog lives on this device for now. It feeds the quote screen — a server-side price list is next.
          </Text>
        </View>

        {visible.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="flask-outline" size={36} color={COLORS.borderStrong} />
            <Text style={styles.emptyText}>No tests match</Text>
          </View>
        ) : visible.map(t => (
          <View key={t.id} style={styles.row}>
            <View style={[styles.rail, { backgroundColor: t.is_live ? COLORS.primary : '#dcd2cf' }]} />
            <TouchableOpacity
              style={styles.rowInner}
              onPress={() => setEditing({ ...t, price: String(t.price), turnaround_hours: String(t.turnaround_hours) })}
              onLongPress={() => confirmRemove(t)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, !t.is_live && styles.rowNameOff]}>{t.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.rowMeta}>{t.code || '—'}</Text>
                  <View style={styles.metaDot} />
                  <Text style={styles.rowMeta}>{t.turnaround_hours} hrs</Text>
                  {t.home_collection && (
                    <View style={styles.homeChip}><Text style={styles.homeChipText}>Home</Text></View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 7 }}>
                <Text style={[styles.price, !t.is_live && { color: COLORS.borderStrong }]}>{inr(t.price)}</Text>
                <TouchableOpacity onPress={() => toggleLive(t.id)}>
                  <View style={[styles.miniTrack, t.is_live && styles.miniTrackOn]}>
                    <View style={[styles.miniKnob, t.is_live ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
                  </View>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={styles.cta} onPress={() => setEditing({ ...BLANK })}>
          <Text style={styles.ctaText}>Add a test to catalog</Text>
        </TouchableOpacity>
      </View>

      {/* Editor */}
      <Modal visible={!!editing} animationType="slide" transparent onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.sheet}
            contentContainerStyle={{ paddingBottom: 20 + insets.bottom }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{editing?.id ? 'Edit test' : 'New test'}</Text>

            <Field label="Name" value={editing?.name} onChange={(v) => setEditing(e => ({ ...e, name: v }))} placeholder="Complete Blood Count" />
            <Field label="Code" value={editing?.code} onChange={(v) => setEditing(e => ({ ...e, code: v }))} placeholder="CBC" />

            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}>
                <Field label="Price (₹)" value={editing?.price} onChange={(v) => setEditing(e => ({ ...e, price: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" placeholder="450" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Turnaround (hrs)" value={editing?.turnaround_hours} onChange={(v) => setEditing(e => ({ ...e, turnaround_hours: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" placeholder="6" />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.catRow}>
              {CATEGORIES.filter(c => c !== 'All').map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, editing?.category === c && styles.chipOn]}
                  onPress={() => setEditing(e => ({ ...e, category: c }))}
                >
                  <Text style={[styles.chipText, editing?.category === c && styles.chipTextOn]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setEditing(e => ({ ...e, home_collection: !e.home_collection }))}
              activeOpacity={0.7}
            >
              <Text style={styles.toggleLabel}>Available for home collection</Text>
              <View style={[styles.track, editing?.home_collection && styles.trackOn]}>
                <View style={[styles.knob, editing?.home_collection ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]} />
              </View>
            </TouchableOpacity>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setEditing(null)}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetSave} onPress={save}>
                <Text style={styles.sheetSaveText}>Save test</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const Tile = ({ value, label, tint }) => (
  <View style={styles.tile}>
    <Text style={[styles.tileValue, tint && { color: tint }]}>{value}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
  </View>
);

const Field = ({ label, value, onChange, placeholder, keyboardType }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={COLORS.borderStrong}
      keyboardType={keyboardType}
    />
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  container: { flex: 1, backgroundColor: COLORS.surface },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 4,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  chip: { backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 11.5, fontWeight: '700', color: COLORS.textSecondary },
  chipTextOn: { color: COLORS.white },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tile: { flex: 1, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 13 },
  tileValue: { fontSize: 17, fontWeight: '900', color: COLORS.text, letterSpacing: -0.5 },
  tileLabel: { fontSize: 10.5, fontWeight: '500', color: COLORS.textSecondary, marginTop: 4 },
  notice: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: COLORS.primarySoft, borderRadius: 14, padding: 12, marginBottom: 14,
  },
  noticeText: { flex: 1, fontSize: 11, color: '#a1736a', lineHeight: 16 },
  row: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  rail: { width: 3 },
  rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  rowName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  rowNameOff: { color: '#9aa0a6' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  rowMeta: { fontSize: 10.5, color: COLORS.textSecondary },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#d8d2d0' },
  homeChip: { backgroundColor: COLORS.tintTeal, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  homeChipText: { fontSize: 9.5, fontWeight: '700', color: COLORS.tintTealInk },
  price: { fontSize: 15, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.3 },
  miniTrack: { width: 30, height: 18, borderRadius: 9, padding: 2.5, justifyContent: 'center', backgroundColor: '#dcdce2' },
  miniTrackOn: { backgroundColor: COLORS.success },
  miniKnob: { width: 13, height: 13, borderRadius: 7, backgroundColor: COLORS.white },
  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  footer: {
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingHorizontal: 20, paddingTop: 14,
  },
  cta: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '88%' },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: COLORS.border, marginBottom: 14 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: SPACING.m },
  fieldLabel: { fontSize: 10.5, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 8, fontSize: 13.5, color: COLORS.text },
  fieldRow: { flexDirection: 'row', gap: 12 },
  catRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  toggleLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  track: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center', backgroundColor: '#dcdce2' },
  trackOn: { backgroundColor: COLORS.success },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: SPACING.l },
  sheetCancel: { flex: 1, borderWidth: 1.4, borderColor: COLORS.borderStrong, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  sheetCancelText: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
  sheetSave: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  sheetSaveText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
