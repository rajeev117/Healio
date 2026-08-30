-- ============================================================
-- Migration 033 — let the (pre-auth) hospital signup form upload real KYC docs.
--
-- healio-provider-mobile's Signup.js (hospital onboarding) collects
-- registration/license/ID documents BEFORE any account exists — it only
-- writes a row to onboarding_queue at the end; no supabase.auth call happens
-- anywhere in that flow. The verification-docs bucket policy from
-- migration-019 only allows INSERT `TO authenticated`, so a genuine upload
-- attempt from this screen would 42501/RLS-deny — which is exactly why it
-- was left as a `simulateUpload()` stub instead of a real one.
--
-- Allow `anon` to upload too (blind write — they still can't read anything
-- back; migration-019's read policy stays service_role-only). This mirrors
-- the existing pattern in this codebase for pre-auth actions (see
-- claim_account() / phone_registered(), both granted to anon).
--
-- Run in Supabase SQL Editor (after migration 032).
-- ============================================================

DROP POLICY IF EXISTS "verification docs: upload" ON storage.objects;
CREATE POLICY "verification docs: upload"
  ON storage.objects FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id = 'verification-docs');

NOTIFY pgrst, 'reload schema';
