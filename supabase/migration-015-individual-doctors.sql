-- ============================================================
-- Migration 015 — repurpose the "Doctors" toggle.
--
-- The Doctors browse option is core (hospital doctors = the MVP) and is
-- always available. The admin toggle now controls ONLY individual /
-- solo-practitioner doctors (a future capability).
--
-- Renames feature key 'service_doctors' → 'individual_doctors'.
-- Run in Supabase SQL Editor (after migration 012).
-- ============================================================

UPDATE features
SET key = 'individual_doctors',
    name = 'Individual Doctors',
    description = 'Show solo / individual practitioners (not tied to a hospital)',
    category = 'product'
WHERE key = 'service_doctors';

-- If migration 012 was never run, make sure the row exists.
INSERT INTO features (key, name, description, app, category, enabled)
VALUES ('individual_doctors', 'Individual Doctors',
        'Show solo / individual practitioners (not tied to a hospital)',
        'patient', 'product', FALSE)
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
