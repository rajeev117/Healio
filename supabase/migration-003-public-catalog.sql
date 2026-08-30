-- ============================================================
-- Migration 003 — public catalog read access (patient app browse)
-- Lets the patient app show real doctors / hospitals / labs / pharmacies
-- and service categories WITHOUT a login. Read-only, safe rows only.
-- Run in Supabase SQL Editor (one time).
--
-- NOTE: for production you'd expose curated VIEWS instead of the base
-- tables so columns like admin_phone aren't public. Fine for dev.
-- ============================================================

-- Service categories — anyone can read the enabled ones
DROP POLICY IF EXISTS "service_cats public read" ON service_categories;
CREATE POLICY "service_cats public read"
  ON service_categories FOR SELECT
  USING (enabled = true);

-- Organisations — anyone can read ACTIVE orgs (hospitals/labs/pharmacies catalog)
DROP POLICY IF EXISTS "orgs public read active" ON organisations;
CREATE POLICY "orgs public read active"
  ON organisations FOR SELECT
  USING (status = 'active');

-- Staff — anyone can read ACTIVE doctors (doctor catalog)
DROP POLICY IF EXISTS "staff public read active doctors" ON staff;
CREATE POLICY "staff public read active doctors"
  ON staff FOR SELECT
  USING (status = 'active' AND role = 'doctor');

-- Refresh the API schema cache
NOTIFY pgrst, 'reload schema';
