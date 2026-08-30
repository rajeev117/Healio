-- ============================================================
-- Migration 034 — real payout requests for hospitals.
--
-- healio-provider-mobile's Earnings.js "Request payout" button
-- (src/lib/store.js requestPayout()) was entirely in-memory — no DB write
-- at all. A hospital "requesting a payout" got a success alert that vanished
-- on the next earnings reload, with no record anywhere that it happened.
--
-- Run in Supabase SQL Editor (after migration 033).
-- ============================================================

CREATE TABLE IF NOT EXISTS payouts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL,
  method           TEXT NOT NULL DEFAULT 'bank',
  status           TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'paid', 'failed')),
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_org ON payouts(organisation_id);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payouts: org admin manages own" ON payouts;
CREATE POLICY "payouts: org admin manages own"
  ON payouts FOR ALL
  USING (is_org_admin(organisation_id))
  WITH CHECK (is_org_admin(organisation_id));

DROP POLICY IF EXISTS "payouts: service role all" ON payouts;
CREATE POLICY "payouts: service role all"
  ON payouts FOR ALL
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
