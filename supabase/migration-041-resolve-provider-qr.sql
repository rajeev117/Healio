-- ============================================================
-- Migration 041 — resolve a scanned PROVIDER QR to a public identity.
--
-- Providers (hospital / lab / pharmacy / RMP) each show a static "My QR"
-- code encoding their primary id: `healio:<kind>:<id>`. The PATIENT app
-- scans it and calls this to turn <kind>+<id> into a small, public display
-- record so it can pull up that provider.
--
-- Mirrors resolve_qr_token (migration-023) / rmp_find_patient_by_phone
-- (migration-038): a narrow SECURITY DEFINER lookup that returns ONLY public
-- catalog fields. No medical data is exposed — everything else stays behind
-- the existing RLS.
--
-- Why a definer function (not a plain client query):
--   * organisations are already public-readable when status='active'
--     (migration-003), so hospital/lab/pharmacy could be read directly…
--   * …but `rmps` has NO public read policy (only "read own"), so a patient
--     cannot select another RMP's row. This function bypasses that for a
--     single, minimal identity lookup.
--
-- Run in Supabase SQL Editor (after migration 020 / 037).
-- ============================================================

CREATE OR REPLACE FUNCTION resolve_provider_qr(p_kind TEXT, p_id UUID)
RETURNS TABLE (id UUID, kind TEXT, name TEXT, subtitle TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- hospital / lab / pharmacy all resolve to the organisation (department-level id)
  SELECT o.id, p_kind, o.name, o.city
  FROM organisations o
  WHERE p_kind IN ('hospital', 'lab', 'pharmacy')
    AND o.id = p_id
    AND o.status = 'active'

  UNION ALL

  -- RMP resolves to the rmps row
  SELECT r.id, 'rmp', r.name, r.village
  FROM rmps r
  WHERE p_kind = 'rmp'
    AND r.id = p_id
    AND r.status = 'active'

  LIMIT 1;
$$;

-- Postgres grants EXECUTE to PUBLIC by default, which would let *anon*
-- (unauthenticated) callers run this SECURITY DEFINER function and read active
-- RMP names/villages (not otherwise public). Revoke that, then grant to the
-- logged-in role only — the patient app calls this as `authenticated`.
REVOKE ALL ON FUNCTION resolve_provider_qr(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION resolve_provider_qr(TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
