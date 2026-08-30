// ─────────────────────────────────────────────────────────────────────────────
// Supabase Storage upload helper that works on React Native / Hermes.
//
// The obvious approach — `await (await fetch(localUri)).blob()` then
// `supabase.storage.upload(blob)` — throws on native:
//   "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported"
// because RN can't read a Blob as an ArrayBuffer. Instead we read the file as
// base64 (expo-file-system) and upload the raw bytes as a Uint8Array, which
// supabase-js sends directly as the request body — no Blob is ever created.
// ─────────────────────────────────────────────────────────────────────────────
import * as FileSystem from 'expo-file-system/legacy'; // readAsStringAsync lives here in SDK 56
import { supabase } from './supabase';

function base64ToBytes(b64) {
  if (typeof atob === 'function') {            // Hermes (RN 0.85) provides atob
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  // Dependency-free fallback decoder (no base64-arraybuffer needed).
  const T = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const s = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array((s.length * 3) >> 2);
  let p = 0, buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    buf = (buf << 6) | T.indexOf(s[i]); bits += 6;
    if (bits >= 8) { bits -= 8; out[p++] = (buf >> bits) & 0xff; }
  }
  return out;
}

// Upload a local file:// (or content://) URI to a Storage bucket.
// Throws on failure; resolves with no value on success.
export async function uploadLocalFile(bucket, path, uri, contentType, { upsert = false } = {}) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, base64ToBytes(base64), { contentType, upsert });
  if (error) throw error;
}
