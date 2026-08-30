-- ============================================================
-- Migration 052 — "is this number already registered, and as what?"
--
-- Two bugs this fixes:
--
--   1. SIGN-UP silently hijacked existing accounts. The app derives one auth
--      email per phone (<cc><digits>@healio.app) with a shared dev password, so
--      "sign in, create if missing" SIGNS IN to whatever account that phone
--      already has. Registering a number that belonged to a doctor or a patient
--      logged into their account and stacked a new role row on top instead of
--      refusing. Signup now needs to know a number is taken BEFORE it touches
--      auth.
--
--   2. SIGN-IN only discovered "not registered" AFTER the OTP screen, because
--      the pre-OTP check couldn't see anything: phone_registered() (migration
--      032) looks only at staff + organisations.admin_phone, so RMPs and
--      patients always came back "not registered" and the check was abandoned.
--
-- phone_account_kind() answers both, across every identity table, in the same
-- precedence resolveRole() uses (staff → org admin → rmp → patient). It is
-- SECURITY DEFINER because none of those tables are readable before a session
-- exists, and it returns ONLY a coarse role bucket — never a name, id, or any
-- other column.
--
-- Matching is on the last 10 digits so '+919876543210', '919876543210' and
-- '9876543210' are all the same number, whatever a given screen stored.
--
-- Note: this necessarily lets an unauthenticated caller learn whether a number
-- is registered and roughly as what — inherent to a "number already registered"
-- message. Supabase's per-IP rate limits apply; tighten with a captcha or an
-- authenticated-only variant if that probe ever matters.
--
-- Run in Supabase SQL Editor (after migration 051).
-- ============================================================

CREATE OR REPLACE FUNCTION phone_account_kind(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d TEXT := right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10);
  r staff_role;
BEGIN
  -- Anything shorter than a full national number can't identify an account.
  IF length(d) < 10 THEN
    RETURN NULL;
  END IF;

  SELECT s.role INTO r
    FROM staff s
   WHERE right(regexp_replace(COALESCE(s.phone, ''), '\D', '', 'g'), 10) = d
   LIMIT 1;
  IF FOUND THEN
    RETURN CASE WHEN r = 'doctor' THEN 'doctor' ELSE 'staff' END;
  END IF;

  PERFORM 1 FROM organisations o
   WHERE right(regexp_replace(COALESCE(o.admin_phone, ''), '\D', '', 'g'), 10) = d
   LIMIT 1;
  IF FOUND THEN
    RETURN 'provider';
  END IF;

  PERFORM 1 FROM rmps m
   WHERE right(regexp_replace(COALESCE(m.phone, ''), '\D', '', 'g'), 10) = d
   LIMIT 1;
  IF FOUND THEN
    RETURN 'rmp';
  END IF;

  PERFORM 1 FROM profiles p
   WHERE right(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) = d
   LIMIT 1;
  IF FOUND THEN
    RETURN 'patient';
  END IF;

  RETURN NULL;
END;
$$;

-- Login runs before a session exists, so anon must be able to call it.
GRANT EXECUTE ON FUNCTION phone_account_kind(TEXT) TO authenticated, anon;

-- Keep the older boolean check (migration-032) as a thin alias so it inherits
-- the wider table coverage and the digit normalisation.
CREATE OR REPLACE FUNCTION phone_registered(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone_account_kind(p_phone) IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION phone_registered(TEXT) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
