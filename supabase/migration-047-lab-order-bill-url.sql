-- Lab checkout now captures two separate documents:
--   • bill_url    — the receipt the lab hands the patient (internal record)
--   • report_url  — the actual test result, mirrored into health_records
-- Previously the bill was stored in report_url; give it its own column so the
-- report column can hold the real report.
ALTER TABLE lab_orders ADD COLUMN IF NOT EXISTS bill_url TEXT;
