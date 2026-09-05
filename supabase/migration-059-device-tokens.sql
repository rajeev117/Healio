-- ============================================================
-- Migration 059 — real device push notifications.
--
-- Until now "push" meant a row in `push_notifications` that the apps polled
-- and rendered as an in-app list. Nothing ever reached the device.
--
-- This table stores the Expo push token each install registers after login,
-- so the admin panel can hand those tokens to Expo's push service and the
-- message actually arrives on the phone.
--
--   token     the ExponentPushToken[...] string (unique — one row per install)
--   user_id   who was logged in when it registered; NULL once they log out
--   app       'patient' | 'provider' — which bundle registered it
--   role      resolved role at registration time, so admin can target
--             "all pharmacies" without a join
--   enabled   set FALSE instead of deleting when Expo reports the token dead
--
-- Run in Supabase SQL Editor (after migration 058).
-- ============================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token      TEXT UNIQUE NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app        TEXT NOT NULL DEFAULT 'provider',   -- patient | provider
  role       TEXT,                               -- hospital_admin | doctor | patient | rmp | …
  platform   TEXT,                               -- ios | android | web
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_role ON device_tokens(role);
CREATE INDEX IF NOT EXISTS idx_device_tokens_app  ON device_tokens(app);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- A device is identified by its Expo push token, which is unique per install.
-- The policies below are split per verb rather than one FOR ALL, because the
-- three verbs need genuinely different rules:
--
--   SELECT  only your own rows. Nobody enumerates other people's devices.
--   INSERT  the row you create must be yours.
--   UPDATE  ANY authenticated user may re-point a token row at themselves, as
--           long as it ends up owned by them. This is the load-bearing case:
--           on a shared handset the token survives a logout, so when the next
--           person signs in the row still belongs to the previous user. Without
--           this they could not claim it — and their colleague would keep
--           receiving notifications on a phone they no longer hold.
--           Safe because the token is an unguessable Expo secret: holding it
--           already means holding the device, and USING (true) here leaks
--           nothing (there is no SELECT and PostgREST upserts return minimal).
--   DELETE  only your own rows.
DROP POLICY IF EXISTS "device_tokens: owner manages own" ON device_tokens;

DROP POLICY IF EXISTS "device_tokens: owner reads own" ON device_tokens;
CREATE POLICY "device_tokens: owner reads own"
  ON device_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens: owner registers" ON device_tokens;
CREATE POLICY "device_tokens: owner registers"
  ON device_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens: claim on re-login" ON device_tokens;
CREATE POLICY "device_tokens: claim on re-login"
  ON device_tokens FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "device_tokens: owner deletes own" ON device_tokens;
CREATE POLICY "device_tokens: owner deletes own"
  ON device_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- The admin panel (service role) reads every token to fan a broadcast out.
DROP POLICY IF EXISTS "device_tokens: service role all" ON device_tokens;
CREATE POLICY "device_tokens: service role all"
  ON device_tokens FOR ALL
  USING (auth.role() = 'service_role');

-- ── Delivery bookkeeping on the broadcast history ───────────────────────────
-- `delivered` already exists; these record what Expo actually reported so the
-- admin list can show "sent to 412, 3 failed" instead of a hardcoded 0.
ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS failed     INT  NOT NULL DEFAULT 0;
ALTER TABLE push_notifications ADD COLUMN IF NOT EXISTS send_error TEXT;

NOTIFY pgrst, 'reload schema';
