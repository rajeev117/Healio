-- ============================================================
-- Migration 006 — let auto-triggers bypass RLS (SECURITY DEFINER)
-- Without this, a PATIENT signing up can't create their wallet row
-- (the trigger runs as the patient, who can't write `wallets`),
-- so the whole signup insert fails. Run in Supabase SQL Editor.
-- ============================================================

-- Wallet auto-creation on new patient profile
CREATE OR REPLACE FUNCTION create_wallet_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (patient_id, balance) VALUES (NEW.id, 0)
  ON CONFLICT (patient_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Provider-count sync when staff is added/changed
CREATE OR REPLACE FUNCTION sync_org_provider_count()
RETURNS TRIGGER AS $$
DECLARE
  target_org_id UUID;
BEGIN
  target_org_id := COALESCE(NEW.organisation_id, OLD.organisation_id);
  UPDATE organisations SET
    provider_count = (
      SELECT COUNT(*) FROM staff
      WHERE organisation_id = target_org_id AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = target_org_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safety net: also allow a patient to create their own wallet directly
DROP POLICY IF EXISTS "wallets: patient creates own" ON wallets;
CREATE POLICY "wallets: patient creates own"
  ON wallets FOR INSERT WITH CHECK (patient_id = auth.uid());

NOTIFY pgrst, 'reload schema';
