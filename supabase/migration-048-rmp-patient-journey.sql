-- ============================================================
-- Migration 048 — RMP live patient-journey + documents.
--
-- When a Healthcare Consultant (RMP) books on a patient's behalf, they should
-- be able to follow that visit: Arrived (patient scanned the hospital QR) →
-- Checked In (with the doctor) → Completed, and see the documents produced —
-- the doctor's prescription, and any lab / pharmacy bills or reports.
--
-- RLS scopes qr_checkins / health_records / lab_orders to the patient and the
-- org — the RMP is neither. This one SECURITY DEFINER RPC returns exactly that
-- visit's status + documents, gated so the caller must be the RMP who booked
-- the appointment (rmps.id = auth.users.id, so appointments.rmp_id = auth.uid()).
--
-- Documents are scoped to the appointment's patient AND hospital. health_records
-- already aggregates prescriptions ('prescription'), lab reports ('lab_result')
-- and pharmacy bills ('pharmacy_bill'); the lab BILL lives only on
-- lab_orders.bill_url, so it's unioned in separately.
--
-- Run in Supabase SQL Editor (after migration 047).
-- ============================================================

CREATE OR REPLACE FUNCTION rmp_patient_journey(p_appointment UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_appt       RECORD;
  v_arrived    TIMESTAMPTZ;
  v_checked_in TIMESTAMPTZ;
  v_docs       JSONB;
BEGIN
  -- Load the appointment + verify the caller is the RMP who booked it.
  SELECT a.id, a.patient_id, a.organisation_id, a.doctor_staff_id,
         a.status, a.scheduled_at,
         p.name AS patient_name,
         s.name AS doctor_name,
         o.name AS hospital_name
  INTO v_appt
  FROM appointments a
  LEFT JOIN profiles p      ON p.id = a.patient_id
  LEFT JOIN staff s         ON s.id = a.doctor_staff_id
  LEFT JOIN organisations o ON o.id = a.organisation_id
  WHERE a.id = p_appointment
    AND a.rmp_id = auth.uid();          -- consent gate
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorised for this booking';
  END IF;

  -- Arrived: earliest check-in at this appointment's hospital.
  SELECT MIN(c.created_at) INTO v_arrived
  FROM qr_checkins c
  WHERE c.patient_id = v_appt.patient_id
    AND c.organisation_id = v_appt.organisation_id;

  -- Checked in with the doctor: earliest 'doctor' check-in at this hospital
  -- (for this doctor when known).
  SELECT MIN(c.created_at) INTO v_checked_in
  FROM qr_checkins c
  WHERE c.patient_id = v_appt.patient_id
    AND c.organisation_id = v_appt.organisation_id
    AND c.kind = 'doctor'
    AND (v_appt.doctor_staff_id IS NULL OR c.doctor_staff_id = v_appt.doctor_staff_id);

  -- Documents for this patient at this hospital.
  SELECT COALESCE(jsonb_agg(d ORDER BY (d->>'date') DESC), '[]'::jsonb) INTO v_docs
  FROM (
    SELECT jsonb_build_object(
             'kind',  hr.type,
             'title', hr.title,
             'url',   hr.file_url,
             'date',  hr.created_at
           ) AS d
    FROM health_records hr
    WHERE hr.patient_id = v_appt.patient_id
      AND hr.organisation_id = v_appt.organisation_id
      AND hr.file_url IS NOT NULL

    UNION ALL

    SELECT jsonb_build_object(
             'kind',  'lab_bill',
             'title', 'Lab Bill',
             'url',   lo.bill_url,
             'date',  lo.created_at
           )
    FROM lab_orders lo
    WHERE lo.patient_id = v_appt.patient_id
      AND lo.organisation_id = v_appt.organisation_id
      AND lo.bill_url IS NOT NULL
  ) docs;

  RETURN jsonb_build_object(
    'appointmentId', v_appt.id,
    'status',        v_appt.status,
    'scheduledAt',   v_appt.scheduled_at,
    'patientName',   v_appt.patient_name,
    'doctorName',    v_appt.doctor_name,
    'hospitalName',  v_appt.hospital_name,
    'arrivedAt',     v_arrived,
    'checkedInAt',   v_checked_in,
    'documents',     v_docs
  );
END;
$$;

REVOKE ALL ON FUNCTION rmp_patient_journey(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rmp_patient_journey(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
