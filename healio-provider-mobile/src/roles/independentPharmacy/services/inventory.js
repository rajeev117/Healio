// ─────────────────────────────────────────────────────────────────────────────
// The pharmacy's stock.
//
// LOCAL ONLY. There is no pharmacy_inventory table yet — see the deferred list
// in the implementation plan. Rows are shaped like the future table
// (organisation_id, sku, name, brand, pack, mrp, stock_qty, reorder_level,
// batch_no, expiry) so swapping this for a Supabase query is a
// useState → useEffect(fetch) change and nothing else.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@healio_indie_pharmacy_inventory';

const SEED = [
  { id: 'i1', name: 'Azithral 500 mg', brand: 'Alembic',   pack: '3 tablets', sku: 'AZ500',  mrp: 198, stock_qty: 2,  reorder_level: 20, batch_no: 'AZ4471', expiry: '2027-09' },
  { id: 'i2', name: 'Pan-D capsule',   brand: 'Alkem',     pack: '15 caps',   sku: 'PAND',   mrp: 184, stock_qty: 4,  reorder_level: 15, batch_no: 'PD8890', expiry: '2026-11' },
  { id: 'i3', name: 'Dolo 650 mg',     brand: 'Micro Labs', pack: '15 tablets', sku: 'DOLO650', mrp: 31, stock_qty: 9, reorder_level: 30, batch_no: 'DL2210', expiry: '2028-03' },
  { id: 'i4', name: 'Ascoril LS syrup', brand: 'Glenmark', pack: '100 ml',    sku: 'ASCLS',  mrp: 127, stock_qty: 0,  reorder_level: 10, batch_no: '—',      expiry: '—' },
  { id: 'i5', name: 'Cetirizine 10 mg', brand: 'Cipla',    pack: '10 tablets', sku: 'CTZ10', mrp: 42,  stock_qty: 11, reorder_level: 25, batch_no: 'CT1180', expiry: '2027-06' },
  { id: 'i6', name: 'Zeecof-LS syrup', brand: 'Zenlabs',   pack: '100 ml',    sku: 'ZEELS',  mrp: 119, stock_qty: 24, reorder_level: 10, batch_no: 'ZL3320', expiry: '2027-02' },
  { id: 'i7', name: 'Amoxyclav 625',   brand: 'Cipla',     pack: '10 tablets', sku: 'AMX625', mrp: 236, stock_qty: 42, reorder_level: 20, batch_no: 'AC7781', expiry: '2027-12' },
  { id: 'i8', name: 'ORS sachet',      brand: 'Prolyte',   pack: '21.8 g',    sku: 'ORS',    mrp: 22,  stock_qty: 66, reorder_level: 30, batch_no: 'OR9912', expiry: '2028-08' },
];

export const FILTERS = ['All', 'Low stock', 'Expiring', 'Out of stock'];

let cache = null;
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function listStock() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : SEED;
  } catch (_) {
    cache = SEED;
  }
  return cache;
}

async function persist(next) {
  cache = next;
  listeners.forEach((fn) => { try { fn(next); } catch (_) {} });
  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}

export async function upsertItem(item) {
  const all = await listStock();
  const exists = all.some((i) => i.id === item.id);
  return persist(exists ? all.map((i) => (i.id === item.id ? { ...i, ...item } : i)) : [{ ...item, id: item.id || `i_${Date.now()}` }, ...all]);
}

export async function adjustStock(id, delta) {
  const all = await listStock();
  return persist(all.map((i) => (i.id === id ? { ...i, stock_qty: Math.max(0, (i.stock_qty || 0) + delta) } : i)));
}

export async function removeItem(id) {
  const all = await listStock();
  return persist(all.filter((i) => i.id !== id));
}

// ── Derived state ────────────────────────────────────────────────────────────

export const isLow = (i) => (i.stock_qty || 0) <= (i.reorder_level || 0);
export const isOut = (i) => (i.stock_qty || 0) === 0;

export const isExpiring = (i, months = 2) => {
  if (!i.expiry || i.expiry === '—') return false;
  const [y, m] = String(i.expiry).split('-').map(Number);
  if (!y || !m) return false;
  const exp = new Date(y, m - 1, 1);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() + months);
  return exp <= cutoff;
};

export function stockStats(items) {
  return {
    total: items.length,
    low: items.filter(isLow).length,
    expiring: items.filter((i) => isExpiring(i)).length,
    out: items.filter(isOut).length,
  };
}

export function applyFilter(items, filter) {
  if (filter === 'Low stock') return items.filter(isLow);
  if (filter === 'Expiring') return items.filter((i) => isExpiring(i));
  if (filter === 'Out of stock') return items.filter(isOut);
  return items;
}

/** The shape pharmacy_orders.items expects: [{ name, brand, pack, quantity, unit_price }]. */
export const toOrderLine = (item, quantity = 1) => ({
  name: item.name,
  brand: item.brand || null,
  pack: item.pack || null,
  quantity,
  unit_price: Number(item.mrp) || 0,
  sku: item.sku || null,
  substituted_for: null,
});
