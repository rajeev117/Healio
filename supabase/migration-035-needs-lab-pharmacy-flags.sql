-- ============================================================
-- Migration 035 — doctor's "Needs Lab Report" / "Needs Medicines" flags.
--
-- These are intentionally NOT a new lab_orders/pharmacy_orders row — the
-- doctor's one-tap action just sets a flag on the appointment. Nothing
-- becomes visible in the lab/pharmacy queue yet. Only when lab/pharmacy
-- staff SCAN the patient's QR at their counter does the system check this
-- flag, and only then create the real lab_orders/pharmacy_orders row (see
-- careFlow.js's resolveScannedPatientForLab/Pharmacy) — that's the moment
-- the patient actually enters the visible queue.
--
-- Run in Supabase SQL Editor (after migration 034).
-- ============================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS needs_lab      BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS needs_pharmacy BOOLEAN NOT NULL DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
