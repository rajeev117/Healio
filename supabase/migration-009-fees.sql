-- ============================================================
-- Migration 009 — consultation fees.
-- Hospital sets ONE default fee for all its doctors (organisations.consultation_fee),
-- with an optional per-doctor override (staff.consultation_fee, NULL = use default).
-- Run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2) NOT NULL DEFAULT 300;
ALTER TABLE staff         ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2);  -- NULL → use hospital default

-- Give the demo hospital a sensible default
UPDATE organisations SET consultation_fee = 500 WHERE name = 'Demo Hospital';

NOTIFY pgrst, 'reload schema';
