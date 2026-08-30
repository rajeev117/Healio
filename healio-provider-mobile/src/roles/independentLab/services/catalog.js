// ─────────────────────────────────────────────────────────────────────────────
// The lab's own test catalog.
//
// LOCAL ONLY. There is no lab_tests table yet — see the deferred list in the
// implementation plan. Rows are shaped exactly like the future table
// (organisation_id, name, code, category, price, turnaround_hours,
// home_collection, is_live) so swapping this for a Supabase query is a
// useState → useEffect(fetch) change and nothing else.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@healio_indie_lab_catalog';

const SEED = [
  { id: 't1', name: 'Complete Blood Count',        code: 'CBC',     category: 'Pathology', price: 450,  turnaround_hours: 6,  home_collection: true,  is_live: true },
  { id: 't2', name: 'Liver Function Test',         code: 'LFT',     category: 'Pathology', price: 690,  turnaround_hours: 12, home_collection: true,  is_live: true },
  { id: 't3', name: 'Thyroid Profile (T3 T4 TSH)', code: 'TFT',     category: 'Pathology', price: 400,  turnaround_hours: 24, home_collection: true,  is_live: true },
  { id: 't4', name: 'Vitamin D (25-OH)',           code: 'VITD',    category: 'Pathology', price: 1200, turnaround_hours: 24, home_collection: false, is_live: true },
  { id: 't5', name: 'Dengue NS1 Antigen',          code: 'DEN-NS1', category: 'Pathology', price: 850,  turnaround_hours: 4,  home_collection: false, is_live: false },
  { id: 't6', name: 'HbA1c',                       code: 'HBA1C',   category: 'Pathology', price: 520,  turnaround_hours: 8,  home_collection: true,  is_live: true },
  { id: 't7', name: 'Chest X-Ray (PA view)',       code: 'CXR-PA',  category: 'Radiology', price: 600,  turnaround_hours: 2,  home_collection: false, is_live: true },
  { id: 't8', name: 'Ultrasound Abdomen',          code: 'USG-ABD', category: 'Radiology', price: 1400, turnaround_hours: 3,  home_collection: false, is_live: true },
  { id: 't9', name: 'Full Body Checkup',           code: 'PKG-FBC', category: 'Packages',  price: 2999, turnaround_hours: 24, home_collection: true,  is_live: true },
];

export const CATEGORIES = ['All', 'Pathology', 'Radiology', 'Packages'];

let cache = null;
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function listTests() {
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

export async function upsertTest(test) {
  const all = await listTests();
  const exists = all.some((t) => t.id === test.id);
  return persist(exists ? all.map((t) => (t.id === test.id ? { ...t, ...test } : t)) : [{ ...test, id: test.id || `t_${Date.now()}` }, ...all]);
}

export async function toggleLive(id) {
  const all = await listTests();
  return persist(all.map((t) => (t.id === id ? { ...t, is_live: !t.is_live } : t)));
}

export async function removeTest(id) {
  const all = await listTests();
  return persist(all.filter((t) => t.id !== id));
}

/** Stats for the catalog header. */
export function catalogStats(tests) {
  const live = tests.filter((t) => t.is_live);
  const prices = live.map((t) => Number(t.price) || 0).sort((a, b) => a - b);
  const tats = live.map((t) => Number(t.turnaround_hours) || 0).sort((a, b) => a - b);
  const median = (arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : 0);
  return {
    live: live.length,
    avgPrice: live.length ? Math.round(prices.reduce((s, p) => s + p, 0) / live.length) : 0,
    medianTat: median(tats),
  };
}

/** The shape lab_orders.tests expects: [{ name, price, turnaround }]. */
export const toOrderLine = (t) => ({
  name: t.name,
  price: Number(t.price) || 0,
  turnaround: t.turnaround_hours ? `${t.turnaround_hours} hrs` : null,
  code: t.code || null,
});
