-- ============================================================
-- Migration 051 — list bookable labs & pharmacies, hospital-bound ones included.
--
-- A standalone lab/pharmacy is an `organisations` row (type 'diagnostic' /
-- 'pharmacy'), but a hospital's lab or pharmacy is not an organisation at all —
-- it is a `staff` row inside the hospital (role 'lab_technician' /
-- 'pharmacy_assistant', with `department` naming the unit, e.g. "Pathology Lab").
--
-- Those staff rows are unreadable outside the hospital: migration-003 exposes
-- only active DOCTORS publicly, and the org-colleague policy keys on my_org_id(),
-- which is null for an RMP (no staff row). So the RMP app could only ever see
-- standalone providers, and hospital labs/pharmacies were invisible.
--
-- This SECURITY DEFINER function returns both kinds as one catalog, exposing
-- nothing beyond what the hospital catalog already shows publicly: the unit's
-- name and its hospital's name/city/address. No phone, email, staff id or
-- user_id ever leaves the function.
--
-- Run in Supabase SQL Editor (after migration 050).
-- ============================================================

-- Dropped first so re-running after a signature change is safe.
DROP FUNCTION IF EXISTS rmp_service_facilities(TEXT);

CREATE FUNCTION rmp_service_facilities(p_kind TEXT)
RETURNS TABLE (
  id              TEXT,
  organisation_id UUID,
  org_name        TEXT,
  unit            TEXT,
  city            TEXT,
  address         TEXT,
  source          TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Standalone providers: the whole organisation is the facility.
  SELECT
    o.id::text        AS id,
    o.id              AS organisation_id,
    o.name            AS org_name,
    NULL::text        AS unit,
    o.city,
    o.address,
    'independent'     AS source
  FROM organisations o
  WHERE p_kind IN ('lab', 'pharmacy')
    AND o.status = 'active'
    AND o.type = (CASE WHEN p_kind = 'lab' THEN 'diagnostic' ELSE 'pharmacy' END)::org_type

  UNION ALL

  -- Hospital-bound units: one row per (hospital, department), so several
  -- technicians staffing the same lab collapse into a single bookable entry.
  SELECT
    s.organisation_id::text || ':' || COALESCE(s.department, '') AS id,
    s.organisation_id,
    o.name            AS org_name,
    COALESCE(NULLIF(s.department, ''),
             CASE WHEN p_kind = 'lab' THEN 'General Lab' ELSE 'Pharmacy' END) AS unit,
    o.city,
    o.address,
    'hospital'        AS source
  FROM staff s
  JOIN organisations o ON o.id = s.organisation_id
  WHERE p_kind IN ('lab', 'pharmacy')
    AND s.status = 'active'
    AND o.status = 'active'
    AND s.role = (CASE WHEN p_kind = 'lab' THEN 'lab_technician' ELSE 'pharmacy_assistant' END)::staff_role
  GROUP BY s.organisation_id, s.department, o.name, o.city, o.address
  ORDER BY 3, 4;
$$;

-- Catalog browsing for a logged-in RMP — same shape of data the public
-- doctor/hospital catalog already exposes.
GRANT EXECUTE ON FUNCTION rmp_service_facilities(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
