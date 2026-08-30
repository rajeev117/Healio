-- ============================================================
-- Migration 032 — fix the pre-login "is this phone registered?" check.
--
-- healio-provider-mobile's Login.js calls phoneExistsInDB() BEFORE the user
-- has an authenticated session, doing a plain SELECT against staff/
-- organisations. But staff has no RLS policy that allows reads without an
-- already-matching session (schema.sql: "staff: reads own profile" needs
-- user_id = auth.uid(); "staff: reads org colleagues" needs my_org_id(),
-- which itself needs an existing staff row for auth.uid()). On a genuinely
-- fresh login (new device, or after sign-out) auth.uid() is null, so RLS
-- silently returns zero rows — phoneExistsInDB() always reports "not
-- registered", blocking login for EVERY role, most visibly for staff who
-- are logging in for the very first time (freshly-added lab technicians /
-- pharmacy assistants).
--
-- Fix: a SECURITY DEFINER RPC (same pattern as claim_account() in
-- migration-008) that bypasses RLS to do this one narrow, harmless check —
-- "does a staff/org row with this phone exist" — without exposing any other
-- column.
--
-- Run in Supabase SQL Editor (after migration 031).
-- ============================================================

CREATE OR REPLACE FUNCTION phone_registered(p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM staff WHERE phone = p_phone)
      OR EXISTS (SELECT 1 FROM organisations WHERE admin_phone = p_phone);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION phone_registered(TEXT) TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
