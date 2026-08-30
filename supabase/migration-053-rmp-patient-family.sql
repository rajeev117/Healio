-- ============================================================
-- Migration 053 — let an RMP see a linked patient's family members.
--
-- A patient's dependents live in `family_profiles` (owner_id → profiles.id).
-- They are not accounts: no phone, no auth.uid() — migration-030 describes them
-- as "just a sub-filter the owner's app applies client-side". Every clinical
-- table therefore carries patient_id (the OWNER) plus a nullable
-- family_member_id saying which household member the row is really about.
--
-- The RMP app could not participate in that: family_profiles RLS is
-- `owner_id = auth.uid()`, so an RMP reads nothing. Consequently every booking
-- an RMP made was filed against the account holder — a visit booked for
-- someone's child became the parent's visit, and the prescriptions and records
-- generated from it inherited that same NULL family_member_id.
--
-- This SECURITY DEFINER function exposes exactly the household of a patient the
-- calling RMP has already linked (the EXISTS gate on rmp_patients is the whole
-- security model), returning only what a "who is this for?" picker needs. No
-- other column of family_profiles, and nothing at all for an unlinked patient.
--
-- Run in Supabase SQL Editor (after migration 052).
-- ============================================================

CREATE OR REPLACE FUNCTION rmp_patient_family(p_patient UUID)
RETURNS TABLE (
  id            UUID,
  name          TEXT,
  relation      TEXT,
  date_of_birth DATE,
  gender        TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.name, f.relation, f.date_of_birth, f.gender
  FROM family_profiles f
  WHERE f.owner_id = p_patient
    AND EXISTS (
      SELECT 1 FROM rmp_patients rp
       WHERE rp.rmp_id = auth.uid()
         AND rp.patient_id = p_patient
    )
  ORDER BY f.created_at;
$$;

-- Only a logged-in RMP calls this; the EXISTS gate does the real restricting.
GRANT EXECUTE ON FUNCTION rmp_patient_family(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
