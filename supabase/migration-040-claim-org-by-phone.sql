-- ============================================================
-- Migration 040 — let a hospital admin claim its org by PHONE on first login.
--
-- claim_account() (migration-008) links an organisation only by
--   admin_email = <login email>.
-- But admins log in by phone: the auth identity is 91<phone>@healio.app, while
-- organisations.admin_email holds the *contact* email the applicant typed
-- (optional — often null). approveOnboarding() copies that contact email as-is
-- and never sets admin_user_id, so the email match never fires → admin_user_id
-- stays null → resolveRole() finds nothing → "phone not registered".
--
-- Staff don't hit this because their row is created with
-- email = 91<phone>@healio.app (the login identity) and matched by email.
-- uh_id is a uique identifier for staff, but not for hospital admins. The only unique identifier for a hospital admin is the phone number, which is used to log in.
-- Fix: also link the org by phone. The login email's local-part IS the phone
-- digits (COUNTRY_CODE || phone), so compare it to admin_phone's digits. This
-- mirrors the claim-on-first-login model staff already use, keeps admin_email
-- as the real contact email, and retroactively links every already-approved
-- org on its next login attempt. No app / admin-portal change required.
--
-- Run in Supabase SQL Editor (after migration 008).
-- ============================================================

CREATE OR REPLACE FUNCTION claim_account()
RETURNS void AS $$
DECLARE
  jwt_email TEXT := (auth.jwt() ->> 'email');
BEGIN
  -- Link a staff row whose email matches this user and isn't linked yet
  UPDATE staff
    SET user_id = auth.uid()
    WHERE email = jwt_email AND user_id IS NULL;

  -- Link an organisation (hospital admin) by contact email, if it happens to match
  UPDATE organisations
    SET admin_user_id = auth.uid()
    WHERE admin_email = jwt_email AND admin_user_id IS NULL;

  -- NEW: link the organisation by PHONE. The login email's local-part is the
  -- phone digits (COUNTRY_CODE||phone), so match it against admin_phone's digits
  -- (regexp_replace normalises '+91 98765 00001' / '+919876500001' → '919876500001').
  -- Gated on admin_user_id IS NULL so it never overrides an existing link.
  UPDATE organisations
    SET admin_user_id = auth.uid()
    WHERE admin_user_id IS NULL
      AND regexp_replace(admin_phone, '\D', '', 'g') = split_part(jwt_email, '@', 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_account() TO authenticated, anon;
NOTIFY pgrst, 'reload schema';
