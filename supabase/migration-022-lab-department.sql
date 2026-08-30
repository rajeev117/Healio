-- ============================================================
-- Migration 022 — route lab orders to a specific lab/department.
--
-- A hospital can have several labs (Pathology, Radiology, …). When a
-- doctor refers a patient, they pick which lab — stored here so the
-- right lab technician sees the order.
--
-- Run in Supabase SQL Editor (after migration 021).
-- ============================================================

ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS department TEXT;

NOTIFY pgrst, 'reload schema';
