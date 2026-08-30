// What's on the shelf — stock levels, batches and expiry.
//
// LOCAL STATE ONLY, backed by AsyncStorage (services/inventory.js). There is no
// pharmacy_inventory table yet; the rows are already shaped like the future one
// so switching over is a fetch swap.
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import AppBar from '../components/AppBar';
import {
  listStock, upsertItem, adjustStock, removeItem,
  stockStats, applyFilter, isLow, isOut, isExpiring, FILTERS, subscribe,
} from '../services/inventory';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const BLANK = { name: '', brand: '', pack: '', sku: '', mrp: '', stock_qty: '', reorder_level: '', batch_no: '', expiry: '' };

export default function Inventory() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    listStock().then(setItems).catch(() => setItems([]));
    return subscribe(setItems);
  }, []);

  const stats = useMemo(() => stockStats(items), [items]);

  const visible = applyFilter(items, filter).filter((i) => {
    const q = query.trim().toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || String(i.sku || '').toLowerCase().includes(q);
  });

  const save = async () => {
    if (!editing.name.trim()) { Alert.alert('Name needed', 'Give the item a name.'); return; }
    await upsertItem({
      ...editing,
      name: editing.name.trim(),
      mrp: Number(editing.mrp) || 0,
      stock_qty: Number(editing.stock_qty) || 0,
      reorder_level: Number(editing.reorder_level) || 0,
    });
    setEditing(null);
  };

  const confirmRemove = (i) => {
    Alert.alert('Remove item', `Take "${i.name}" off your inventory?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeItem(i.id) },
    ]);
  };

  const stockColor = (i) => (isOut(i) ? COLORS.error : isLow(i) ? COLORS.warning : COLORS.text);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppBar
        title="Inventory"
        subtitle={`${stats.total} SKUs · ${stats.low} below reorder`}
        actionLabel="Add"
        onAction={() => setEditing({ ...BLANK })}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 20, paddingBottom: SPACING.xl * 2 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search medicine, salt or SKU"
            placeholderTextColor={COLORS.borderStrong}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipOn]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.tiles}>
          <Tile value={String(stats.total)} label="Total SKUs" />
          <Tile value={String(stats.low)} label="Below reorder" tint={stats.low ? COLORS.error : COLORS.text} />
          <Tile value={String(stats.expiring)} label="Expiring < 60d" tint={stats.expiring ? COLORS.warning : COLORS.text} />
        </View>

        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
          <Text style={styles.noticeText}>
            Stock lives on this device for now and drops automatically when an order goes out. A server-side
            inventory is next.
          </Text>
        </View>

        {visible.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="cube-outline" size={36} color={COLORS.borderStrong} />
            <Text style={styles.emptyText}>Nothing here</Text>
          </View>
        ) : visible.map(i => (
          <View key={i.id} style={styles.row}>
            <View style={[styles.rail, { backgroundColor: isOut(i) ? COLORS.error : isLow(i) ? COLORS.warning : '#dcd2cf' }]} />
            <TouchableOpacity
              style={styles.rowInner}
              onPress={() => setEditing({
                ...i,
                mrp: String(i.mrp), stock_qty: String(i.stock_qty), reorder_level: String(i.reorder_level),
              })}
              onLongPress={() => confirmRemove(i)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{i.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {i.batch_no && i.batch_no !== '—' ? `Batch ${i.batch_no} · exp ${i.expiry}` : [i.brand, i.pack].filter(Boolean).join(' · ')}
                  </Text>
                  {isExpiring(i) && (
                    <View style={styles.expChip}><Text style={styles.expChipText}>Expiring</Text></View>
                  )}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={[styles.stock, { color: stockColor(i) }]}>
                  {i.stock_qty} {i.stock_qty === 1 ? 'unit' : 'units'}
                </Text>
                <View style={styles.adjustRow}>
                  <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustStock(i.id, -1)} hitSlop={6}>
                    <Text style={styles.adjustSign}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.reorder}>min {i.reorder_level}</Text>
                  <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustStock(i.id, 1)} hitSlop={6}>
                    <Text style={styles.adjustSign}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={styles.cta} onPress={() => setEditing({ ...BLANK })}>
          <Text style={styles.ctaText}>Add stock item</Text>
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
            <Text style={styles.sheetTitle}>{editing?.id ? 'Edit item' : 'New stock item'}</Text>

            <Field label="Name" value={editing?.name} onChange={(v) => setEditing(e => ({ ...e, name: v }))} placeholder="Azithral 500 mg" />
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}><Field label="Brand" value={editing?.brand} onChange={(v) => setEditing(e => ({ ...e, brand: v }))} placeholder="Alembic" /></View>
              <View style={{ flex: 1 }}><Field label="Pack" value={editing?.pack} onChange={(v) => setEditing(e => ({ ...e, pack: v }))} placeholder="3 tablets" /></View>
            </View>
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}><Field label="SKU" value={editing?.sku} onChange={(v) => setEditing(e => ({ ...e, sku: v }))} placeholder="AZ500" /></View>
              <View style={{ flex: 1 }}><Field label="MRP (₹)" value={editing?.mrp} onChange={(v) => setEditing(e => ({ ...e, mrp: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" placeholder="198" /></View>
            </View>
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}><Field label="In stock" value={editing?.stock_qty} onChange={(v) => setEditing(e => ({ ...e, stock_qty: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" placeholder="20" /></View>
              <View style={{ flex: 1 }}><Field label="Reorder at" value={editing?.reorder_level} onChange={(v) => setEditing(e => ({ ...e, reorder_level: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" placeholder="10" /></View>
            </View>
            <View style={styles.fieldRow}>
              <View style={{ flex: 1 }}><Field label="Batch no." value={editing?.batch_no} onChange={(v) => setEditing(e => ({ ...e, batch_no: v }))} placeholder="AZ4471" /></View>
              <View style={{ flex: 1 }}><Field label="Expiry (YYYY-MM)" value={editing?.expiry} onChange={(v) => setEditing(e => ({ ...e, expiry: v }))} placeholder="2027-09" /></View>
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setEditing(null)}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetSave} onPress={save}>
                <Text style={styles.sheetSaveText}>Save item</Text>
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
  tileLabel: { fontSize: 10, fontWeight: '500', color: COLORS.textSecondary, marginTop: 4 },
  notice: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: COLORS.primarySoft, borderRadius: 14, padding: 12, marginBottom: 14,
  },
  noticeText: { flex: 1, fontSize: 11, color: '#a1736a', lineHeight: 16 },
  row: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  rail: { width: 3 },
  rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  rowName: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  rowMeta: { fontSize: 10.5, color: COLORS.textSecondary, flexShrink: 1 },
  expChip: { backgroundColor: COLORS.warningSoft, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  expChipText: { fontSize: 9.5, fontWeight: '700', color: '#b45309' },
  stock: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adjustBtn: { width: 24, height: 22, borderRadius: 7, borderWidth: 1, borderColor: COLORS.borderStrong, justifyContent: 'center', alignItems: 'center' },
  adjustSign: { fontSize: 13, fontWeight: '800', color: COLORS.primary, lineHeight: 16 },
  reorder: { fontSize: 9.5, fontWeight: '600', color: COLORS.textSecondary },
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
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: SPACING.s },
  sheetCancel: { flex: 1, borderWidth: 1.4, borderColor: COLORS.borderStrong, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  sheetCancelText: { fontSize: 13.5, fontWeight: '700', color: COLORS.primary },
  sheetSave: { flex: 2, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  sheetSaveText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
});
