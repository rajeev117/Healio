-- ============================================================
-- Migration 024 — track who confirmed an appointment.
--
-- Either the hospital admin OR the assigned doctor can confirm a booking.
-- We record which, so the *other* party (and the patient) can be notified
-- that "the doctor confirmed" vs "the hospital confirmed".
--
-- Run in Supabase SQL Editor (after migration 023).
-- ============================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmed_by_role TEXT;  -- 'doctor' | 'hospital_admin'
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmed_by_name TEXT;

NOTIFY pgrst, 'reload schema';
