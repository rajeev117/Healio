-- ============================================================
-- Migration 020 — connected care flow (doctor → lab → pharmacy).
--
-- Lets a doctor/hospital push a patient to Lab or Pharmacy, and lets
-- those services report back. Adds provenance + result-note columns and
-- the RLS needed for org staff to CREATE lab/pharmacy orders.
--
-- Run in Supabase SQL Editor (after migration 019).
-- ============================================================

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE lab_orders      ADD COLUMN IF NOT EXISTS requested_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE lab_orders      ADD COLUMN IF NOT EXISTS result_note           TEXT;
ALTER TABLE lab_orders      ADD COLUMN IF NOT EXISTS appointment_id        UUID REFERENCES appointments(id) ON DELETE SET NULL;

ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS requested_by_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS dispense_note         TEXT;
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS appointment_id        UUID REFERENCES appointments(id) ON DELETE SET NULL;

-- scheduled_date / scheduled_time are NOT NULL on lab_orders; allow the
-- doctor-initiated "walk-in now" orders to default to today.
ALTER TABLE lab_orders ALTER COLUMN scheduled_date SET DEFAULT CURRENT_DATE;
ALTER TABLE lab_orders ALTER COLUMN scheduled_time SET DEFAULT 'Walk-in';

-- ── 2. RLS: org staff (doctor / admin) can CREATE + UPDATE their org's orders ─
-- lab_orders --------------------------------------------------------------
DROP POLICY IF EXISTS "lab: org staff creates" ON lab_orders;
CREATE POLICY "lab: org staff creates"
  ON lab_orders FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "lab: org staff updates" ON lab_orders;
CREATE POLICY "lab: org staff updates"
  ON lab_orders FOR UPDATE TO authenticated
  USING (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

-- pharmacy_orders ---------------------------------------------------------
DROP POLICY IF EXISTS "pharmacy: org staff creates" ON pharmacy_orders;
CREATE POLICY "pharmacy: org staff creates"
  ON pharmacy_orders FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "pharmacy: org staff updates" ON pharmacy_orders;
CREATE POLICY "pharmacy: org staff updates"
  ON pharmacy_orders FOR UPDATE TO authenticated
  USING (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

NOTIFY pgrst, 'reload schema';
