-- ============================================================
-- Migration 058 — real doctor scheduling + atomic slot locking.
--
-- Until now doctor_schedules (migration 013) was WRITE-ONLY: one row per
-- doctor, edited on DoctorSchedule.js, read by nothing that books. Every
-- booking screen rendered a hardcoded array of times, and addAppointment
-- did a count-then-insert with no lock — so two patients could take the
-- same slot.
--
-- This migration makes the schedule real and makes the slot lock real:
--
--   1. doctor_schedules gains name / capacity / is_active / updated_by,
--      so a doctor can run several named sessions a day (Morning OPD,
--      Evening OPD) instead of one continuous block.
--   2. doctor_schedule_exceptions holds leave (whole day) and blocked
--      windows (a slot or two on one date).
--   3. Schedule writes are restricted to the doctor themselves, the org
--      admin, and front-desk staff — not every nurse in the building.
--   4. doctor_availability() generates the bookable grid from 1+2. It is
--      the single source of truth every booking surface now reads.
--   5. A BEFORE INSERT/UPDATE TRIGGER on appointments takes a per-slot
--      advisory lock and re-counts capacity. This is the actual
--      double-booking guarantee — it holds on EVERY path (RPC, direct
--      insert, walk-in, RMP, admin service-role), not just the one the
--      patient app happens to call.
--   6. book_appointment_slot() / move_appointment_slot() wrap that with
--      schedule-window validation and named errors for the UI.
--
-- Errors raised (matched on by src/lib/schedule.js):
--   SLOT_FULL · OUTSIDE_SCHEDULE · SLOT_BLOCKED · ON_LEAVE · SLOT_PAST
--   NOT_AUTHORISED · DOCTOR_NOT_FOUND
--
-- Run in Supabase SQL Editor (after migration 057).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. Timezone. Slots are wall-clock ("09:15") but appointments.scheduled_at
--    is TIMESTAMPTZ, so generating the grid needs one agreed zone. Nothing
--    in the schema had one. Single row, single place to change.
-- ────────────────────────────────────────────────────────────

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

CREATE OR REPLACE FUNCTION healio_tz() RETURNS TEXT
LANGUAGE sql STABLE SET search_path = public AS $fn$
  SELECT COALESCE((SELECT timezone FROM platform_settings WHERE id = 1), 'Asia/Kolkata');
$fn$;


-- ────────────────────────────────────────────────────────────
-- 1. Multi-session schedules
-- ────────────────────────────────────────────────────────────

ALTER TABLE doctor_schedules
  ADD COLUMN IF NOT EXISTS name       TEXT    NOT NULL DEFAULT 'OPD',
  ADD COLUMN IF NOT EXISTS capacity   INT     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_by UUID;

DO $mig$ BEGIN
  ALTER TABLE doctor_schedules
    ADD CONSTRAINT doctor_schedules_capacity_positive CHECK (capacity >= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $mig$;

-- Existing rows predate capacity; adopt the doctor's configured
-- patients_per_slot so nobody silently drops to 1.
UPDATE doctor_schedules ds
SET capacity = GREATEST(COALESCE(s.patients_per_slot, o.default_patients_per_slot, 1), 1)
FROM staff s
LEFT JOIN organisations o ON o.id = s.organisation_id
WHERE s.id = ds.doctor_staff_id
  AND ds.capacity = 1
  AND COALESCE(s.patients_per_slot, o.default_patients_per_slot, 1) > 1;

CREATE INDEX IF NOT EXISTS idx_sched_doctor_active
  ON doctor_schedules(doctor_staff_id) WHERE is_active;


-- ────────────────────────────────────────────────────────────
-- 2. Exceptions: leave + blocked windows
--    start_time/end_time NULL  => the whole day is off
--    start_time/end_time set   => only that window is blocked
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS doctor_schedule_exceptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_staff_id  UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  exception_date   DATE NOT NULL,
  start_time       TEXT,
  end_time         TEXT,
  reason           TEXT,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A plain UNIQUE treats NULLs as distinct, so the two cases need separate
-- partial indexes or "day off" could be inserted twice.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_exc_fullday
  ON doctor_schedule_exceptions(doctor_staff_id, exception_date)
  WHERE start_time IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_exc_window
  ON doctor_schedule_exceptions(doctor_staff_id, exception_date, start_time)
  WHERE start_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exc_doctor_date
  ON doctor_schedule_exceptions(doctor_staff_id, exception_date);


-- ────────────────────────────────────────────────────────────
-- 3. Who may manage a doctor's schedule.
--    The doctor themselves, the org admin, or front-desk staff.
--    (migration 013 allowed ANY staff row in the org — a lab technician
--    could rewrite a surgeon's hours.)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION can_manage_doctor_schedule(p_doctor_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org UUID;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;

  SELECT organisation_id INTO v_org FROM staff WHERE id = p_doctor_staff_id;
  IF v_org IS NULL THEN RETURN FALSE; END IF;

  -- (a) the doctor editing their own schedule
  IF EXISTS (SELECT 1 FROM staff WHERE id = p_doctor_staff_id AND user_id = auth.uid()) THEN
    RETURN TRUE;
  END IF;

  -- (b) the hospital admin who owns the organisation
  IF EXISTS (SELECT 1 FROM organisations WHERE id = v_org AND admin_user_id = auth.uid()) THEN
    RETURN TRUE;
  END IF;

  -- (c) the hospital's front desk
  RETURN EXISTS (
    SELECT 1 FROM staff
    WHERE user_id = auth.uid()
      AND organisation_id = v_org
      AND role IN ('admin', 'receptionist', 'opd_assistant')
  );
END;
$fn$;

ALTER TABLE doctor_schedule_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sched: org manages"    ON doctor_schedules;
DROP POLICY IF EXISTS "sched: public read"    ON doctor_schedules;
DROP POLICY IF EXISTS "sched: manager writes" ON doctor_schedules;
DROP POLICY IF EXISTS "sched: org reads"      ON doctor_schedules;

-- Patients no longer read this table directly — doctor_availability() is
-- SECURITY DEFINER and returns only what is safe to show them.
CREATE POLICY "sched: org reads"
  ON doctor_schedules FOR SELECT
  USING (
    organisation_id = my_org_id()
    OR is_org_admin(organisation_id)
    OR doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "sched: manager writes"
  ON doctor_schedules FOR ALL
  USING (can_manage_doctor_schedule(doctor_staff_id))
  WITH CHECK (can_manage_doctor_schedule(doctor_staff_id));

DROP POLICY IF EXISTS "sched: service role all" ON doctor_schedules;
CREATE POLICY "sched: service role all"
  ON doctor_schedules FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "exc: org reads"        ON doctor_schedule_exceptions;
DROP POLICY IF EXISTS "exc: manager writes"   ON doctor_schedule_exceptions;
DROP POLICY IF EXISTS "exc: service role all" ON doctor_schedule_exceptions;

CREATE POLICY "exc: org reads"
  ON doctor_schedule_exceptions FOR SELECT
  USING (
    organisation_id = my_org_id()
    OR is_org_admin(organisation_id)
    OR doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "exc: manager writes"
  ON doctor_schedule_exceptions FOR ALL
  USING (can_manage_doctor_schedule(doctor_staff_id))
  WITH CHECK (can_manage_doctor_schedule(doctor_staff_id));

CREATE POLICY "exc: service role all"
  ON doctor_schedule_exceptions FOR ALL
  USING (auth.role() = 'service_role');


-- ────────────────────────────────────────────────────────────
-- 4. Slot maths helpers
-- ────────────────────────────────────────────────────────────

-- 'HH:MM' -> minutes since midnight. NULL when the text is not a valid
-- time, so a half-edited session is skipped rather than generating garbage.
CREATE OR REPLACE FUNCTION hhmm_to_mins(p_text TEXT) RETURNS INT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN btrim(COALESCE(p_text, '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
      THEN split_part(btrim(p_text), ':', 1)::INT * 60
         + split_part(btrim(p_text), ':', 2)::INT
    ELSE NULL
  END;
$fn$;

-- The capacity that applies at one instant: the widest session covering it,
-- else the doctor's configured per-slot capacity, else the org default, else 1.
CREATE OR REPLACE FUNCTION doctor_slot_capacity(p_doctor_staff_id UUID, p_at TIMESTAMPTZ)
RETURNS INT
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_local TIMESTAMP;
  v_mins  INT;
  v_dow   TEXT;
  v_cap   INT;
BEGIN
  v_local := p_at AT TIME ZONE healio_tz();
  v_mins  := EXTRACT(HOUR FROM v_local)::INT * 60 + EXTRACT(MINUTE FROM v_local)::INT;
  v_dow   := (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[EXTRACT(DOW FROM v_local)::INT + 1];

  SELECT MAX(GREATEST(ds.capacity, 1)) INTO v_cap
  FROM doctor_schedules ds
  WHERE ds.doctor_staff_id = p_doctor_staff_id
    AND ds.is_active
    AND v_dow = ANY (ds.days)
    AND hhmm_to_mins(ds.start_time) IS NOT NULL
    AND hhmm_to_mins(ds.end_time)   IS NOT NULL
    AND v_mins >= hhmm_to_mins(ds.start_time)
    AND v_mins <  hhmm_to_mins(ds.end_time);

  IF v_cap IS NOT NULL THEN RETURN v_cap; END IF;

  -- Outside every session (walk-in, or a follow-up slotted by the desk).
  SELECT GREATEST(COALESCE(s.patients_per_slot, o.default_patients_per_slot, 1), 1) INTO v_cap
  FROM staff s
  LEFT JOIN organisations o ON o.id = s.organisation_id
  WHERE s.id = p_doctor_staff_id;

  RETURN COALESCE(v_cap, 1);
END;
$fn$;


-- ────────────────────────────────────────────────────────────
-- 5. doctor_availability() — the bookable grid.
--    SECURITY DEFINER: patients get slot states without read access to
--    doctor_schedule_exceptions.reason ("mother's surgery").
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION doctor_availability(
  p_doctor_staff_id UUID,
  p_from            DATE DEFAULT CURRENT_DATE,
  p_days            INT  DEFAULT 7
)
RETURNS TABLE (
  slot_date    DATE,
  slot_time    TEXT,
  slot_at      TIMESTAMPTZ,
  session_id   UUID,
  session_name TEXT,
  capacity     INT,
  booked       INT,
  state        TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_days INT  := LEAST(GREATEST(COALESCE(p_days, 7), 1), 62);
  v_from DATE := COALESCE(p_from, CURRENT_DATE);
  v_tz   TEXT := healio_tz();
BEGIN
  RETURN QUERY
  WITH dates AS (
    SELECT (v_from + n)::DATE AS d
    FROM generate_series(0, v_days - 1) AS n
  ),
  sess AS (
    SELECT ds.id, ds.name, ds.days,
           hhmm_to_mins(ds.start_time) AS start_mins,
           hhmm_to_mins(ds.end_time)   AS end_mins,
           GREATEST(COALESCE(ds.slot_mins, 15), 5) AS step,
           GREATEST(ds.capacity, 1) AS cap
    FROM doctor_schedules ds
    WHERE ds.doctor_staff_id = p_doctor_staff_id
      AND ds.is_active
      AND hhmm_to_mins(ds.start_time) IS NOT NULL
      AND hhmm_to_mins(ds.end_time)   IS NOT NULL
      AND hhmm_to_mins(ds.end_time) > hhmm_to_mins(ds.start_time)
  ),
  grid AS (
    SELECT
      d.d                                                 AS g_date,
      to_char(d.d + m * INTERVAL '1 minute', 'HH24:MI')   AS g_time,
      (d.d + m * INTERVAL '1 minute') AT TIME ZONE v_tz   AS g_at,
      m                                                   AS g_mins,
      s.id                                                AS g_session,
      s.name                                              AS g_name,
      s.cap                                               AS g_cap
    FROM dates d
    JOIN sess s
      ON (ARRAY['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[EXTRACT(DOW FROM d.d)::INT + 1]
         = ANY (s.days)
    CROSS JOIN LATERAL generate_series(s.start_mins, s.end_mins - s.step, s.step) AS m
  )
  SELECT
    g.g_date,
    g.g_time,
    g.g_at,
    g.g_session,
    g.g_name,
    g.g_cap,
    COALESCE(b.n, 0),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM doctor_schedule_exceptions e
        WHERE e.doctor_staff_id = p_doctor_staff_id
          AND e.exception_date  = g.g_date
          AND e.start_time IS NULL
      ) THEN 'leave'
      WHEN EXISTS (
        SELECT 1 FROM doctor_schedule_exceptions e
        WHERE e.doctor_staff_id = p_doctor_staff_id
          AND e.exception_date  = g.g_date
          AND e.start_time IS NOT NULL
          AND g.g_mins >= hhmm_to_mins(e.start_time)
          AND g.g_mins <  COALESCE(hhmm_to_mins(e.end_time), hhmm_to_mins(e.start_time) + 1)
      ) THEN 'blocked'
      WHEN COALESCE(b.n, 0) >= g.g_cap THEN 'full'
      WHEN g.g_at <= NOW() THEN 'past'
      ELSE 'free'
    END
  FROM grid g
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::INT AS n
    FROM appointments a
    WHERE a.doctor_staff_id = p_doctor_staff_id
      AND a.scheduled_at    = g.g_at
      AND a.status IN ('scheduled', 'in_progress', 'suggested')
  ) b ON TRUE
  ORDER BY g.g_date, g.g_at;
END;
$fn$;

REVOKE ALL ON FUNCTION doctor_availability(UUID, DATE, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctor_availability(UUID, DATE, INT) TO authenticated, anon;


-- ────────────────────────────────────────────────────────────
-- 6. THE GUARANTEE — a trigger, not a convention.
--
--    Every booking path in the app (patient, RMP, walk-in, follow-up,
--    reschedule, suggest-time, admin seeding) ends in an INSERT or an
--    UPDATE of appointments.scheduled_at. Guarding the RPC alone would
--    leave six ways around it, so the check lives here.
--
--    pg_advisory_xact_lock serialises concurrent transactions on the same
--    (doctor, instant) key, closing the count-then-insert race that made
--    double-booking possible.
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_appts_doctor_slot_active
  ON appointments(doctor_staff_id, scheduled_at)
  WHERE status IN ('scheduled', 'in_progress', 'suggested');

CREATE OR REPLACE FUNCTION appointments_slot_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  v_cap   INT;
  v_taken INT;
BEGIN
  -- completed / cancelled release the slot
  IF NEW.status NOT IN ('scheduled', 'in_progress', 'suggested') THEN
    RETURN NEW;
  END IF;

  -- Only re-check when the row actually starts occupying this instant.
  IF TG_OP = 'UPDATE'
     AND NEW.scheduled_at    IS NOT DISTINCT FROM OLD.scheduled_at
     AND NEW.doctor_staff_id IS NOT DISTINCT FROM OLD.doctor_staff_id
     AND OLD.status IN ('scheduled', 'in_progress', 'suggested')
  THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.doctor_staff_id::TEXT || '@' || NEW.scheduled_at::TEXT, 0)
  );

  v_cap := doctor_slot_capacity(NEW.doctor_staff_id, NEW.scheduled_at);

  SELECT COUNT(*)::INT INTO v_taken
  FROM appointments a
  WHERE a.doctor_staff_id = NEW.doctor_staff_id
    AND a.scheduled_at    = NEW.scheduled_at
    AND a.status IN ('scheduled', 'in_progress', 'suggested')
    AND (TG_OP = 'INSERT' OR a.id <> NEW.id);

  IF v_taken >= v_cap THEN
    RAISE EXCEPTION 'SLOT_FULL'
      USING HINT = 'This time slot is already taken for this doctor.';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_appointments_slot_guard ON appointments;
CREATE TRIGGER trg_appointments_slot_guard
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION appointments_slot_guard();


-- ────────────────────────────────────────────────────────────
-- 7. Booking RPCs — schedule-window validation + named errors.
--    Capacity itself is enforced by the trigger above; these exist so the
--    UI can say WHY, and so a patient cannot book outside OPD hours.
-- ────────────────────────────────────────────────────────────

-- Raises unless p_at is a free, in-schedule, unblocked slot.
CREATE OR REPLACE FUNCTION assert_slot_bookable(p_doctor_staff_id UUID, p_at TIMESTAMPTZ)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_local TIMESTAMP := p_at AT TIME ZONE healio_tz();
  v_state TEXT;
BEGIN
  IF p_at <= NOW() THEN
    RAISE EXCEPTION 'SLOT_PAST' USING HINT = 'That time has already passed.';
  END IF;

  SELECT av.state INTO v_state
  FROM doctor_availability(p_doctor_staff_id, v_local::DATE, 1) av
  WHERE av.slot_at = p_at
  ORDER BY CASE av.state WHEN 'free' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_state IS NULL THEN
    RAISE EXCEPTION 'OUTSIDE_SCHEDULE' USING HINT = 'The doctor is not consulting at that time.';
  ELSIF v_state = 'leave' THEN
    RAISE EXCEPTION 'ON_LEAVE'     USING HINT = 'The doctor is on leave that day.';
  ELSIF v_state = 'blocked' THEN
    RAISE EXCEPTION 'SLOT_BLOCKED' USING HINT = 'That slot has been blocked by the doctor.';
  ELSIF v_state = 'full' THEN
    RAISE EXCEPTION 'SLOT_FULL'    USING HINT = 'This time slot is already taken for this doctor.';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION book_appointment_slot(
  p_doctor_staff_id  UUID,
  p_scheduled_at     TIMESTAMPTZ,
  p_type             TEXT    DEFAULT 'clinic',
  p_patient_id       UUID    DEFAULT NULL,
  p_family_member_id UUID    DEFAULT NULL,
  p_fee              NUMERIC DEFAULT NULL,
  p_platform_fee     NUMERIC DEFAULT 20,
  p_patient_notes    TEXT    DEFAULT NULL,
  p_rmp_id           UUID    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_patient UUID := COALESCE(p_patient_id, auth.uid());
  v_org     UUID;
  v_fee     NUMERIC(10,2);
  v_appt    UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORISED' USING HINT = 'Sign in to book an appointment.';
  END IF;

  SELECT s.organisation_id, COALESCE(p_fee, s.consultation_fee, o.consultation_fee, 0)
    INTO v_org, v_fee
  FROM staff s
  LEFT JOIN organisations o ON o.id = s.organisation_id
  WHERE s.id = p_doctor_staff_id AND s.role = 'doctor' AND s.status = 'active';

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'DOCTOR_NOT_FOUND' USING HINT = 'That doctor is not accepting appointments.';
  END IF;

  -- The caller must be the patient, the RMP booking for them, or org staff.
  IF NOT (
        v_patient = auth.uid()
     OR (p_rmp_id IS NOT NULL AND p_rmp_id = auth.uid())
     OR v_org = my_org_id()
     OR is_org_admin(v_org)
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORISED' USING HINT = 'You cannot book on behalf of this patient.';
  END IF;

  PERFORM assert_slot_bookable(p_doctor_staff_id, p_scheduled_at);

  INSERT INTO appointments (
    patient_id, family_member_id, doctor_staff_id, organisation_id,
    type, status, scheduled_at, fee, platform_fee, patient_notes, rmp_id
  ) VALUES (
    v_patient, p_family_member_id, p_doctor_staff_id, v_org,
    COALESCE(p_type, 'clinic')::appointment_type,
    'scheduled',
    p_scheduled_at,
    v_fee,
    COALESCE(p_platform_fee, 0),
    p_patient_notes,
    p_rmp_id
  )
  RETURNING id INTO v_appt;

  RETURN v_appt;
END;
$fn$;

REVOKE ALL ON FUNCTION book_appointment_slot(UUID, TIMESTAMPTZ, TEXT, UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION book_appointment_slot(UUID, TIMESTAMPTZ, TEXT, UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID) TO authenticated;


-- Reschedule / suggest-a-new-time, through the same validation.
CREATE OR REPLACE FUNCTION move_appointment_slot(
  p_appointment_id   UUID,
  p_scheduled_at     TIMESTAMPTZ,
  p_status           TEXT    DEFAULT NULL,
  p_count_reschedule BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_appt appointments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORISED' USING HINT = 'Sign in to change this appointment.';
  END IF;

  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_AUTHORISED' USING HINT = 'Appointment not found.';
  END IF;

  IF NOT (
        v_appt.patient_id = auth.uid()
     OR v_appt.rmp_id     = auth.uid()
     OR v_appt.doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
     OR v_appt.organisation_id = my_org_id()
     OR is_org_admin(v_appt.organisation_id)
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORISED' USING HINT = 'You cannot change this appointment.';
  END IF;

  PERFORM assert_slot_bookable(v_appt.doctor_staff_id, p_scheduled_at);

  UPDATE appointments
  SET scheduled_at     = p_scheduled_at,
      status           = COALESCE(p_status, status::TEXT)::appointment_status,
      reschedule_count = reschedule_count + CASE WHEN p_count_reschedule THEN 1 ELSE 0 END,
      updated_at       = NOW()
  WHERE id = p_appointment_id;

  RETURN p_appointment_id;
END;
$fn$;

REVOKE ALL ON FUNCTION move_appointment_slot(UUID, TIMESTAMPTZ, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION move_appointment_slot(UUID, TIMESTAMPTZ, TEXT, BOOLEAN) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 8. Appointments a schedule change has stranded.
--    When a doctor shrinks their hours we KEEP the bookings and flag them
--    rather than destroying a patient's appointment.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION doctor_schedule_conflicts(
  p_doctor_staff_id UUID,
  p_days            INT DEFAULT 60
)
RETURNS TABLE (
  appointment_id UUID,
  scheduled_at   TIMESTAMPTZ,
  patient_name   TEXT,
  reason         TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_tz   TEXT := healio_tz();
  v_days INT  := LEAST(GREATEST(COALESCE(p_days, 60), 1), 180);
BEGIN
  IF NOT can_manage_doctor_schedule(p_doctor_staff_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORISED' USING HINT = 'You cannot view this schedule.';
  END IF;

  RETURN QUERY
  SELECT a.id,
         a.scheduled_at,
         COALESCE(p.name, 'Patient'),
         CASE
           WHEN EXISTS (
             SELECT 1 FROM doctor_schedule_exceptions e
             WHERE e.doctor_staff_id = p_doctor_staff_id
               AND e.exception_date = (a.scheduled_at AT TIME ZONE v_tz)::DATE
               AND e.start_time IS NULL
           ) THEN 'leave'
           ELSE 'outside_schedule'
         END
  FROM appointments a
  LEFT JOIN profiles p ON p.id = a.patient_id
  WHERE a.doctor_staff_id = p_doctor_staff_id
    AND a.status IN ('scheduled', 'in_progress', 'suggested')
    AND a.scheduled_at >= NOW()
    AND a.scheduled_at <  NOW() + (v_days || ' days')::INTERVAL
    AND NOT EXISTS (
      SELECT 1
      FROM doctor_availability(
             p_doctor_staff_id,
             (a.scheduled_at AT TIME ZONE v_tz)::DATE,
             1
           ) av
      WHERE av.slot_at = a.scheduled_at
        AND av.state NOT IN ('leave', 'blocked')
    )
  ORDER BY a.scheduled_at;
END;
$fn$;

REVOKE ALL ON FUNCTION doctor_schedule_conflicts(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION doctor_schedule_conflicts(UUID, INT) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 9. Walk-ins keep their own RPC (no OPD-hours check — a walk-in is by
--    definition at the desk, now), but they no longer skip the capacity
--    lock: the trigger in §6 applies to this INSERT too.
--    Re-declared here so the fee falls back to the org default.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hospital_assign_doctor(
  p_patient      UUID,
  p_doctor_staff UUID,
  p_scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  p_type         TEXT DEFAULT 'clinic'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_org  UUID;
  v_fee  NUMERIC(10,2);
  v_appt UUID;
BEGIN
  v_org := my_org_id();
  IF v_org IS NULL THEN
    SELECT o.id INTO v_org FROM organisations o WHERE o.admin_user_id = auth.uid() LIMIT 1;
  END IF;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORISED' USING HINT = 'Only hospital staff can assign a doctor.';
  END IF;

  SELECT COALESCE(s.consultation_fee, o.consultation_fee, 0) INTO v_fee
  FROM staff s
  LEFT JOIN organisations o ON o.id = s.organisation_id
  WHERE s.id = p_doctor_staff
    AND s.organisation_id = v_org
    AND s.role = 'doctor'
    AND s.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOCTOR_NOT_FOUND' USING HINT = 'Doctor not found in your hospital.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM qr_checkins c
    WHERE c.patient_id = p_patient
      AND c.organisation_id = v_org
      AND c.created_at > NOW() - INTERVAL '24 hours'
  ) AND NOT EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.patient_id = p_patient
      AND a.organisation_id = v_org
  ) THEN
    RAISE EXCEPTION 'NOT_AUTHORISED' USING HINT = 'Patient has not checked in at your hospital.';
  END IF;

  INSERT INTO appointments (
    patient_id, doctor_staff_id, organisation_id,
    type, status, scheduled_at, fee, is_walkin
  ) VALUES (
    p_patient, p_doctor_staff, v_org,
    COALESCE(p_type, 'clinic')::appointment_type,
    'in_progress',
    COALESCE(p_scheduled_at, NOW()),
    v_fee,
    TRUE
  )
  RETURNING id INTO v_appt;

  UPDATE qr_checkins
  SET status = 'handled'
  WHERE patient_id = p_patient
    AND organisation_id = v_org
    AND status = 'new';

  RETURN v_appt;
END;
$fn$;

REVOKE ALL ON FUNCTION hospital_assign_doctor(UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hospital_assign_doctor(UUID, UUID, TIMESTAMPTZ, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 10. Close the RLS holes this feature depends on.
--     Both policies were USING-only. Without WITH CHECK a patient could
--     UPDATE their own row's scheduled_at to any value, and a doctor could
--     reassign an appointment to another doctor or org — either of which
--     walks straight past slot validation.
--     (The trigger in §6 still catches the capacity case; these stop the
--     row being moved somewhere it does not belong at all.)
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "appointments: patient cancels own scheduled" ON appointments;
CREATE POLICY "appointments: patient cancels own scheduled"
  ON appointments FOR UPDATE
  USING      (patient_id = auth.uid() AND status = 'scheduled')
  WITH CHECK (patient_id = auth.uid() AND status IN ('scheduled', 'cancelled'));

DROP POLICY IF EXISTS "appointments: doctor reads & updates assigned" ON appointments;
CREATE POLICY "appointments: doctor reads & updates assigned"
  ON appointments FOR ALL
  USING      (doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()))
  WITH CHECK (doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────
-- 11. Post-migration check (run manually — informational).
--     The trigger only guards NEW writes. If double-booked rows were
--     created before this migration they survive; this lists them so
--     they can be rescheduled by hand.
--
--   SELECT doctor_staff_id, scheduled_at, COUNT(*) AS bookings
--   FROM appointments
--   WHERE status IN ('scheduled','in_progress','suggested')
--   GROUP BY doctor_staff_id, scheduled_at
--   HAVING COUNT(*) > doctor_slot_capacity(doctor_staff_id, scheduled_at)
--   ORDER BY scheduled_at;
-- ────────────────────────────────────────────────────────────
