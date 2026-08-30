-- ============================================================
-- Migration 014 — real location for patients and hospitals.
-- Adds city/area + GPS coordinates so "use my location",
-- nearby sorting, and correct hospital addresses work.
-- Run in Supabase SQL Editor.
-- ============================================================

-- Patient location
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS area      TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

-- Hospital coordinates (city + address already exist on organisations)
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6);
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

NOTIFY pgrst, 'reload schema';
