-- Migration 028
-- 1. Add 'suggested' to appointment_status enum.
--    Fixes the 400 error when a doctor suggests a follow-up from PatientActions.
-- 2. Add preferences JSONB to profiles for patient app notification settings.
-- 3. Seed the signup_payment feature flag (OFF by default during testing).

-- 1. Extend the enum (ADD VALUE is safe — it only appends, never removes)
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'suggested';

-- 2. Notification / privacy preferences per patient
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}';

-- 3. Admin-controlled toggle: show/hide the ₹4,999 payment step in Signup
INSERT INTO features (key, name, description, app, category, enabled)
VALUES (
  'signup_payment',
  'Signup Payment Step',
  'Show the ₹4,999 activation-fee screen during hospital registration. Turn OFF to let hospitals register for free during testing.',
  'provider',
  'system',
  false          -- OFF during testing; turn ON when ready to charge
)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
