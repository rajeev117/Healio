-- ============================================================
-- Migration 043 — patient-initiated QR check-ins.
--
-- Flow: a provider (hospital / doctor / lab / pharmacy) shows a static
-- `healio:<kind>:<id>` QR. The PATIENT scans it and "checks in" — that scan
-- is explicit consent to share:
--   * hospital / doctor  → the patient's identity (name, phone, age) so the
--     front desk / doctor can admit or attend them;
--   * lab / pharmacy     → the patient's prescriptions so the technician /
--     assistant can fulfil them.
--
-- Pieces:
--   1. qr_checkins table + RLS (patient writes own; org staff/admin read
--      + update their org's).
--   2. profiles read policy: a check-in makes the patient's identity visible
--      to that organisation's staff/admin (nothing else).
--   3. resolve_provider_qr v2 — adds kind 'doctor' (staff row) and returns
--      org_id so the app knows which organisation to check into.
--      (return type changes → DROP + CREATE.)
--   4. checkin_prescriptions(patient) — SECURITY DEFINER: if (and only if)
--      the patient checked into the caller's org in the last 24h, return
--      their prescriptions with doctor + hospital names, sorted by
--      doctor name → hospital name → newest first.
--
-- NOTE: my_org_id() only resolves staff rows; hospital ADMINS own the org via
-- organisations.admin_user_id and have no staff row, so every org-side check
-- here is "staff OR admin".
--
-- Run in Supabase SQL Editor (after migration 042).
-- ============================================================

-- 1. Check-ins table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qr_checkins (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  doctor_staff_id  UUID REFERENCES staff(id) ON DELETE SET NULL,  -- only for kind 'doctor'
  kind             TEXT NOT NULL CHECK (kind IN ('hospital', 'doctor', 'lab', 'pharmacy')),
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'handled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test          BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_checkins_org     ON qr_checkins(organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_patient ON qr_checkins(patient_id);
CREATE INDEX IF NOT EXISTS idx_checkins_doctor  ON qr_checkins(doctor_staff_id);

ALTER TABLE qr_checkins ENABLE ROW LEVEL SECURITY;

-- Patient creates their own check-in (the scan) and can see their history.
DROP POLICY IF EXISTS "checkins: patient creates" ON qr_checkins;
CREATE POLICY "checkins: patient creates"
  ON qr_checkins FOR INSERT
  WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS "checkins: patient reads own" ON qr_checkins;
CREATE POLICY "checkins: patient reads own"
  ON qr_checkins FOR SELECT
  USING (patient_id = auth.uid());

-- Org staff (lab tech, pharmacy assistant, doctor, opd…) or the org admin
-- read + update (mark handled) their organisation's check-ins.
DROP POLICY IF EXISTS "checkins: org reads" ON qr_checkins;
CREATE POLICY "checkins: org reads"
  ON qr_checkins FOR SELECT
  USING (
    organisation_id = my_org_id()
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "checkins: org updates" ON qr_checkins;
CREATE POLICY "checkins: org updates"
  ON qr_checkins FOR UPDATE
  USING (
    organisation_id = my_org_id()
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

-- 2. A check-in exposes the patient's IDENTITY to that org ───────────────────
-- (RLS is permissive/OR-ed, so this only ADDS read access to profiles.)
DROP POLICY IF EXISTS "profiles: checked-in patient visible to org" ON profiles;
CREATE POLICY "profiles: checked-in patient visible to org"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM qr_checkins c
      WHERE c.patient_id = profiles.id
        AND (
          c.organisation_id = my_org_id()
          OR c.organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
        )
    )
  );

-- 3. resolve_provider_qr v2 — adds 'doctor' + org_id ─────────────────────────
DROP FUNCTION IF EXISTS resolve_provider_qr(TEXT, UUID);
CREATE OR REPLACE FUNCTION resolve_provider_qr(p_kind TEXT, p_id UUID)
RETURNS TABLE (id UUID, kind TEXT, name TEXT, subtitle TEXT, org_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- hospital / lab / pharmacy resolve to the organisation
  SELECT o.id, p_kind, o.name, o.city, o.id
  FROM organisations o
  WHERE p_kind IN ('hospital', 'lab', 'pharmacy')
    AND o.id = p_id
    AND o.status = 'active'

  UNION ALL

  -- doctor resolves to the staff row (+ their organisation)
  SELECT s.id, 'doctor', s.name, o.name, s.organisation_id
  FROM staff s
  JOIN organisations o ON o.id = s.organisation_id
  WHERE p_kind = 'doctor'
    AND s.id = p_id
    AND s.role = 'doctor'
    AND s.status = 'active'

  UNION ALL

  -- RMP resolves to the rmps row (no organisation)
  SELECT r.id, 'rmp', r.name, r.village, NULL::UUID
  FROM rmps r
  WHERE p_kind = 'rmp'
    AND r.id = p_id
    AND r.status = 'active'

  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION resolve_provider_qr(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_provider_qr(TEXT, UUID) TO authenticated;

-- 4. Prescriptions for a checked-in patient ──────────────────────────────────
-- Narrow definer read: only returns rows when the patient has checked into
-- the CALLER's organisation within the last 24 hours (the scan is the
-- consent, and it expires). Sorted doctor name → hospital name → newest.
CREATE OR REPLACE FUNCTION checkin_prescriptions(p_patient UUID)
RETURNS TABLE (
  id UUID, file_url TEXT, medicines JSONB, instructions TEXT,
  created_at TIMESTAMPTZ, doctor_name TEXT, hospital_name TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org UUID;
BEGIN
  -- Caller's organisation: staff row first, org admin second.
  v_org := my_org_id();
  IF v_org IS NULL THEN
    SELECT o.id INTO v_org FROM organisations o WHERE o.admin_user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_org IS NULL THEN
    RETURN;  -- caller is not provider-side staff/admin
  END IF;

  -- Consent gate: a check-in to this org in the last 24h.
  IF NOT EXISTS (
    SELECT 1 FROM qr_checkins c
    WHERE c.patient_id = p_patient
      AND c.organisation_id = v_org
      AND c.created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.file_url, p.medicines, p.instructions, p.created_at,
         COALESCE(st.name, 'Doctor')      AS doctor_name,
         COALESCE(o.name,  'Hospital')    AS hospital_name
  FROM prescriptions p
  LEFT JOIN staff st        ON st.id = p.doctor_staff_id
  LEFT JOIN organisations o ON o.id  = p.organisation_id
  WHERE p.patient_id = p_patient
  -- Ordinals, not names: "doctor_name"/"hospital_name" are ALSO the OUT
  -- parameters, and plpgsql raises "column reference is ambiguous" for them.
  ORDER BY 6 ASC, 7 ASC, 5 DESC;   -- doctor → hospital → newest first
END;
$$;

REVOKE ALL ON FUNCTION checkin_prescriptions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION checkin_prescriptions(UUID) TO authenticated;

-- 5. Realtime: let provider apps get live "patient just scanned" events ──────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE qr_checkins;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- already in the publication
  WHEN undefined_object THEN NULL;   -- publication managed differently
END $$;

NOTIFY pgrst, 'reload schema';
