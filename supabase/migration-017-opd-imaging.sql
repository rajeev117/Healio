-- ============================================================
-- Migration 017 — let OPD (and any staff) add their OWN records
-- (e.g. X-ray / imaging) on top of a patient/appointment, while
-- still NOT being able to edit a doctor's record.
--
-- Rule:
--   • Doctors + hospital admins  → create + edit ANY record (migration 016)
--   • Any staff (OPD, pharmacy)  → create their OWN records + edit only
--                                  the records they authored
--   • Adds an 'image_url' for X-ray/scan attachments + a Storage bucket.
--
-- Run in Supabase SQL Editor (after migration 016).
-- ============================================================

ALTER TABLE health_records ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Any staff member of the patient's org may CREATE a record (their own).
DROP POLICY IF EXISTS "records: staff creates" ON health_records;
CREATE POLICY "records: staff creates"
  ON health_records FOR INSERT
  WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

-- An author may EDIT only the records they created (doctors/admins already
-- have full edit via "records: clinician writes" from migration 016).
DROP POLICY IF EXISTS "records: author edits own" ON health_records;
CREATE POLICY "records: author edits own"
  ON health_records FOR UPDATE
  USING (created_by_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()))
  WITH CHECK (created_by_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

-- ── Storage bucket for X-ray / scan images ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('records', 'records', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated staff can upload; anyone can read (public bucket for image_url).
DROP POLICY IF EXISTS "records bucket: upload" ON storage.objects;
CREATE POLICY "records bucket: upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'records');

DROP POLICY IF EXISTS "records bucket: read" ON storage.objects;
CREATE POLICY "records bucket: read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'records');

NOTIFY pgrst, 'reload schema';
