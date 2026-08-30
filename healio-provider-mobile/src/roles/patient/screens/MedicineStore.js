// ─────────────────────────────────────────────────────────────────────────────
// MedicineStore — 1mg-style medicine browsing & booking (FRONTEND ONLY).
//
// ⚠️ Not wired to a backend yet — browses a bundled local JSON sample, not a
// live `medicines` table. Kept for the future pharmacy feature. The patient
// NEVER sees a specific pharmacy "store"; they just browse/search medicines
// and book — the order is routed to a pharmacy behind the scenes (like
// 1mg / PharmEasy).
//
// ── TEST DATA SOURCE ──────────────────────────────────────────────────────
// medicinesData.json (~1,400 rows) is a category-balanced sample pulled from
// the public "Indian Medicine Dataset" (github.com/junioralive/Indian-Medicine-Dataset,
// CSV — id/name/price/manufacturer/pack_size/composition columns, 253,973 rows
// total). We only took a slice + derived two fields that aren't in the source
// data, both heuristic/synthetic and NOT clinically validated:
//   • category — keyword-matched from the composition text into one of the
//     CATEGORIES below (falls back to "Other").
//   • rx       — true if the composition matches a small list of antibiotic/
//     controlled-drug keywords. This is a rough guess for UI testing only —
//     do NOT treat it as a real prescription-requirement source.
// `price` is a synthetic ~12% discount off the dataset's `mrp` (the dataset
// has no separate selling price). manufacturer_name passed through as-is.
// The (private) MongoDB Data API shown in the dataset's README needs
// credentials we don't have, so this was sourced from the public CSV instead.
//
// ── BRAINSTORM: where does the medicine catalog come from? ───────────────────
// Option A — Central master catalog (RECOMMENDED):
//   A `medicines` table we own: { id, name, composition/salt, form (tab/syrup),
//   strength, pack_size, mrp, price, prescription_required, image_url, category }.
//   Admin manages it (or we bulk-import once). Patients browse THIS catalog.
//   Pros: full control, fast search, consistent UX. Cons: we maintain it.
//
// Option B — Per-pharmacy inventory on top of the master catalog:
//   `pharmacy_inventory` { pharmacy_org_id, medicine_id, stock, price }.
//   Patient still browses the master catalog (Option A); on booking we pick a
//   pharmacy that has stock + is nearest (uses the lat/lng we already store).
//   This is how real aggregators work and is the end goal.
//
// Option C — Import an open drug database to seed the catalog:
//   e.g. India drug datasets / RxNorm / OpenFDA → load into the `medicines`
//   table once, then maintain pricing/stock ourselves. Good starting seed.
//
// Booking flow (future): browse → add to cart → (upload prescription if any
// Rx-required item) → confirm → create a `pharmacy_orders` row (already exists)
// with items[] → routed to nearest in-stock pharmacy → provider PharmacyHome
// fulfils it. Payment via the wallet/gateway (the pending payments work).
//
// For now this screen is pure UI so we can iterate on the experience.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, FlatList, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../constants/theme';
import MEDICINES from '../services/medicinesData.json';

const CATEGORIES = ['All', 'Fever', 'Pain Relief', 'Cold & Cough', 'Diabetes', 'Heart', 'Vitamins', 'Antibiotics', 'Other'];

export default function MedicineStore({ navigation }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState({}); // id -> qty

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // "Other" / unfiltered search over 1,400 rows — cap rendered results so
    // a broad query doesn't dump the whole catalog into the list at once.
    const matches = MEDICINES.filter(m => {
      const matchesCat = category === 'All' || m.category === category;
      const matchesSearch = !q || m.name.toLowerCase().includes(q) || m.salt.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
    return matches.slice(0, 200);
  }, [search, category]);

  const add = (id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const remove = (id) => setCart(c => {
    const n = (c[id] || 0) - 1;
    const next = { ...c };
    if (n <= 0) delete next[id]; else next[id] = n;
    return next;
  });

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = Object.entries(cart).reduce((s, [id, q]) => {
    const m = MEDICINES.find(x => x.id === id);
    return s + (m ? m.price * q : 0);
  }, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Medicines</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search medicines, salts…"
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c} style={[styles.catChip, category === c && styles.catChipActive]} onPress={() => setCategory(c)}>
              <Text style={[styles.catText, category === c && styles.catTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={{ padding: SPACING.m, paddingBottom: cartCount ? 90 : 20 }}
        ListEmptyComponent={<Text style={styles.empty}>No medicines found.</Text>}
        ListHeaderComponent={
          filtered.length > 0
            ? <Text style={styles.resultCount}>{filtered.length}{filtered.length === 200 ? '+' : ''} medicine{filtered.length === 1 ? '' : 's'}</Text>
            : null
        }
        renderItem={({ item }) => {
          const qty = cart[item.id] || 0;
          return (
            <View style={styles.card}>
              <View style={styles.pillIcon}><MaterialCommunityIcons name="pill" size={22} color="#1b7a3d" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{item.name}</Text>
                <Text style={styles.medSalt}>{item.salt} · {item.form}</Text>
                {!!item.manufacturer && <Text style={styles.medMfr}>{item.manufacturer}</Text>}
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{item.price}</Text>
                  <Text style={styles.mrp}>₹{item.mrp}</Text>
                  {item.rx && <View style={styles.rxBadge}><Text style={styles.rxText}>Rx</Text></View>}
                </View>
              </View>
              {qty === 0 ? (
                <TouchableOpacity style={styles.addBtn} onPress={() => add(item.id)}>
                  <Text style={styles.addText}>ADD</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.qtyBox}>
                  <TouchableOpacity onPress={() => remove(item.id)}><Ionicons name="remove" size={18} color={COLORS.primary} /></TouchableOpacity>
                  <Text style={styles.qtyText}>{qty}</Text>
                  <TouchableOpacity onPress={() => add(item.id)}><Ionicons name="add" size={18} color={COLORS.primary} /></TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      {cartCount > 0 && (
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartCount}>{cartCount} item{cartCount > 1 ? 's' : ''}</Text>
            <Text style={styles.cartTotal}>₹{cartTotal}</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={() => Alert.alert(
              'Not available yet',
              'Online medicine ordering is coming soon. For now, please ask your doctor to send a prescription to a pharmacy, or visit one of our partner pharmacies directly.'
            )}
          >
            <Text style={styles.checkoutText}>Proceed to book</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.m, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: SPACING.m, marginBottom: 8, paddingHorizontal: 14, height: 48, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: COLORS.text },
  catRow: { paddingHorizontal: SPACING.m, gap: 8, paddingVertical: 4 },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  catTextActive: { color: COLORS.white },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 12, gap: 12 },
  pillIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center' },
  medName: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  medSalt: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  medMfr: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1, fontStyle: 'italic' },
  resultCount: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '700', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  price: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  mrp: { fontSize: 12, color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  rxBadge: { backgroundColor: '#fff3e0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rxText: { fontSize: 10, fontWeight: '800', color: '#c05621' },
  addBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  addText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  qtyText: { fontSize: 14, fontWeight: '800', color: COLORS.text, minWidth: 16, textAlign: 'center' },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 40 },
  cartBar: { position: 'absolute', left: SPACING.m, right: SPACING.m, bottom: 16, backgroundColor: COLORS.primary, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartCount: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  cartTotal: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkoutText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});
