-- ============================================================
-- Migration 057 — the individual (solo-practitioner) doctor.
--
-- An individual doctor signs up through the same provider wizard as a
-- standalone lab or pharmacy, so on approval they are an `organisations` row
-- of type 'clinic' — the enum value nothing used until now. resolveRole()
-- maps org type 'clinic' → the 'independent_doctor' role, exactly as it maps
-- 'diagnostic' → independent_lab and 'pharmacy' → independent_pharmacy.
--
-- But a doctor is not only an organisation. Every booking in this schema
-- points at `appointments.doctor_staff_id`, the QR check-in points at
-- `qr_checkins.doctor_staff_id`, and the patient app lists doctors out of
-- `staff`. So an individual doctor also needs a `staff` row for themselves,
-- inside their own clinic org.
--
-- approveOnboarding() in the admin panel only creates the organisation, so
-- this function fills the gap on the doctor's first login: it is idempotent,
-- self-healing, and works no matter how the clinic org came to exist.
--
-- Run in Supabase SQL Editor (after migration 054).
-- ============================================================

CREATE OR REPLACE FUNCTION claim_individual_doctor()
RETURNS UUID AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_email TEXT := auth.jwt() ->> 'email';
  v_org   RECORD;
  v_staff UUID;
BEGIN
  IF v_user IS NULL THEN
    RETURN NULL;
  END IF;

  -- Already have a staff row? Nothing to do — return it.
  SELECT id INTO v_staff FROM staff WHERE user_id = v_user LIMIT 1;
  IF v_staff IS NOT NULL THEN
    RETURN v_staff;
  END IF;

  -- The clinic this user administers. Match on the linked id first, then on
  -- the application email, which is how a first login reaches its org before
  -- claim_account() has linked it.
  SELECT id, name, city, admin_phone, admin_email
    INTO v_org
    FROM organisations
   WHERE type = 'clinic'
     AND (admin_user_id = v_user OR (admin_user_id IS NULL AND admin_email = v_email))
   LIMIT 1;

  IF v_org.id IS NULL THEN
    RETURN NULL;   -- not an individual doctor; caller falls through
  END IF;

  -- Link the org to this login while we are here (mirrors claim_account()).
  UPDATE organisations SET admin_user_id = v_user
   WHERE id = v_org.id AND admin_user_id IS NULL;

  -- A staff row may already exist for this clinic from an earlier login that
  -- never got linked (staff.phone is globally unique, so re-inserting would
  -- fail). Adopt it rather than creating a second one.
  SELECT id INTO v_staff
    FROM staff
   WHERE organisation_id = v_org.id AND role = 'doctor'
   ORDER BY created_at
   LIMIT 1;

  IF v_staff IS NOT NULL THEN
    UPDATE staff SET user_id = v_user, updated_at = NOW()
     WHERE id = v_staff AND user_id IS NULL;
    RETURN v_staff;
  END IF;

  -- staff.phone is NOT NULL and globally unique. The clinic's admin_phone is
  -- the doctor's own login, so it is the right value — but bail out rather
  -- than insert a bogus one if the org somehow has none.
  IF v_org.admin_phone IS NULL OR v_org.admin_phone = '' THEN
    RETURN NULL;
  END IF;

  -- The doctor IS the clinic: one staff row, named after the practice.
  -- staff_id is derived from the org uuid so re-running is deterministic;
  -- 12 hex chars makes a collision with another org's prefix implausible.
  INSERT INTO staff (staff_id, user_id, organisation_id, name, role, phone, email, status, verified_at)
  VALUES (
    'DR-' || UPPER(SUBSTRING(REPLACE(v_org.id::text, '-', '') FROM 1 FOR 12)),
    v_user,
    v_org.id,
    v_org.name,
    'doctor',
    v_org.admin_phone,
    v_org.admin_email,
    'active',
    NOW()
  )
  RETURNING id INTO v_staff;

  RETURN v_staff;

EXCEPTION
  -- Two devices signing in at once can race on the unique phone/staff_id.
  -- Whoever lost the race just reads the row the winner created.
  WHEN unique_violation THEN
    SELECT id INTO v_staff FROM staff WHERE organisation_id = v_org.id AND role = 'doctor' LIMIT 1;
    IF v_staff IS NOT NULL THEN
      UPDATE staff SET user_id = v_user, updated_at = NOW() WHERE id = v_staff AND user_id IS NULL;
    END IF;
    RETURN v_staff;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION claim_individual_doctor() TO authenticated;

NOTIFY pgrst, 'reload schema';
