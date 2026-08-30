-- ============================================================
-- Migration 055 — lab-test catalog.
--
-- The tests a doctor can order and a patient can book, with real prices.
--   organisation_id NULL  → platform default catalog (seeded below)
--   organisation_id set   → that organisation's own catalog (overrides defaults)
--
-- The individual doctor's Refer screen reads the platform defaults; a lab that
-- maintains its own list overrides them for its own orders. Ported from the
-- individual-doctor module (numbered 048 there); that module's version also
-- switched off the Home Care and Insurance service tiles in the patient app —
-- deliberately left out, it is unrelated to this integration and this project
-- has those tiles on.
--
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS lab_tests (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID REFERENCES organisations(id) ON DELETE CASCADE,  -- NULL = platform default
  name             TEXT NOT NULL,
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  turnaround       TEXT,             -- e.g. '6 hours'
  popular          BOOLEAN NOT NULL DEFAULT FALSE,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_tests_org ON lab_tests(organisation_id);

ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lab_tests: public read" ON lab_tests;
CREATE POLICY "lab_tests: public read"
  ON lab_tests FOR SELECT
  USING (enabled = true);

DROP POLICY IF EXISTS "lab_tests: service role writes" ON lab_tests;
CREATE POLICY "lab_tests: service role writes"
  ON lab_tests FOR ALL
  USING (auth.role() = 'service_role');

-- Organisations manage their own catalog from the provider app
DROP POLICY IF EXISTS "lab_tests: org manages own" ON lab_tests;
CREATE POLICY "lab_tests: org manages own"
  ON lab_tests FOR ALL
  USING (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  )
  WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

-- Seed the platform default catalog
INSERT INTO lab_tests (organisation_id, name, price, turnaround, popular)
SELECT NULL, t.name, t.price, t.turnaround, t.popular
FROM (VALUES
  ('Complete Blood Count (CBC)',    150, '6 hours',  true),
  ('Thyroid Profile (T3, T4, TSH)', 350, '12 hours', true),
  ('Lipid Profile',                 280, '6 hours',  true),
  ('HbA1c (Diabetes)',              320, '6 hours',  true),
  ('Liver Function Test (LFT)',     400, '12 hours', false),
  ('Kidney Function Test (KFT)',    380, '12 hours', false),
  ('Vitamin D',                     450, '24 hours', false),
  ('Vitamin B12',                   380, '24 hours', false),
  ('COVID Antigen',                 200, '1 hour',   false),
  ('Urine Routine & Microscopy',    120, '3 hours',  false)
) AS t(name, price, turnaround, popular)
WHERE NOT EXISTS (SELECT 1 FROM lab_tests WHERE organisation_id IS NULL);

NOTIFY pgrst, 'reload schema';
