-- ============================================================
-- Migration 021 — reschedule tracking.
--
-- Tracks how many times a patient has rescheduled an appointment.
-- The patient app warns at the limit (3) and then asks them to contact
-- the hospital. The provider app uses the counter bump to show a
-- "patient rescheduled" notification.
--
-- Run in Supabase SQL Editor (after migration 020).
-- ============================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_count INT NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
