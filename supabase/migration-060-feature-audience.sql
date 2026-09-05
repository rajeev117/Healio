-- ============================================================
-- Migration 060 — give every feature a ROLE, not just an app.
--
-- The admin Features screen was one flat list whose only axis was
-- `app` = patient | provider | both. With six distinct provider kinds now
-- live (hospital, individual doctor, independent lab, independent pharmacy,
-- healthcare consultant) that told an admin nothing about WHO a switch
-- affects, so nobody could tell which toggles mattered.
--
-- `audience` is that missing axis. The admin panel renders one table per
-- audience; the apps are untouched — they still look features up by `key`
-- and read `enabled`.
--
--   patient               the consumer app
--   hospital              hospital / clinic provider app
--   individual_doctor     solo practitioners (org type 'clinic')
--   independent_lab       standalone labs (org type 'diagnostic')
--   independent_pharmacy  standalone pharmacies (org type 'pharmacy')
--   rmp                   healthcare consultants
--   platform              cross-cutting rails (payments, wallet)
--
-- `category` is deliberately left alone: the patient app derives its service
-- tiles from `category = 'service'` (PlatformConfigContext), so changing it
-- would silently empty the home grid.
--
-- Run in Supabase SQL Editor (after migration 059).
-- ============================================================

ALTER TABLE features ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'patient';

-- Ordering hint so the admin tables have a stable, sensible sequence
-- instead of whatever the planner returns.
ALTER TABLE features ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;

-- ── Master switches for the standalone provider kinds ────────────────────────
-- 'individual_doctors' already exists (migration 015). These are its two
-- missing siblings: one master switch per standalone provider type, so the
-- platform can stop onboarding/serving a whole category from the admin panel.
INSERT INTO features (key, name, description, app, category, enabled) VALUES
  ('independent_labs', 'Independent Labs',
   'Allow standalone labs (not attached to a hospital) to operate and be booked',
   'both', 'product', TRUE),
  ('independent_pharmacies', 'Independent Pharmacies',
   'Allow standalone pharmacies (not attached to a hospital) to operate and be booked',
   'both', 'product', TRUE),
  ('rmp_network', 'Healthcare Consultants',
   'Allow healthcare consultants (RMPs) to log in and refer patients',
   'both', 'product', TRUE),
  ('push_notifications', 'Push Notifications',
   'Deliver admin broadcasts to devices as real push notifications',
   'both', 'system', TRUE)
ON CONFLICT (key) DO NOTHING;

-- ── Assign every key to an audience ──────────────────────────────────────────
-- Baseline from `category`, so a feature added later in the dashboard lands
-- somewhere sensible instead of defaulting to 'patient' and making a false
-- claim about who it affects:
--     product / service  ->  patient    (app-facing capabilities and tiles)
--     system             ->  platform   (rails: payments, wallet, delivery)
UPDATE features SET audience = CASE
  WHEN category = 'system' THEN 'platform'
  ELSE 'patient'
END;

-- Overrides where the baseline is wrong.

-- Categorised 'system' but they gate PATIENT ordering — the patient app maps
-- its Labs / Medicine / Home Care tiles onto exactly these three
-- (SERVICE_KILL in roles/patient/screens/Services.js).
UPDATE features SET audience = 'patient'
 WHERE key IN ('lab_orders', 'pharmacy_orders', 'home_care_booking');

-- One master switch per standalone provider kind.
UPDATE features SET audience = 'individual_doctor'    WHERE key = 'individual_doctors';
UPDATE features SET audience = 'independent_lab'      WHERE key = 'independent_labs';
UPDATE features SET audience = 'independent_pharmacy' WHERE key = 'independent_pharmacies';
UPDATE features SET audience = 'rmp'                  WHERE key = 'rmp_network';

-- Gates the payment step in the PROVIDER signup wizard (screens/Signup.js),
-- for every provider kind — so it is a platform rail, not a hospital feature.
UPDATE features SET audience = 'platform' WHERE key = 'signup_payment';

-- ── Ordering within each table ───────────────────────────────────────────────
UPDATE features SET sort_order = 10 WHERE key IN ('healio_plus', 'card_payments', 'individual_doctors', 'independent_labs', 'independent_pharmacies', 'rmp_network');
UPDATE features SET sort_order = 20 WHERE key IN ('video_calls', 'wallet_topups');
UPDATE features SET sort_order = 30 WHERE key IN ('chat', 'push_notifications');
UPDATE features SET sort_order = 40 WHERE key IN ('lab_orders', 'signup_payment');
UPDATE features SET sort_order = 50 WHERE key = 'pharmacy_orders';
UPDATE features SET sort_order = 60 WHERE key = 'home_care_booking';
-- Service tiles sort after the product switches inside the patient table.
UPDATE features SET sort_order = 100 WHERE category = 'service';

NOTIFY pgrst, 'reload schema';
