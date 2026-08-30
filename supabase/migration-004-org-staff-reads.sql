-- ============================================================
-- Migration 004 — let all staff of an org (and the hospital admin)
-- read that org's appointments & orders, so the provider dashboards
-- (OPD queue, pharmacy queue, hospital admin) show real data.
-- Run in Supabase SQL Editor (one time).
-- ============================================================

-- Appointments: any staff member of the org can read the org's appointments
DROP POLICY IF EXISTS "appointments org staff read" ON appointments;
CREATE POLICY "appointments org staff read"
  ON appointments FOR SELECT
  USING (organisation_id = my_org_id());

-- Orders: hospital admin can read their org's orders
DROP POLICY IF EXISTS "pharmacy org admin read" ON pharmacy_orders;
CREATE POLICY "pharmacy org admin read"
  ON pharmacy_orders FOR SELECT USING (is_org_admin(organisation_id));

DROP POLICY IF EXISTS "lab org admin read" ON lab_orders;
CREATE POLICY "lab org admin read"
  ON lab_orders FOR SELECT USING (is_org_admin(organisation_id));

DROP POLICY IF EXISTS "homecare org admin read" ON homecare_orders;
CREATE POLICY "homecare org admin read"
  ON homecare_orders FOR SELECT USING (is_org_admin(organisation_id));

-- Hospital admin can read their org's appointments (doctor/own already covered)
DROP POLICY IF EXISTS "appointments org admin read2" ON appointments;
CREATE POLICY "appointments org admin read2"
  ON appointments FOR SELECT USING (is_org_admin(organisation_id));

NOTIFY pgrst, 'reload schema';
