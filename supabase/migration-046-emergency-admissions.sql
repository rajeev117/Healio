-- ============================================================
-- Migration 046 — RMP-initiated emergency admissions.
--
-- Flow: a Healthcare Consultant (RMP) managing a linked patient raises an
-- EMERGENCY ADMISSION to a chosen hospital (+ optional doctor). The hospital
-- app rings like an alarm (blink + vibrate) and must ACCEPT within 5 minutes,
-- else the request expires and the RMP is told to try another hospital.
--
-- Design notes:
--   * patient_name / patient_phone / rmp_name are DENORMALISED into the row:
--     rmps is self-read-only and profiles is RLS-gated, so the hospital alert
--     can render from a plain `select *` with no join headaches. The RMP
--     raising the admission for their own linked patient is the consent.
--   * No cron for expiry — expires_at rides on the row and both apps treat
--     an unanswered request past it as expired (hospital marks it lazily).
--   * A pending/accepted admission also makes the patient's PROFILE visible
--     to the org (same pattern as migration 043's check-ins) so the patient
--     shows up in the hospital's Patients tab after acceptance.
--
-- Run in Supabase SQL Editor (after migration 045).
-- ============================================================

-- 1. Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS emergency_admissions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rmp_id           UUID NOT NULL REFERENCES rmps(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  doctor_staff_id  UUID REFERENCES staff(id) ON DELETE SET NULL,

  -- Denormalised identity so the hospital alert renders without joins.
  patient_name     TEXT,
  patient_phone    TEXT,
  rmp_name         TEXT,

  triage           TEXT NOT NULL DEFAULT 'critical'
                     CHECK (triage IN ('critical', 'urgent', 'stable')),
  complaint        TEXT,
  notes            TEXT,

  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  responded_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test          BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_emadm_org     ON emergency_admissions(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emadm_rmp     ON emergency_admissions(rmp_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emadm_patient ON emergency_admissions(patient_id);

ALTER TABLE emergency_admissions ENABLE ROW LEVEL SECURITY;

-- 2. RLS ───────────────────────────────────────────────────────────────────────
-- RMP raises admissions only for patients THEY have linked, as themselves.
DROP POLICY IF EXISTS "emadm: rmp creates for linked patient" ON emergency_admissions;
CREATE POLICY "emadm: rmp creates for linked patient"
  ON emergency_admissions FOR INSERT
  WITH CHECK (
    rmp_id = auth.uid()
    AND patient_id IN (SELECT patient_id FROM rmp_patients WHERE rmp_id = auth.uid())
  );

DROP POLICY IF EXISTS "emadm: rmp reads own" ON emergency_admissions;
CREATE POLICY "emadm: rmp reads own"
  ON emergency_admissions FOR SELECT
  USING (rmp_id = auth.uid());

-- Patient can see admissions raised for them.
DROP POLICY IF EXISTS "emadm: patient reads own" ON emergency_admissions;
CREATE POLICY "emadm: patient reads own"
  ON emergency_admissions FOR SELECT
  USING (patient_id = auth.uid());

-- Org staff or the org admin read + respond (accept / decline / expire).
DROP POLICY IF EXISTS "emadm: org reads" ON emergency_admissions;
CREATE POLICY "emadm: org reads"
  ON emergency_admissions FOR SELECT
  USING (
    organisation_id = my_org_id()
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "emadm: org responds" ON emergency_admissions;
CREATE POLICY "emadm: org responds"
  ON emergency_admissions FOR UPDATE
  USING (
    organisation_id = my_org_id()
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

-- 3. An admission exposes the patient's IDENTITY to that org ──────────────────
-- (RLS is permissive/OR-ed — this only ADDS read access, like migration 043.)
DROP POLICY IF EXISTS "profiles: emergency admission visible to org" ON profiles;
CREATE POLICY "profiles: emergency admission visible to org"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM emergency_admissions e
      WHERE e.patient_id = profiles.id
        AND (
          e.organisation_id = my_org_id()
          OR e.organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
        )
    )
  );

-- 4. Realtime: hospital apps get live "emergency incoming" events ──────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE emergency_admissions;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- already in the publication
  WHEN undefined_object THEN NULL;   -- publication managed differently
END $$;

NOTIFY pgrst, 'reload schema';
