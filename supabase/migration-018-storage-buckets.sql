-- ============================================================
-- Migration 018 — storage buckets for profile / icon images.
--
-- Buckets:
--   avatars        — patient profile pictures
--   doctor-photos  — doctor profile pictures
--   hospital-logos — hospital icons / logos
--   media          — banners and other section images
--
-- All public-read (so URLs can be shown directly). Uploads require an
-- authenticated user. Where no image is set, the apps already fall back
-- to initials / default icons (existing naming-convention behaviour).
--
-- Run in Supabase SQL Editor. If your SQL role can't manage storage
-- policies, create these four PUBLIC buckets from the Storage UI instead.
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars',        'avatars',        true),
  ('doctor-photos',  'doctor-photos',  true),
  ('hospital-logos', 'hospital-logos', true),
  ('media',          'media',          true)
ON CONFLICT (id) DO NOTHING;

-- Public read for all four buckets.
DROP POLICY IF EXISTS "public assets: read" ON storage.objects;
CREATE POLICY "public assets: read"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'doctor-photos', 'hospital-logos', 'media', 'records'));

-- Authenticated users may upload to these buckets.
DROP POLICY IF EXISTS "public assets: upload" ON storage.objects;
CREATE POLICY "public assets: upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('avatars', 'doctor-photos', 'hospital-logos', 'media', 'records'));

-- Authenticated users may replace/update their uploads.
DROP POLICY IF EXISTS "public assets: update" ON storage.objects;
CREATE POLICY "public assets: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('avatars', 'doctor-photos', 'hospital-logos', 'media', 'records'));

NOTIFY pgrst, 'reload schema';
