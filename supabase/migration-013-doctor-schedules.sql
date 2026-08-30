-- ============================================================
-- Migration 013 — doctor weekly schedules / OPD availability.
-- Run in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_schedules (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_staff_id  UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  days             TEXT[] NOT NULL DEFAULT '{}',     -- e.g. {Mon,Tue,Wed}
  start_time       TEXT NOT NULL DEFAULT '09:00',
  end_time         TEXT NOT NULL DEFAULT '17:00',
  slot_mins        INT  NOT NULL DEFAULT 15,
  department       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sched_doctor ON doctor_schedules(doctor_staff_id);
CREATE INDEX IF NOT EXISTS idx_sched_org    ON doctor_schedules(organisation_id);

ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;

-- Staff (and the hospital admin) can manage schedules for their own organisation.
DROP POLICY IF EXISTS "sched: org manages" ON doctor_schedules;
CREATE POLICY "sched: org manages"
  ON doctor_schedules FOR ALL
  USING (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  )
  WITH CHECK (
    organisation_id IN (SELECT organisation_id FROM staff WHERE user_id = auth.uid())
    OR organisation_id IN (SELECT id FROM organisations WHERE admin_user_id = auth.uid())
  );

-- Patients may read availability (read-only).
DROP POLICY IF EXISTS "sched: public read" ON doctor_schedules;
CREATE POLICY "sched: public read"
  ON doctor_schedules FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "sched: service role all" ON doctor_schedules;
CREATE POLICY "sched: service role all"
  ON doctor_schedules FOR ALL
  USING (auth.role() = 'service_role');

NOTIFY pgrst, 'reload schema';
