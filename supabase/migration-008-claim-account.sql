-- ============================================================
-- Migration 008 — let a staff/hospital account claim its login.
-- When a hospital admin adds a staff member, a `staff` row is created
-- with email = 91<phone>@healio.app but no auth user. On the staff
-- member's first login the app creates the auth user, then calls this
-- to link the row to them (RLS would otherwise block self-linking).
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION claim_account()
RETURNS void AS $$
BEGIN
  -- Link a staff row whose email matches this user and isn't linked yet
  UPDATE staff
    SET user_id = auth.uid()
    WHERE email = (auth.jwt() ->> 'email') AND user_id IS NULL;

  -- Link an organisation (hospital admin) the same way
  UPDATE organisations
    SET admin_user_id = auth.uid()
    WHERE admin_email = (auth.jwt() ->> 'email') AND admin_user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_account() TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
