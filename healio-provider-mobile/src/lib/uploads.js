// Upload a file (X-ray image or a PDF report) picked from the device to the
// public Supabase Storage bucket 'records' and return its public URL.
import { supabase } from './supabase';
import { uploadLocalFile } from './storage';

// localUri: file:// path; mimeType + ext are optional hints.
export async function uploadRecordFile(localUri, patientId, mimeType, extHint) {
  const ext = (extHint || localUri.split('.').pop() || 'bin').split('?')[0].toLowerCase();
  const path = `${patientId || 'misc'}/${Date.now()}.${ext}`;

  await uploadLocalFile('records', path, localUri, mimeType || 'application/octet-stream', { upsert: false });

  const { data } = supabase.storage.from('records').getPublicUrl(path);
  return data.publicUrl;
}

// Back-compat helper for images.
export async function uploadRecordImage(localUri, patientId) {
  const ext = (localUri.split('.').pop() || 'jpg').split('?')[0].toLowerCase();
  return uploadRecordFile(localUri, patientId, `image/${ext}`, ext);
}
