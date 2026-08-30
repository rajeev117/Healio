-- ============================================================
-- Migration 026 — image/PDF prescriptions.
--
-- Lets a doctor upload a photo/PDF of a prescription instead of typing
-- each medicine. Stored in the SAME prescriptions table the hospital uses,
-- and mirrored into health_records so the patient sees it in their app.
--
-- Run in Supabase SQL Editor (after migration 025).
-- ============================================================

ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS file_url TEXT;

NOTIFY pgrst, 'reload schema';
