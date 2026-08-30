-- ============================================================
-- Migration 005 — let the apps read platform config (read-only).
-- Feature flags, kill switches, banners and pricing are non-sensitive
-- config the apps must read (even before login) to know what to show.
-- Run in Supabase SQL Editor (one time).
-- ============================================================

DROP POLICY IF EXISTS "flags public read" ON feature_flags;
CREATE POLICY "flags public read" ON feature_flags FOR SELECT USING (true);

DROP POLICY IF EXISTS "kill public read" ON kill_switches;
CREATE POLICY "kill public read" ON kill_switches FOR SELECT USING (true);

DROP POLICY IF EXISTS "banners public read" ON banners;
CREATE POLICY "banners public read" ON banners FOR SELECT USING (enabled = true);

DROP POLICY IF EXISTS "pricing public read" ON pricing_rules;
CREATE POLICY "pricing public read" ON pricing_rules FOR SELECT USING (true);

NOTIFY pgrst, 'reload schema';
