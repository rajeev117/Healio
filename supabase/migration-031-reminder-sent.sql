-- ============================================================
-- Migration 031 — appointments.reminder_sent (overdue-confirmation reminder).
--
-- healio-provider-mobile already reads/writes this column (src/lib/store.js,
-- src/screens/Appointments.js's realtime handler shows a "patient still
-- waiting for confirmation" banner when it flips true) and expects a
-- pg_cron job to flip it — but the column was never created, which makes
-- the provider app's appointments query fail outright with:
--   42703  column appointments.reminder_sent does not exist
--
-- This adds the column and the cron job that was always intended to drive it.
--
-- Run in Supabase SQL Editor (after migration 030).
-- ============================================================

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Reset the flag whenever a pending appointment is rescheduled, so the
-- 30-minute reminder cycle can fire again for the new wait instead of
-- staying silently "already sent" forever.
CREATE OR REPLACE FUNCTION reset_reminder_sent_on_reschedule()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'scheduled' AND (OLD.status IS DISTINCT FROM 'scheduled' OR NEW.reschedule_count > OLD.reschedule_count) THEN
    NEW.reminder_sent := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_reminder_sent ON appointments;
CREATE TRIGGER trg_reset_reminder_sent
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION reset_reminder_sent_on_reschedule();

-- ── pg_cron job: every 5 minutes, flag appointments that have been sitting
-- in 'scheduled' (pending provider confirmation) for 30+ minutes. ──────────
-- NOTE: requires the pg_cron extension. If CREATE EXTENSION fails with a
-- permissions error, enable it from the Supabase Dashboard →
-- Database → Extensions → search "pg_cron" → Enable, then re-run just the
-- block below.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent: drop any previous run of this job before (re)scheduling, since
-- older pg_cron versions error on a duplicate job name instead of updating.
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'flag-overdue-appointment-reminders';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'flag-overdue-appointment-reminders',
  '*/5 * * * *',
  $$
    UPDATE appointments
    SET reminder_sent = TRUE
    WHERE status = 'scheduled'
      AND reminder_sent = FALSE
      AND created_at < NOW() - INTERVAL '30 minutes'
  $$
);

NOTIFY pgrst, 'reload schema';
