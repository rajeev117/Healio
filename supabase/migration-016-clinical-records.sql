-- ============================================================
-- Migration 016 — clinical records.
--
-- Doctors and hospital admins CREATE and EDIT a patient's clinical
-- records (diagnosis, vitals, notes). OPD and pharmacy assistants
-- CANNOT edit those records — but anyone on staff can APPEND a note
-- on top of a record or an appointment (read-only annotations).
--
-- Run in Supabase SQL Editor (after migration 010).
-- ============================================================

-- 1. Enrich health_records with clinical fields + provenance.
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS organisation_id    UUID REFERENCES organisations(id) ON DELETE SET NULL;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS appointment_id     UUID REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS created_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS created_by_role    TEXT;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS diagnosis          TEXT;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS vitals             JSONB DEFAULT '{}'::jsonb;
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Append-only notes (OPD / pharmacy / anyone on staff).
CREATE TABLE IF NOT EXISTS record_notes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id        UUID REFERENCES health_records(id) ON DELETE CASCADE,
  appointment_id   UUID REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organisation_id  UUID REFERENCES organisations(id) ON DELETE SET NULL,
  author_staff_id  UUID REFERENCES staff(id) ON DELETE SET NULL,
  author_name      TEXT,
  author_role      TEXT,
  note             TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_record_notes_record  ON record_notes(record_id);
CREATE INDEX IF NOT EXISTS idx_record_notes_patient ON record_notes(patient_id);

-- ── Helper predicates as inline policy expressions ──────────────────────────

-- 3. health_records: doctors + hospital admins write for patients in their org.
DROP POLICY IF EXISTS "records: clinician writes" ON health_records;
CREATE POLICY "records: clinician writes"
  ON health_records FOR ALL
  USING (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid() AND role = 'doctor')
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  )
  WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid() AND role = 'doctor')
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

-- 4. health_records: any org staff (incl. OPD/pharmacy) can READ org patients' records.
DROP POLICY IF EXISTS "records: org staff reads" ON health_records;
CREATE POLICY "records: org staff reads"
  ON health_records FOR SELECT
  USING (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

-- 5. record_notes RLS — append + read for org staff and the patient.
ALTER TABLE record_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes: org staff appends" ON record_notes;
CREATE POLICY "notes: org staff appends"
  ON record_notes FOR INSERT
  WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "notes: org staff + patient read" ON record_notes;
CREATE POLICY "notes: org staff + patient read"
  ON record_notes FOR SELECT
  USING (
    patient_id = auth.uid()
    OR organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "notes: service role all" ON record_notes;
CREATE POLICY "notes: service role all"
  ON record_notes FOR ALL
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
