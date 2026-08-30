-- ============================================================
-- Migration 042 — let ANY org staff read their org's prescriptions.
--
-- Problem: prescriptions only had SELECT policies for the patient
-- ("rx: patient reads own") and the prescribing doctor
-- ("rx: doctor creates & reads"). A lab technician or pharmacy
-- assistant opening a patient's prescription list saw NOTHING —
-- RLS filtered every row out ("No prescriptions on file"), even
-- though the lab/pharmacy order lists worked (those already have an
-- organisation-scoped staff policy).
--
-- Fix: mirror the pattern used by lab_orders / pharmacy_orders —
-- allow any staff member of the organisation to read prescriptions
-- belonging to that organisation. Prescriptions already carry
-- organisation_id, and my_org_id() resolves the caller's org from
-- their staff row (SECURITY DEFINER), so lab/pharmacy/opd/nurse/doctor
-- staff of the same hospital can all see the patient's prescriptions.
--
-- RLS policies are permissive (OR-ed), so this only ADDS read access.
--
-- Run in Supabase SQL Editor.
-- ============================================================

DROP POLICY IF EXISTS "rx: org staff reads" ON prescriptions;
CREATE POLICY "rx: org staff reads"
  ON prescriptions FOR SELECT
  USING (organisation_id = my_org_id());

NOTIFY pgrst, 'reload schema';
