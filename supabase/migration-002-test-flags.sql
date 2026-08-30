-- ============================================================
-- Migration 002 — add is_test flags so Dev Tools can clean up
-- Run in Supabase SQL Editor (one time).
-- ============================================================

ALTER TABLE onboarding_queue ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE refunds          ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE disputes         ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
