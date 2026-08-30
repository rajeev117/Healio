-- ============================================================
-- Migration 054 — doctor public-profile fields.
--
-- The fields a doctor maintains about themselves and patients see on the
-- booking page. Ported from the individual-doctor module (which numbered this
-- 047 in its own project); only the doctor-profile half is taken here — that
-- module's 047 also reworked health_records RLS and the patient app's
-- allergies section, neither of which belongs to this integration.
--
--   experience_years — years of practice
--   qualifications   — e.g. "MBBS, MD (Cardiology)"
--   bio              — the "About" paragraph
--   services         — JSONB array of what they check/treat,
--                      e.g. ["Diabetes", "Blood pressure", "Thyroid"]
--
-- Applies to every doctor, hospital-affiliated or individual. The individual
-- doctor is the only one who can currently edit them from the provider app
-- (Profile → Edit Public Profile), which needs the RLS policy below.
--
-- Run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS experience_years INTEGER,
  ADD COLUMN IF NOT EXISTS qualifications   TEXT,
  ADD COLUMN IF NOT EXISTS bio              TEXT,
  ADD COLUMN IF NOT EXISTS services         JSONB NOT NULL DEFAULT '[]'::jsonb;

-- A staff member may update their own row (linked via user_id), so a doctor
-- can maintain their public profile from the app.
DROP POLICY IF EXISTS "staff: updates own profile" ON staff;
CREATE POLICY "staff: updates own profile"
  ON staff FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
