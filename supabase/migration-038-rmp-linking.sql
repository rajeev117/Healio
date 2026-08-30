-- ============================================================
-- Migration 038 — RMP ↔ patient linking (link-existing flow).
--
-- RMPs cannot create patient rows in `profiles` (profiles.id is a FK to
-- auth.users and its RLS is self-only). Instead an RMP links a patient who has
-- already registered on the Healio patient app, by phone. This migration adds
-- everything that flow needs (idempotent — safe to re-run):
--   1. rmp_patients link table + RLS so an RMP manages only their own links.
--   2. A profiles SELECT policy so an RMP can read the profiles they've linked.
--   3. rmp_find_patient_by_phone() — a SECURITY DEFINER RPC so an RMP can look
--      up a registered patient by phone (profiles RLS otherwise hides other
--      users). Only authenticated RMPs may call it.
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Link table ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rmp_patients (
  rmp_id     UUID NOT NULL REFERENCES rmps(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  language   TEXT NOT NULL DEFAULT 'English',
  linked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rmp_id, patient_id)
);

ALTER TABLE rmp_patients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rmp_patients: manage own" ON rmp_patients;
CREATE POLICY "rmp_patients: manage own"
  ON rmp_patients FOR ALL
  USING (rmp_id = auth.uid())
  WITH CHECK (rmp_id = auth.uid());

-- 2. Let an RMP read the profiles they have linked -----------------------------
DROP POLICY IF EXISTS "profiles: rmp reads linked" ON profiles;
CREATE POLICY "profiles: rmp reads linked"
  ON profiles FOR SELECT
  USING (id IN (SELECT patient_id FROM rmp_patients WHERE rmp_id = auth.uid()));

-- 3. Phone lookup for the link flow --------------------------------------------
-- SECURITY DEFINER bypasses profiles RLS for a single identity lookup. The
-- EXISTS guard ensures only a logged-in RMP can call it. Returns just the
-- fields the link UI needs; the patient's records stay gated by RLS.
CREATE OR REPLACE FUNCTION rmp_find_patient_by_phone(p_phone TEXT)
RETURNS TABLE (id UUID, name TEXT, phone TEXT, date_of_birth DATE, gender TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.phone, p.date_of_birth, p.gender
  FROM profiles p
  WHERE p.phone = p_phone
    AND EXISTS (SELECT 1 FROM rmps r WHERE r.id = auth.uid())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION rmp_find_patient_by_phone(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
