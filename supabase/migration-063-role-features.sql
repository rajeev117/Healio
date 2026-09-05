-- ============================================================
-- Migration 063 — per-role feature switches.
--
-- After migration 060 the admin Features screen groups switches by role, but
-- the grouping exposed how lopsided the catalogue actually is: of the 19
-- features on this project, ~15 are patient-facing, hospitals have none at all,
-- and each standalone provider kind has exactly one master kill switch. So
-- "turn this role's features on and off" was not really possible.
--
-- This adds the missing ones. Every key here maps to a capability that already
-- exists in healio-provider-mobile and is enforced at the ROUTE level via
-- withFeature() (src/components/FeatureGate.js) — so a switch that is off
-- genuinely closes the screen, from every entry point, not just the one button
-- we remembered to hide.
--
-- All seeded ENABLED, so applying this changes nothing about how the apps
-- behave until someone deliberately turns a switch off.
--
-- `category` stays 'product' throughout: the patient app derives its service
-- tiles from category = 'service' and its kill switches from 'system', and a
-- provider capability is neither.
--
-- Run in Supabase SQL Editor (after migration 062).
-- ============================================================

INSERT INTO features (key, name, description, app, category, audience, sort_order, enabled) VALUES

  -- ── Hospitals & clinics ──────────────────────────────────────────────────
  ('hospital_qr_checkin', 'QR Check-in',
   'Patients check in by scanning the hospital QR, and staff can scan a patient QR',
   'provider', 'product', 'hospital', 10, TRUE),
  ('hospital_staff_management', 'Staff Management',
   'Add, edit and deactivate doctors and assistants from the hospital app',
   'provider', 'product', 'hospital', 20, TRUE),
  ('hospital_ledger', 'Ledger & Payouts',
   'Hospital-side ledger, earnings and settlement history',
   'provider', 'product', 'hospital', 30, TRUE),
  ('hospital_reports', 'Reports',
   'Operational and financial reports in the hospital app',
   'provider', 'product', 'hospital', 40, TRUE),
  ('hospital_emergency_admissions', 'Emergency Admissions',
   'Receive and act on emergency admission alerts from consultants',
   'provider', 'product', 'hospital', 50, TRUE),

  -- ── Individual doctors ───────────────────────────────────────────────────
  ('doctor_qr', 'Doctor QR Code',
   'A shareable QR patients scan to book with this doctor directly',
   'provider', 'product', 'individual_doctor', 20, TRUE),
  ('doctor_referrals', 'Referrals',
   'Refer a patient on to a hospital, lab or pharmacy',
   'provider', 'product', 'individual_doctor', 30, TRUE),
  ('doctor_schedule', 'Schedule Management',
   'Set consulting days, session times and slots',
   'provider', 'product', 'individual_doctor', 40, TRUE),
  ('doctor_prescription_upload', 'Prescription Upload',
   'Attach a written or photographed prescription to a completed appointment',
   'provider', 'product', 'individual_doctor', 50, TRUE),

  -- ── Independent labs ─────────────────────────────────────────────────────
  ('lab_walkin_scan', 'Walk-in QR Scan',
   'Scan a walk-in patient QR to attach an order to their record',
   'provider', 'product', 'independent_lab', 20, TRUE),
  ('lab_test_catalog', 'Test Catalogue & Pricing',
   'Maintain the lab test list and its prices',
   'provider', 'product', 'independent_lab', 30, TRUE),
  ('lab_sample_reports', 'Sample Reports',
   'Upload result PDFs against a completed lab order',
   'provider', 'product', 'independent_lab', 40, TRUE),
  ('lab_order_quotes', 'Order Requests & Quotes',
   'Receive test requests and respond with a price quote',
   'provider', 'product', 'independent_lab', 50, TRUE),
  ('lab_payouts', 'Earnings & Payouts',
   'Lab-side earnings and settlement history',
   'provider', 'product', 'independent_lab', 60, TRUE),

  -- ── Independent pharmacies ───────────────────────────────────────────────
  ('pharmacy_walkin_scan', 'Walk-in QR Scan',
   'Scan a walk-in patient QR to attach an order to their record',
   'provider', 'product', 'independent_pharmacy', 20, TRUE),
  ('pharmacy_inventory', 'Inventory & Stock',
   'Maintain the medicine list, stock levels and prices',
   'provider', 'product', 'independent_pharmacy', 30, TRUE),
  ('pharmacy_fulfilment', 'Order Fulfilment',
   'Pick, pack and dispense flow for an accepted order',
   'provider', 'product', 'independent_pharmacy', 40, TRUE),
  ('pharmacy_order_quotes', 'Order Requests & Quotes',
   'Receive medicine requests and respond with a price quote',
   'provider', 'product', 'independent_pharmacy', 50, TRUE),
  ('pharmacy_payouts', 'Earnings & Payouts',
   'Pharmacy-side earnings and settlement history',
   'provider', 'product', 'independent_pharmacy', 60, TRUE),

  -- ── Healthcare consultants (RMPs) ────────────────────────────────────────
  ('rmp_patient_linking', 'Patient Linking',
   'Link a patient to this consultant with their consent, and manage them',
   'provider', 'product', 'rmp', 20, TRUE),
  ('rmp_lab_booking', 'Lab Booking',
   'Book lab tests on behalf of a linked patient',
   'provider', 'product', 'rmp', 30, TRUE),
  ('rmp_pharmacy_orders', 'Pharmacy Orders',
   'Raise medicine orders on behalf of a linked patient',
   'provider', 'product', 'rmp', 40, TRUE),
  ('rmp_emergency_admission', 'Emergency Admission',
   'Raise an emergency admission request to a nearby hospital',
   'provider', 'product', 'rmp', 50, TRUE),
  ('rmp_payouts', 'Earnings & Payouts',
   'Consultant commission earnings and settlement history',
   'provider', 'product', 'rmp', 60, TRUE)

ON CONFLICT (key) DO NOTHING;

-- Re-assert audience/sort_order for rows that already existed from an earlier
-- run (ON CONFLICT DO NOTHING skips the update, so a re-run would otherwise
-- leave a hand-edited row misfiled).
UPDATE features SET audience = 'hospital'             WHERE key LIKE 'hospital\_%';
UPDATE features SET audience = 'individual_doctor'    WHERE key LIKE 'doctor\_%';
UPDATE features SET audience = 'independent_lab'      WHERE key LIKE 'lab\_%' AND key <> 'lab_orders';
UPDATE features SET audience = 'independent_pharmacy' WHERE key LIKE 'pharmacy\_%' AND key <> 'pharmacy_orders';
UPDATE features SET audience = 'rmp'                  WHERE key LIKE 'rmp\_%' AND key <> 'rmp_network';

NOTIFY pgrst, 'reload schema';
