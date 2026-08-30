-- ============================================================
-- Migration 020 — RMP / health-worker accounts.
--
-- The standalone RMP app was merged into the unified Healio app. RMPs
-- (registered medical practitioners / village health workers) self-register
-- and book services for their patients. Each RMP is its own auth user; this
-- table holds their profile and is what resolveRole() reads to route a login
-- into the RMP module.
--
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS rmps (
  -- Same UUID as auth.users.id
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  phone       TEXT UNIQUE,
  village     TEXT,
  reg_no      TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  is_test     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rmps ENABLE ROW LEVEL SECURITY;

-- An RMP can read their own row.
DROP POLICY IF EXISTS "rmps: read own" ON rmps;
CREATE POLICY "rmps: read own"
  ON rmps FOR SELECT
  USING (auth.uid() = id);

-- An RMP can create their own row at signup.
DROP POLICY IF EXISTS "rmps: insert own" ON rmps;
CREATE POLICY "rmps: insert own"
  ON rmps FOR INSERT
  WITH CHECK (auth.uid() = id);

-- An RMP can update their own row.
DROP POLICY IF EXISTS "rmps: update own" ON rmps;
CREATE POLICY "rmps: update own"
  ON rmps FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

NOTIFY pgrst, 'reload schema';
