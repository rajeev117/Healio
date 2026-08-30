-- ============================================================
-- Migration 019 — finish storage: missing columns + remaining buckets.
--
-- Adds:
--   • staff.photo_url            → photos for doctors, OPD & pharmacy staff
--   • banners.image_url          → image banners
--   • onboarding_queue.document_urls + organisations.verification_doc_urls
--                                → hospital verification documents (KYC)
--
-- Buckets:
--   • staff-photos      (public)  — all provider staff photos
--   • lab-reports       (public)  — lab order result PDFs
--   • verification-docs (PRIVATE) — sensitive hospital KYC documents
--
-- (avatars / doctor-photos / hospital-logos / media / records already exist
--  from migrations 017 & 018.)
--
-- Run in Supabase SQL Editor. If your role can't manage storage policies,
-- create the buckets from the Storage UI (verification-docs = NOT public).
-- ============================================================

-- ── 1. Columns ──────────────────────────────────────────────────────────────
ALTER TABLE staff            ADD COLUMN IF NOT EXISTS photo_url            TEXT;
ALTER TABLE banners          ADD COLUMN IF NOT EXISTS image_url            TEXT;
ALTER TABLE onboarding_queue ADD COLUMN IF NOT EXISTS document_urls        TEXT[] DEFAULT '{}';
ALTER TABLE organisations    ADD COLUMN IF NOT EXISTS verification_doc_urls TEXT[] DEFAULT '{}';

-- ── 2. Buckets ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) VALUES
  ('staff-photos',      'staff-photos',      true),
  ('lab-reports',       'lab-reports',       true),
  ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Public buckets: read by anyone, upload/update by authenticated users ──
-- Recreated to include every public bucket in one place.
DROP POLICY IF EXISTS "public assets: read"   ON storage.objects;
DROP POLICY IF EXISTS "public assets: upload" ON storage.objects;
DROP POLICY IF EXISTS "public assets: update" ON storage.objects;

CREATE POLICY "public assets: read"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars','doctor-photos','staff-photos','hospital-logos','media','records','lab-reports'));

CREATE POLICY "public assets: upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('avatars','doctor-photos','staff-photos','hospital-logos','media','records','lab-reports'));

CREATE POLICY "public assets: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('avatars','doctor-photos','staff-photos','hospital-logos','media','records','lab-reports'));

-- ── 4. verification-docs: PRIVATE ───────────────────────────────────────────
-- Applicants (authenticated) may upload their own docs; only the platform
-- (service role / admin portal) may read them. Admins can also use signed URLs.
DROP POLICY IF EXISTS "verification docs: upload" ON storage.objects;
CREATE POLICY "verification docs: upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs');

DROP POLICY IF EXISTS "verification docs: admin reads" ON storage.objects;
CREATE POLICY "verification docs: admin reads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'verification-docs' AND auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
