-- ============================================================
-- Migration 007 — let apps read push notifications (broadcasts)
-- Admin writes them (service role); patients/providers read them.
-- Run in Supabase SQL Editor.
-- ============================================================

DROP POLICY IF EXISTS "push public read" ON push_notifications;
CREATE POLICY "push public read" ON push_notifications FOR SELECT USING (true);

NOTIFY pgrst, 'reload schema';
