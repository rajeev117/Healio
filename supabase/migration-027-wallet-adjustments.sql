-- Migration 027: wallet_adjustments table
-- Required by admin portal adjustPatientWallet action.

CREATE TABLE IF NOT EXISTS wallet_adjustments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount        NUMERIC(10, 2) NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  note          TEXT,
  adjusted_by   UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wallet_adjustments ENABLE ROW LEVEL SECURITY;

-- Only service_role (admin portal) can read/write — patients cannot.
CREATE POLICY "service_role_only" ON wallet_adjustments USING (false);

NOTIFY pgrst, 'reload schema';
