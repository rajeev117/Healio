-- ============================================================
-- Migration 039 — RMP bookings (book on behalf of a patient).
--
-- An RMP books an appointment for a linked patient with a hospital's doctor.
-- The appointments table had no RLS policy for RMPs, so their INSERT was
-- denied ("new row violates row-level security policy for table appointments").
-- The booking also records a commission row, but rmp_commissions wasn't in the
-- schema. This migration adds everything that flow needs (idempotent):
--   1. appointments.rmp_id column (no-op if the live DB already has it).
--   2. RLS so an RMP can create + read the appointments they booked.
--   3. rmp_commissions ledger table + RLS (RMP manages only their own rows).
--
-- The patient still sees the booking via the existing "patient reads own"
-- policy; the doctor/hospital via their org/doctor policies. createBooking
-- (rmp/services/api.js) already inserts only real columns — no code change.
--
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Tie an appointment to the RMP who booked it ------------------------------
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS rmp_id UUID REFERENCES rmps(id) ON DELETE SET NULL;

-- 2. RLS: an RMP can create + read (and update/cancel) their own bookings -----
-- FOR ALL → WITH CHECK gates INSERT/UPDATE (rmp_id must be the caller), USING
-- gates SELECT/UPDATE/DELETE. This is what lets `insert().select('id')` return
-- the new row to the RMP. Permissive policy — OR'd with the existing patient /
-- doctor / org-admin policies, so it doesn't affect them.
DROP POLICY IF EXISTS "appointments: rmp manages own" ON appointments;
CREATE POLICY "appointments: rmp manages own"
  ON appointments FOR ALL
  USING (rmp_id = auth.uid())
  WITH CHECK (rmp_id = auth.uid());

-- 3. RMP commission ledger -----------------------------------------------------
CREATE TABLE IF NOT EXISTS rmp_commissions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rmp_id         UUID NOT NULL REFERENCES rmps(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  type           TEXT NOT NULL DEFAULT 'credit',   -- 'credit' | 'debit'
  label          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE rmp_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rmp_commissions: manage own" ON rmp_commissions;
CREATE POLICY "rmp_commissions: manage own"
  ON rmp_commissions FOR ALL
  USING (rmp_id = auth.uid())
  WITH CHECK (rmp_id = auth.uid());

NOTIFY pgrst, 'reload schema';
