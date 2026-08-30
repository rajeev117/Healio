-- ============================================================
-- Migration 029 — extra profile fields for patient app
--
-- Adds height, weight, emergency contact, and city so the
-- patient app can save and display these from Profile / ProfileSetup.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS height         NUMERIC(5,1),          -- cm
  ADD COLUMN IF NOT EXISTS weight         NUMERIC(5,1),          -- kg
  ADD COLUMN IF NOT EXISTS city           TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact      TEXT,          -- phone number
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;

NOTIFY pgrst, 'reload schema';
