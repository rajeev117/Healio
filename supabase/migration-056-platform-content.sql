-- ============================================================
-- Migration 056 — admin-managed support & legal content.
--
-- One table drives the "Contact Support", "Terms", "Privacy Policy"
-- entries in EVERY app role (hospital, patient, doctor, rmp, pharmacy,
-- lab). The admin adds/edits rows from the admin panel; the apps read
-- them live. Until a row exists, the apps show "not available yet"
-- instead of hardcoded fake contacts.
--
--   role  — which app sees it: hospital|patient|doctor|rmp|pharmacy|lab|all
--           (a role-specific row overrides an 'all' row of the same kind)
--   kind  — support_email | support_phone | terms_url | privacy_url | about
--   value — the email / phone number / URL / text
--
-- Ported verbatim from the individual-doctor module, where it was numbered 049.
-- Read through src/lib/platformContent.js.
--
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_content (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role        TEXT NOT NULL DEFAULT 'all',
  kind        TEXT NOT NULL,
  title       TEXT,
  value       TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (role, kind)
);

ALTER TABLE platform_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_content: public read" ON platform_content;
CREATE POLICY "platform_content: public read"
  ON platform_content FOR SELECT
  USING (enabled = true);

DROP POLICY IF EXISTS "platform_content: service role writes" ON platform_content;
CREATE POLICY "platform_content: service role writes"
  ON platform_content FOR ALL
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
