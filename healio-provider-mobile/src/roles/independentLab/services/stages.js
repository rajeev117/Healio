// ─────────────────────────────────────────────────────────────────────────────
// Fine-grained lab stages.
//
// order_status (schema.sql:41-44) is 'pending | confirmed | processing |
// out_for_delivery | ready | dispensed | completed | cancelled'. The counter
// flow needs a few distinctions the enum can't make — "priced but the patient
// hasn't accepted" is still `pending`, and "sample collected" is still
// `processing`. Extending the enum would leak raw strings into the patient
// app's Order Tracking, so the coarse stage lives in the DB and the refinement
// lives here, keyed by order id.
//
// Swap this whole file for a real column if order_status ever grows those values.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@healio_indie_lab_stages';

export const STAGES = [
  { key: 'to_price',   label: 'To price',         db: 'pending'    },
  { key: 'quoted',     label: 'Quote sent',       db: 'pending'    },
  { key: 'accepted',   label: 'Quote accepted',   db: 'confirmed'  },
  { key: 'collected',  label: 'Sample collected', db: 'processing' },
  { key: 'processing', label: 'Processing',       db: 'processing' },
  { key: 'ready',      label: 'Report ready',     db: 'ready'      },
  { key: 'shared',     label: 'Report shared',    db: 'completed'  },
];

export const stageIndex = (key) => STAGES.findIndex((s) => s.key === key);
export const stageLabel = (key) => STAGES.find((s) => s.key === key)?.label || key;
export const dbStatusFor = (key) => STAGES.find((s) => s.key === key)?.db || 'pending';

let cache = null;

async function readAll() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : {};
  } catch (_) {
    cache = {};
  }
  return cache;
}

export async function getStages() {
  return { ...(await readAll()) };
}

export async function setStage(orderId, stage) {
  const all = await readAll();
  cache = { ...all, [orderId]: stage };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) {}
  return stage;
}

/**
 * Effective stage for an order: the local refinement when it is consistent with
 * what the DB says, otherwise whatever the DB status implies. The DB always
 * wins on disagreement — another device may have moved the order on.
 */
export function resolveStage(order, local) {
  const byDb = {
    pending: 'to_price',
    confirmed: 'accepted',
    processing: 'processing',
    ready: 'ready',
    completed: 'shared',
    cancelled: 'cancelled',
  }[order?.status] || 'to_price';

  if (!local) return byDb;
  const localDef = STAGES.find((s) => s.key === local);
  if (!localDef) return byDb;
  // Keep the refinement only while it still maps to the DB's current status.
  return localDef.db === order?.status ? local : byDb;
}
