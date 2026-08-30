-- ============================================================
-- Migration 045 — hospital check-in → assign doctor.
--
-- Flow: the patient scans the hospital's static QR (kind 'hospital' /
-- 'doctor'), which inserts a qr_checkins row (migration 043 — the scan is
-- the consent). The hospital's Patients tab shows checked-in patients even
-- when they have no appointments yet, and the front desk can then ASSIGN
-- a doctor — which needs an appointment INSERT the org side doesn't have:
-- appointments RLS only lets the PATIENT create, and gives org admin just
-- SELECT/UPDATE.
--
-- Rather than an RLS INSERT policy that self-references appointments
-- (recursion risk), this adds one narrow SECURITY DEFINER RPC:
--   hospital_assign_doctor(patient, doctor_staff, scheduled_at, type)
--     * caller must be org staff or the org admin;
--     * doctor must be an active doctor of the SAME org;
--     * patient must have consented: a check-in to this org in the last
--       24 h, or an existing appointment relationship with this org;
--     * inserts a confirmed walk-in appointment (fee = doctor's fee) and
--       marks the patient's open check-ins handled.
--
-- Run in Supabase SQL Editor (after migration 044).
-- ============================================================

CREATE OR REPLACE FUNCTION hospital_assign_doctor(
  p_patient      UUID,
  p_doctor_staff UUID,
  p_scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  p_type         TEXT DEFAULT 'clinic'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org  UUID;
  v_fee  NUMERIC(10,2);
  v_appt UUID;
BEGIN
  -- Caller's organisation: staff row first, org admin second.
  v_org := my_org_id();
  IF v_org IS NULL THEN
    SELECT o.id INTO v_org FROM organisations o WHERE o.admin_user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Only hospital staff can assign a doctor';
  END IF;

  -- The doctor must be an active doctor of the caller's org.
  SELECT s.consultation_fee INTO v_fee
  FROM staff s
  WHERE s.id = p_doctor_staff
    AND s.organisation_id = v_org
    AND s.role = 'doctor'
    AND s.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor not found in your hospital';
  END IF;

  -- Consent gate: a QR check-in to this org in the last 24 h, or an
  -- existing appointment relationship with this org.
  IF NOT EXISTS (
    SELECT 1 FROM qr_checkins c
    WHERE c.patient_id = p_patient
      AND c.organisation_id = v_org
      AND c.created_at > NOW() - INTERVAL '24 hours'
  ) AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.patient_id = p_patient
      AND a.organisation_id = v_org
  ) THEN
    RAISE EXCEPTION 'Patient has not checked in at your hospital';
  END IF;

  INSERT INTO appointments (
    patient_id, doctor_staff_id, organisation_id,
    type, status, scheduled_at, fee, is_walkin
  ) VALUES (
    p_patient, p_doctor_staff, v_org,
    COALESCE(p_type, 'clinic')::appointment_type,
    'in_progress',                       -- confirmed: the patient is present
    COALESCE(p_scheduled_at, NOW()),
    COALESCE(v_fee, 0),
    TRUE
  )
  RETURNING id INTO v_appt;

  -- The check-in has been acted on.
  UPDATE qr_checkins
  SET status = 'handled'
  WHERE patient_id = p_patient
    AND organisation_id = v_org
    AND status = 'new';

  RETURN v_appt;
END;
$$;

REVOKE ALL ON FUNCTION hospital_assign_doctor(UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hospital_assign_doctor(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
