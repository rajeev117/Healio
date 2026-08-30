-- ============================================================
-- Migration 023 — safe QR check-in tokens.
--
-- The patient app shows a QR that encodes a SHORT-LIVED token (not the
-- permanent patient id). A provider scans it and resolves it to the
-- patient's id + name only. All actual medical data still flows through
-- the existing RLS (org ↔ patient relationship), so a leaked QR within
-- its 90-second window reveals nothing more than who the patient is.
--
-- Run in Supabase SQL Editor (after migration 022).
-- ============================================================

-- 1. Token store ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_qr_tokens (
  token       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_patient ON patient_qr_tokens(patient_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires ON patient_qr_tokens(expires_at);

-- Lock the table down — no direct reads/writes. Only the RPCs below touch it.
ALTER TABLE patient_qr_tokens ENABLE ROW LEVEL SECURITY;

-- 2. Issue a fresh token for the logged-in patient (rotates: prunes old ones) ──
CREATE OR REPLACE FUNCTION issue_qr_token()
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_token UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Clear this patient's previous tokens and any expired ones globally.
  DELETE FROM patient_qr_tokens WHERE patient_id = v_uid OR expires_at < NOW();

  INSERT INTO patient_qr_tokens (patient_id, expires_at)
  VALUES (v_uid, NOW() + INTERVAL '90 seconds')
  RETURNING token INTO v_token;

  RETURN v_token;
END;
$$;

-- 3. Resolve a scanned token → patient id + name (only if valid & unexpired) ──
CREATE OR REPLACE FUNCTION resolve_qr_token(p_token UUID)
RETURNS TABLE (patient_id UUID, patient_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT pr.id, pr.name
  FROM patient_qr_tokens t
  JOIN profiles pr ON pr.id = t.patient_id
  WHERE t.token = p_token
    AND t.expires_at > NOW()
  LIMIT 1;
END;
$$;

-- 4. Grants — both apps call these as the authenticated role ──────────────────
GRANT EXECUTE ON FUNCTION issue_qr_token()        TO authenticated;
GRANT EXECUTE ON FUNCTION resolve_qr_token(UUID)  TO authenticated;

NOTIFY pgrst, 'reload schema';
