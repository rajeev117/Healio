-- ============================================================
-- Migration 030 — link family members to the records they generate.
--
-- The "Who's using Healio?" profile picker lets a patient act on behalf
-- of a family_profiles row (spouse, child, parent, …). Until now,
-- appointments/health_records/lab_orders/pharmacy_orders/prescriptions
-- only ever pointed at the logged-in account (patient_id), so a family
-- member's bookings and records were indistinguishable from the owner's.
--
-- This adds a nullable family_member_id on each of those tables:
--   NULL  → the row belongs to the account owner (self).
--   non-NULL → the row belongs to that family_profiles entry.
--
-- No RLS changes needed: every one of these tables is already scoped by
-- patient_id = auth.uid() (the OWNER's account), and family members don't
-- have their own auth.uid() — they're just a sub-filter the owner's app
-- applies client-side. family_member_id is additive, not a new principal.
--
-- Run in Supabase SQL Editor (after migration 029).
-- ============================================================

ALTER TABLE appointments    ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES family_profiles(id) ON DELETE SET NULL;
ALTER TABLE health_records  ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES family_profiles(id) ON DELETE SET NULL;
ALTER TABLE lab_orders      ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES family_profiles(id) ON DELETE SET NULL;
ALTER TABLE pharmacy_orders ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES family_profiles(id) ON DELETE SET NULL;
ALTER TABLE prescriptions   ADD COLUMN IF NOT EXISTS family_member_id UUID REFERENCES family_profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appts_family   ON appointments(family_member_id);
CREATE INDEX IF NOT EXISTS idx_records_family ON health_records(family_member_id);
CREATE INDEX IF NOT EXISTS idx_lab_family     ON lab_orders(family_member_id);
CREATE INDEX IF NOT EXISTS idx_pharm_family   ON pharmacy_orders(family_member_id);
CREATE INDEX IF NOT EXISTS idx_rx_family      ON prescriptions(family_member_id);

NOTIFY pgrst, 'reload schema';
