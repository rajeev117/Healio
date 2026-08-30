-- ============================================================
-- Migration 025 — centralized consultation defaults.
--
-- A hospital sets a DEFAULT consultation fee + patients-per-slot once.
-- These prefill every new doctor's form (still editable per doctor).
--
-- Run in Supabase SQL Editor (after migration 024).
-- ============================================================

-- Hospital-level defaults
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS consultation_fee          NUMERIC(10,2);
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS default_patients_per_slot INT DEFAULT 1;

-- Per-doctor override (prefilled from the org default)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS patients_per_slot INT;

NOTIFY pgrst, 'reload schema';
