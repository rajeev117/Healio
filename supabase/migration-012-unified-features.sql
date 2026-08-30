-- ============================================================
-- Migration 012 — UNIFIED FEATURES
--
-- Replaces the three overlapping on/off systems (feature_flags,
-- kill_switches, service_categories) with ONE table: features.
--
-- Each row is one simple toggle:
--   key       — stable id the apps check, e.g. 'service_labs'
--   name      — human label shown in admin + matched by the apps
--   app       — 'patient' | 'provider' | 'both'
--   category  — 'product' | 'service' | 'system'  (grouping only)
--   enabled   — the single source of truth. ON = everyone gets it.
--
-- Pricing rules and banners are NOT here — they are values/content,
-- not on/off switches, and keep their own tables.
--
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS features (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  app         TEXT NOT NULL DEFAULT 'both',     -- patient | provider | both
  category    TEXT NOT NULL DEFAULT 'product',  -- product | service | system
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the canonical feature set. Names match what the apps already check,
-- so nothing breaks. ON CONFLICT keeps existing toggle states on re-run.
INSERT INTO features (key, name, description, app, category) VALUES
  -- Product features
  ('healio_plus',        'Healio Plus',        'Premium membership & benefits',          'both',     'product'),
  ('video_calls',        'Video Calls',        'Video consultations',                    'both',     'product'),
  ('chat',               'Chat',               'In-app messaging',                       'both',     'product'),
  -- System / subsystem switches (formerly kill switches)
  ('card_payments',      'Card Payments',      'Pay by card at checkout',                'both',     'system'),
  ('wallet_topups',      'Wallet Top-ups',     'Add money to wallet',                    'both',     'system'),
  ('lab_orders',         'Lab Orders',         'Booking lab tests',                      'patient',  'system'),
  ('pharmacy_orders',    'Pharmacy Orders',    'Ordering medicines',                     'patient',  'system'),
  ('home_care_booking',  'Home Care Booking',  'Booking home-care visits',               'patient',  'system'),
  -- Patient service tiles (formerly service_categories)
  ('service_doctors',    'Doctors',            'Doctors service tile',                   'patient',  'service'),
  ('service_hospitals',  'Hospitals',          'Hospitals service tile',                 'patient',  'service'),
  ('service_medicine',   'Medicine',           'Medicine service tile',                  'patient',  'service'),
  ('service_labs',       'Labs',               'Labs service tile',                      'patient',  'service'),
  ('service_home_care',  'Home Care',          'Home Care service tile',                 'patient',  'service'),
  ('service_emergency',  'Emergency',          'Emergency service tile',                 'patient',  'service'),
  ('service_ambulance',  'Ambulance',          'Ambulance service tile',                 'patient',  'service'),
  ('service_insurance',  'Insurance',          'Insurance service tile',                 'patient',  'service')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE features ENABLE ROW LEVEL SECURITY;

-- Apps read features (public read).
DROP POLICY IF EXISTS "features: public read" ON features;
CREATE POLICY "features: public read"
  ON features FOR SELECT
  USING (true);

-- Only the service role (admin server actions) may write.
DROP POLICY IF EXISTS "features: service role writes" ON features;
CREATE POLICY "features: service role writes"
  ON features FOR ALL
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
