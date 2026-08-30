-- ============================================================
-- Migration 010 — let doctors write prescriptions + mirror them
-- into the patient's health records.
--
-- Problems fixed:
--   1. "rx: doctor creates & reads" was FOR ALL with USING only and no
--      WITH CHECK, so INSERT was effectively denied (USING does not gate
--      INSERT — WITH CHECK does).
--   2. health_records only allowed the patient (patient_id = auth.uid())
--      to insert, so a doctor mirroring a prescription was blocked.
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Prescriptions: allow the doctor (staff row owned by this user) to INSERT.
DROP POLICY IF EXISTS "rx: doctor creates & reads" ON prescriptions;
CREATE POLICY "rx: doctor creates & reads"
  ON prescriptions FOR ALL
  USING (
    doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  )
  WITH CHECK (
    doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

-- 2. Health records: allow a doctor to insert a record for a patient that
--    belongs to the same organisation as the doctor's staff row.
DROP POLICY IF EXISTS "records: doctor writes for org patient" ON health_records;
CREATE POLICY "records: doctor writes for org patient"
  ON health_records FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM staff s
      JOIN profiles p ON p.organisation_id = s.organisation_id
      WHERE s.user_id = auth.uid()
        AND p.id = health_records.patient_id
    )
  );

NOTIFY pgrst, 'reload schema';
