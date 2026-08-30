-- ============================================================
-- Migration 044 — resolve_qr_token returns basic details.
--
-- The hospital Admissions tab now scans the patient's short-lived QR to
-- pre-fill an emergency admission. Handing over the code IS the consent
-- (same model as migration 043's check-ins), so the resolve now returns
-- the patient's BASIC identity — phone, DOB, gender, blood group —
-- alongside id + name. The token is still 90-second single-patient
-- (migration 023) and all medical records stay gated by existing RLS.
--
-- Return type changes → DROP + CREATE (as 043 did for resolve_provider_qr).
--
-- Run in Supabase SQL Editor (after migration 043).
-- ============================================================

DROP FUNCTION IF EXISTS resolve_qr_token(UUID);

CREATE OR REPLACE FUNCTION resolve_qr_token(p_token UUID)
RETURNS TABLE (
  patient_id    UUID,
  patient_name  TEXT,
  phone         TEXT,
  date_of_birth DATE,
  gender        TEXT,
  blood_group   TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT pr.id, pr.name, pr.phone, pr.date_of_birth, pr.gender, pr.blood_group
  FROM patient_qr_tokens t
  JOIN profiles pr ON pr.id = t.patient_id
  WHERE t.token = p_token
    AND t.expires_at > NOW()
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION resolve_qr_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_qr_token(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
