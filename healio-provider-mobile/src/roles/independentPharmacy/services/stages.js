// ─────────────────────────────────────────────────────────────────────────────
// Fine-grained pharmacy stages.
//
// order_status (schema.sql:41-44) already covers most of the counter flow —
// out_for_delivery and dispensed both exist — but it cannot distinguish "priced,
// waiting on the patient" from "not priced yet"; both are `pending`. Extending
// the enum would leak raw strings into the patient app's Order Tracking, so the
// coarse stage lives in the DB and the refinement lives here.
// ─────────────────────────────────────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@healio_indie_pharmacy_stages';

export const STAGES = [
  { key: 'to_quote',    label: 'To quote',        db: 'pending'          },
  { key: 'quoted',      label: 'Quote sent',      db: 'pending'          },
  { key: 'accepted',    label: 'Patient paid',    db: 'confirmed'        },
  { key: 'packing',     label: 'Packing',         db: 'processing'       },
  { key: 'out',         label: 'Out for delivery', db: 'out_for_delivery' },
  { key: 'handed_over', label: 'Handed over',     db: 'dispensed'        },
  { key: 'closed',      label: 'Closed',          db: 'completed'        },
];

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

/** DB status wins on disagreement — another device may have moved the order on. */
export function resolveStage(order, local) {
  const byDb = {
    pending: 'to_quote',
    confirmed: 'accepted',
    processing: 'packing',
    out_for_delivery: 'out',
    dispensed: 'handed_over',
    completed: 'closed',
    cancelled: 'cancelled',
  }[order?.status] || 'to_quote';

  if (!local) return byDb;
  const localDef = STAGES.find((s) => s.key === local);
  if (!localDef) return byDb;
  return localDef.db === order?.status ? local : byDb;
}
