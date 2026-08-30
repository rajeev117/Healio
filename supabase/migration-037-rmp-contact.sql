-- ============================================================
-- Migration 037 — RMP contact fields (email + address).
--
-- The RMP self-registration flow (Register → RMP) collects an optional
-- contact email and address in addition to name + phone. migration-020
-- created the rmps table without these columns, so add them here.
--
-- Row-level RLS from migration-020 ("rmps: insert/update own") already
-- covers these columns — no policy changes needed.
--
-- Run in Supabase SQL Editor.
-- ============================================================

ALTER TABLE rmps ADD COLUMN IF NOT EXISTS email   TEXT;
ALTER TABLE rmps ADD COLUMN IF NOT EXISTS address TEXT;

NOTIFY pgrst, 'reload schema';
