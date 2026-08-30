-- ============================================================
-- Migration 011 — platform settings (single-row global config
-- edited from the admin Settings page).
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id                  INT PRIMARY KEY DEFAULT 1,
  platform_name       TEXT NOT NULL DEFAULT 'Healio',
  support_email       TEXT NOT NULL DEFAULT 'support@healio.in',
  min_wallet_balance  NUMERIC(10,2) NOT NULL DEFAULT 50,
  session_timeout     INT NOT NULL DEFAULT 30,
  maintenance_mode    BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor          BOOLEAN NOT NULL DEFAULT TRUE,
  audit_logging       BOOLEAN NOT NULL DEFAULT TRUE,
  email_notifs        BOOLEAN NOT NULL DEFAULT TRUE,
  slack_notifs        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single row.
INSERT INTO platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- The mobile apps may read maintenance_mode / platform_name (public read).
DROP POLICY IF EXISTS "settings: public read" ON platform_settings;
CREATE POLICY "settings: public read"
  ON platform_settings FOR SELECT
  USING (true);

-- Only the service role (admin server actions) may write.
DROP POLICY IF EXISTS "settings: service role writes" ON platform_settings;
CREATE POLICY "settings: service role writes"
  ON platform_settings FOR ALL
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
