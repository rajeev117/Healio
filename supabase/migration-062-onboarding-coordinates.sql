-- ============================================================
-- Migration 062 — capture provider coordinates at signup.
--
-- organisations has had latitude/longitude since migration-014, but nothing
-- ever filled them for a provider who signed up through the app: the hospital
-- wizard collected street/city/pincode as free text and no coordinates at all,
-- so every newly onboarded hospital, lab, pharmacy and individual doctor was
-- invisible to the patient app's "nearest" sort.
--
-- The signup wizard now has a map picker (Google Maps + Places when a key is
-- configured, Leaflet/OSM otherwise). These columns carry what it captured
-- through the onboarding queue so approveOnboarding() can copy them onto the
-- organisation it creates.
--
-- Run in Supabase SQL Editor (after migration 061).
-- ============================================================

ALTER TABLE onboarding_queue ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9,6);
ALTER TABLE onboarding_queue ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6);

NOTIFY pgrst, 'reload schema';
