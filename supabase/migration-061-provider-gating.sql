-- ============================================================
-- Migration 061 — make "suspend" in the admin panel actually mean something.
--
-- organisations.status has been in the schema since day one and the admin
-- panel has always written 'suspended' to it — but nothing ever read it back.
-- resolveRole() (healio-provider-mobile/src/lib/supabase.js) selected
-- id, name, city, type and no status, so a suspended hospital, individual
-- doctor, lab or pharmacy logged straight back in and kept trading.
--
-- The app-side gate is the matching change in resolveRole(). This migration
-- adds the bookkeeping the admin panel needs around it, and the same pair of
-- columns on `staff` and `rmps` so every provider kind suspends the same way.
--
-- Run in Supabase SQL Editor (after migration 060).
-- ============================================================

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE staff ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

ALTER TABLE rmps  ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ;
ALTER TABLE rmps  ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- ── Patient-facing catalogue ─────────────────────────────────────────────────
-- Nothing to do here: migration-003's "orgs public read active" already
-- restricts the public catalogue to status = 'active', so suspending an org
-- drops it out of the patient app's browse lists for free. Suspension only
-- ever needed the login gate, which is the app-side half of this change.
--
-- The org's own admin keeps reading their row through "orgs: admin reads own"
-- (schema.sql), which resolveRole() relies on to explain WHY they're blocked
-- rather than failing with an empty result.

NOTIFY pgrst, 'reload schema';
