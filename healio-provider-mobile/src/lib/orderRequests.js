// ─────────────────────────────────────────────────────────────────────────────
// orderRequests — shared lifecycle store for prescription-based orders.
//
//   patient sends request  →  awaiting_review
//   provider prices it     →  quoted
//   patient accepts amount →  confirmed   (wallet charged here, and only here)
//
//   provider rejects → cancelled   ·   patient declines → declined
//
// Both sides of the flow live in this one app, so the store sits at src/services
// and is imported by the patient module (to raise + accept) and by the pharmacy
// and lab modules (to price + send the invoice). Persistence is local
// (AsyncStorage) — swap the read/write pair for Supabase queries when the
// orders tables are wired up.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@healio_order_requests';

export const STATUS = {
  AWAITING_REVIEW: 'awaiting_review',
  QUOTED: 'quoted',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
};

export const GST_RATE = 0.05;

let cache = null;
const listeners = new Set();

// ── Storage ──────────────────────────────────────────────────────────────────

async function readAll() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : [];
  } catch (_) {
    cache = [];
  }
  return cache;
}

async function writeAll(next) {
  cache = next;
  listeners.forEach((fn) => { try { fn(next); } catch (_) {} });
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch (_) { /* in-memory copy still current */ }
}

async function patch(id, changes) {
  const all = await readAll();
  const next = all.map((r) => (r.id === id ? { ...r, ...changes, updatedAt: Date.now() } : r));
  await writeAll(next);
  return next.find((r) => r.id === id) || null;
}

/** Subscribe to any change; returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Newest first. Pass a kind ('pharmacy' | 'lab') to filter. */
export async function listRequests(kind) {
  const all = await readAll();
  return all
    .filter((r) => !kind || r.kind === kind)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getRequest(id) {
  const all = await readAll();
  return all.find((r) => r.id === id) || null;
}

// ── Ids ──────────────────────────────────────────────────────────────────────

const rand = (n) => Math.random().toString(36).slice(2, 2 + n).toUpperCase();

const makeOrderNumber = (kind) => `${kind === 'lab' ? 'LB' : 'PH'}-${rand(6)}`;
export const makeInvoiceNumber = () => `INV-${new Date().getFullYear()}-${rand(5)}`;

// ── Patient: raise a request ─────────────────────────────────────────────────

/**
 * @param {object} input
 *  kind             'pharmacy' | 'lab'
 *  providerName     display name of the pharmacy / lab
 *  patientName      who to show on the provider's queue
 *  notes            free-text medicines or tests the patient typed
 *  attachments      [{ name, kind, size, uri }]
 *  fulfilment       'delivery' | 'walkin' | 'home'
 *  fulfilmentLabel  human label, e.g. 'Home delivery'
 *  address          delivery / collection address (null when not applicable)
 *  slot             delivery slot, pickup time or appointment slot
 *  fee              { label, amount } charged on top of the priced items
 */
export async function createRequest(input) {
  const now = Date.now();
  const request = {
    id: `req_${now}_${rand(4)}`,
    orderNumber: makeOrderNumber(input.kind),
    status: STATUS.AWAITING_REVIEW,
    createdAt: now,
    updatedAt: now,
    invoice: null,
    paidAt: null,
    ...input,
  };
  const all = await readAll();
  await writeAll([request, ...all]);
  return request;
}

// ── Provider: price it ───────────────────────────────────────────────────────

/** Pharmacist / lab technician approves the request with a priced invoice. */
export async function issueInvoice(id, invoice) {
  return patch(id, { status: STATUS.QUOTED, invoice });
}

/** Provider turns the request down before it is priced. */
export async function rejectRequest(id, reason = '') {
  return patch(id, { status: STATUS.CANCELLED, closeReason: reason });
}

// ── Patient: accept or decline ───────────────────────────────────────────────

/**
 * Accepting the final amount is what confirms the order.
 * `payment` records how it was settled: { method, cash, paymentId }. A cash
 * order is confirmed but still owed — collected on delivery / at the counter.
 */
export async function acceptInvoice(id, payment = null) {
  return patch(id, { status: STATUS.CONFIRMED, paidAt: Date.now(), payment });
}

export async function declineInvoice(id, reason = '') {
  return patch(id, { status: STATUS.DECLINED, closeReason: reason });
}

export async function cancelRequest(id, reason = '') {
  return patch(id, { status: STATUS.CANCELLED, closeReason: reason });
}

// ── Invoice helpers (used by the provider's pricing editor) ──────────────────

/** Seed the editor with one row per line the patient typed. */
export function suggestLines(request) {
  const lines = String(request?.notes || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 10);
  if (lines.length > 0) return lines.map((label) => ({ label, amount: '' }));
  return [{
    label: request?.kind === 'lab' ? 'Tests as per prescription' : 'Medicines as per prescription',
    amount: '',
  }];
}

/** Totals for a set of editor rows — GST applies to medicines, not diagnostics. */
export function totalsFor(rows, fee, kind) {
  const items = rows
    .map((r) => ({ label: String(r.label || '').trim(), amount: Number(r.amount) || 0 }))
    .filter((r) => r.label && r.amount > 0);
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const gst = kind === 'lab' ? 0 : Math.round(subtotal * GST_RATE);
  const feeAmount = fee?.amount > 0 ? fee.amount : 0;
  return { items, subtotal, gst, total: subtotal + gst + feeAmount };
}

// ── Display helpers ──────────────────────────────────────────────────────────

export const STATUS_LABEL = {
  [STATUS.AWAITING_REVIEW]: 'Needs pricing',
  [STATUS.QUOTED]: 'Awaiting patient',
  [STATUS.CONFIRMED]: 'Confirmed',
  [STATUS.DECLINED]: 'Declined by patient',
  [STATUS.CANCELLED]: 'Cancelled',
};

export const formatWhen = (ts) =>
  new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
