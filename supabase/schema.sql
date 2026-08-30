-- ============================================================
-- HEALIO PLATFORM — SUPABASE DATABASE SCHEMA
-- Version: 1.0.0
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New Query → paste → Run
--
-- COVERS:
--   • 27 tables across admin, provider, and patient apps
--   • Enums, indexes, foreign keys
--   • Auto-triggers (updated_at, wallet creation, org counts)
--   • Row Level Security (RLS) for all tables
--   • Seed data (feature flags, kill switches, service categories,
--     pricing rules, SLA rules)
-- ============================================================


-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ================================================================
-- ENUMS
-- ================================================================

CREATE TYPE org_type AS ENUM ('hospital', 'clinic', 'diagnostic', 'pharmacy');
CREATE TYPE org_status AS ENUM ('active', 'suspended', 'trial', 'pending');
CREATE TYPE subscription_tier AS ENUM ('starter', 'growth', 'enterprise');

CREATE TYPE staff_role AS ENUM (
  'doctor', 'opd_assistant', 'pharmacy_assistant',
  'nurse', 'receptionist', 'lab_technician', 'admin'
);
CREATE TYPE staff_status AS ENUM ('active', 'on_leave', 'inactive');

CREATE TYPE patient_status AS ENUM ('active', 'banned', 'inactive');

CREATE TYPE appointment_type AS ENUM ('clinic', 'video', 'homecare');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'processing',
  'out_for_delivery', 'ready', 'dispensed', 'completed', 'cancelled'
);

CREATE TYPE txn_type AS ENUM ('topup', 'payment', 'refund', 'subscription', 'wallet_adjustment');
CREATE TYPE txn_status AS ENUM ('completed', 'pending', 'failed');
CREATE TYPE payment_method AS ENUM ('wallet', 'upi', 'card', 'netbanking', 'cash');

CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE dispute_status AS ENUM ('open', 'resolved');
CREATE TYPE dispute_priority AS ENUM ('urgent', 'high', 'medium', 'low');

CREATE TYPE flag_app AS ENUM ('patient', 'provider', 'both');
CREATE TYPE onboarding_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE sub_admin_role AS ENUM ('support', 'finance', 'ops', 'content', 'regional', 'custom');
CREATE TYPE sub_admin_status AS ENUM ('active', 'inactive', 'expired');


-- ================================================================
-- 1. ORGANISATIONS  (Tenants — hospitals, clinics, labs, pharmacies)
-- ================================================================

CREATE TABLE organisations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  type             org_type NOT NULL DEFAULT 'hospital',
  city             TEXT NOT NULL,
  country          TEXT NOT NULL DEFAULT 'BD',
  address          TEXT,
  status           org_status NOT NULL DEFAULT 'pending',
  subscription     subscription_tier NOT NULL DEFAULT 'starter',

  -- The phone used here becomes the hospital admin's OTP login
  admin_phone      TEXT,
  admin_email      TEXT,
  -- Set after admin approves the onboarding application
  admin_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  provider_count   INT NOT NULL DEFAULT 0,
  patient_count    INT NOT NULL DEFAULT 0,
  mrr              NUMERIC(10,2) NOT NULL DEFAULT 0,
  logo_url         TEXT,
  beds             INT,
  departments      TEXT[],
  is_test          BOOLEAN NOT NULL DEFAULT FALSE,

  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orgs_status       ON organisations(status);
CREATE INDEX idx_orgs_admin_user   ON organisations(admin_user_id);
CREATE INDEX idx_orgs_admin_phone  ON organisations(admin_phone);


-- ================================================================
-- 2. ONBOARDING QUEUE  (Hospital signup applications)
-- ================================================================

CREATE TABLE onboarding_queue (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Linked after admin approves and creates the org
  organisation_id  UUID REFERENCES organisations(id) ON DELETE CASCADE,

  name             TEXT NOT NULL,
  type             org_type NOT NULL,
  city             TEXT NOT NULL,
  country          TEXT NOT NULL DEFAULT 'BD',
  -- This phone becomes the login credential on approval
  admin_phone      TEXT NOT NULL,
  admin_email      TEXT,
  contact_name     TEXT,
  address          TEXT,
  beds             INT,
  departments      TEXT[],
  documents        TEXT[],          -- ['Business License', 'Drug License', …]
  notes            TEXT,

  status           onboarding_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  applied_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID             -- sub_admin or platform admin user_id
);

CREATE INDEX idx_onboarding_status ON onboarding_queue(status);
CREATE INDEX idx_onboarding_phone  ON onboarding_queue(admin_phone);


-- ================================================================
-- 3. STAFF  (Doctors, OPD assistants, pharmacy assistants, etc.)
--    Belong to an organisation. Log in via phone OTP.
-- ================================================================

CREATE TABLE staff (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Human-readable ID generated on creation, e.g. DR-12345
  staff_id         TEXT UNIQUE NOT NULL,
  -- Set after first OTP login (Supabase auth.users link)
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  name             TEXT NOT NULL,
  role             staff_role NOT NULL,
  specialty        TEXT,            -- doctors only
  department       TEXT,
  shift            TEXT,
  phone            TEXT NOT NULL,   -- login credential
  email            TEXT,
  status           staff_status NOT NULL DEFAULT 'active',
  rating           NUMERIC(3,2) NOT NULL DEFAULT 0,
  verified_at      TIMESTAMPTZ,
  join_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  is_test          BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_staff_org    ON staff(organisation_id);
CREATE INDEX idx_staff_phone  ON staff(phone);
CREATE INDEX idx_staff_user   ON staff(user_id);
CREATE INDEX idx_staff_role   ON staff(role);
CREATE UNIQUE INDEX idx_staff_phone_unique ON staff(phone);


-- ================================================================
-- 4. PATIENT PROFILES  (Linked 1:1 to auth.users via phone OTP)
-- ================================================================

CREATE TABLE profiles (
  -- Same UUID as auth.users.id
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id  UUID REFERENCES organisations(id) ON DELETE SET NULL,

  name             TEXT,
  phone            TEXT UNIQUE,
  email            TEXT,
  avatar_url       TEXT,
  date_of_birth    DATE,
  gender           TEXT,
  blood_group      TEXT,
  allergies        TEXT[],
  conditions       TEXT[],          -- chronic conditions

  status           patient_status NOT NULL DEFAULT 'active',
  healio_plus      BOOLEAN NOT NULL DEFAULT FALSE,
  is_test          BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_org    ON profiles(organisation_id);
CREATE INDEX idx_profiles_phone  ON profiles(phone);
CREATE INDEX idx_profiles_status ON profiles(status);


-- ================================================================
-- 5. WALLETS  (One wallet per patient, auto-created on signup)
-- ================================================================

CREATE TABLE wallets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  balance     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallets_patient ON wallets(patient_id);

-- Admin credit/debit log
CREATE TABLE wallet_adjustments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  note         TEXT,
  adjusted_by  UUID,              -- sub_admin user_id
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallet_adj_patient ON wallet_adjustments(patient_id);


-- ================================================================
-- 6. SAVED ADDRESSES
-- ================================================================

CREATE TABLE saved_addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label       TEXT NOT NULL DEFAULT 'Home',
  address     TEXT NOT NULL,
  city        TEXT,
  pincode     TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addr_patient ON saved_addresses(patient_id);


-- ================================================================
-- 7. FAMILY PROFILES
-- ================================================================

CREATE TABLE family_profiles (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  relation       TEXT NOT NULL,
  date_of_birth  DATE,
  gender         TEXT,
  blood_group    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_owner ON family_profiles(owner_id);


-- ================================================================
-- 8. APPOINTMENTS
-- ================================================================

CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_staff_id  UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,

  type             appointment_type NOT NULL DEFAULT 'clinic',
  status           appointment_status NOT NULL DEFAULT 'scheduled',
  scheduled_at     TIMESTAMPTZ NOT NULL,
  fee              NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  token_no         INT,

  -- Patient-side
  patient_notes    TEXT,
  -- Doctor-side (filled after consult)
  doctor_notes     TEXT,

  is_walkin        BOOLEAN NOT NULL DEFAULT FALSE,
  is_test          BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_appts_patient   ON appointments(patient_id);
CREATE INDEX idx_appts_doctor    ON appointments(doctor_staff_id);
CREATE INDEX idx_appts_org       ON appointments(organisation_id);
CREATE INDEX idx_appts_status    ON appointments(status);
CREATE INDEX idx_appts_scheduled ON appointments(scheduled_at);


-- ================================================================
-- 9. PRESCRIPTIONS
-- ================================================================

CREATE TABLE prescriptions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id   UUID REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_staff_id  UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  organisation_id  UUID NOT NULL REFERENCES organisations(id),

  -- [{ name, dosage, frequency, duration, notes }]
  medicines        JSONB NOT NULL DEFAULT '[]',
  instructions     TEXT,
  valid_until      DATE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rx_patient     ON prescriptions(patient_id);
CREATE INDEX idx_rx_doctor      ON prescriptions(doctor_staff_id);
CREATE INDEX idx_rx_appointment ON prescriptions(appointment_id);


-- ================================================================
-- 10. HEALTH RECORDS
-- ================================================================

CREATE TABLE health_records (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,   -- 'lab_report','prescription','scan','discharge','other'
  title        TEXT NOT NULL,
  file_url     TEXT,
  notes        TEXT,
  recorded_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  uploaded_by  TEXT,            -- 'patient' | 'doctor' | 'lab'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_records_patient ON health_records(patient_id);


-- ================================================================
-- 11. PHARMACY ORDERS
-- ================================================================

CREATE TABLE pharmacy_orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         TEXT UNIQUE NOT NULL,
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prescription_id  UUID REFERENCES prescriptions(id) ON DELETE SET NULL,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,

  -- [{ name, brand, pack, quantity, unit_price }]
  items            JSONB NOT NULL DEFAULT '[]',
  delivery_address TEXT,
  delivery_slot    TEXT,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_fee     NUMERIC(10,2) NOT NULL DEFAULT 20,
  status           order_status NOT NULL DEFAULT 'pending',
  delivery_partner TEXT,
  is_test          BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pharmacy_patient ON pharmacy_orders(patient_id);
CREATE INDEX idx_pharmacy_org     ON pharmacy_orders(organisation_id);
CREATE INDEX idx_pharmacy_status  ON pharmacy_orders(status);


-- ================================================================
-- 12. LAB ORDERS
-- ================================================================

CREATE TABLE lab_orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         TEXT UNIQUE NOT NULL,
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,

  -- [{ name, price, turnaround }]
  tests            JSONB NOT NULL DEFAULT '[]',
  collection_type  TEXT NOT NULL DEFAULT 'walkin'
                   CHECK (collection_type IN ('walkin', 'home')),
  collection_address TEXT,
  scheduled_date   DATE NOT NULL,
  scheduled_time   TEXT NOT NULL,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  home_visit_fee   NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           order_status NOT NULL DEFAULT 'pending',
  report_url       TEXT,
  is_test          BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_patient ON lab_orders(patient_id);
CREATE INDEX idx_lab_org     ON lab_orders(organisation_id);
CREATE INDEX idx_lab_status  ON lab_orders(status);


-- ================================================================
-- 13. HOMECARE ORDERS
-- ================================================================

CREATE TABLE homecare_orders (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id         TEXT UNIQUE NOT NULL,
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,

  service_name     TEXT NOT NULL,
  scheduled_date   DATE NOT NULL,
  scheduled_time   TEXT NOT NULL,
  address          TEXT NOT NULL,
  notes            TEXT,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           order_status NOT NULL DEFAULT 'pending',
  assigned_staff   TEXT,
  is_test          BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_homecare_patient ON homecare_orders(patient_id);
CREATE INDEX idx_homecare_org     ON homecare_orders(organisation_id);
CREATE INDEX idx_homecare_status  ON homecare_orders(status);


-- ================================================================
-- 14. TRANSACTIONS  (Unified financial ledger)
-- ================================================================

CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  organisation_id  UUID REFERENCES organisations(id) ON DELETE SET NULL,
  type             txn_type NOT NULL,
  amount           NUMERIC(10,2) NOT NULL,
  status           txn_status NOT NULL DEFAULT 'pending',
  method           payment_method NOT NULL DEFAULT 'wallet',
  -- e.g. 'appointment', 'pharmacy_order', 'lab_order'
  reference_type   TEXT,
  reference_id     UUID,
  description      TEXT,
  is_test          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_txn_patient  ON transactions(patient_id);
CREATE INDEX idx_txn_org      ON transactions(organisation_id);
CREATE INDEX idx_txn_type     ON transactions(type);
CREATE INDEX idx_txn_status   ON transactions(status);
CREATE INDEX idx_txn_created  ON transactions(created_at DESC);


-- ================================================================
-- 15. REFUNDS
-- ================================================================

CREATE TABLE refunds (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_id    UUID REFERENCES transactions(id) ON DELETE SET NULL,
  organisation_id   UUID REFERENCES organisations(id) ON DELETE SET NULL,
  amount            NUMERIC(10,2) NOT NULL,
  reason            TEXT NOT NULL,
  status            refund_status NOT NULL DEFAULT 'pending',
  method            payment_method NOT NULL DEFAULT 'wallet',
  rejection_reason  TEXT,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID,           -- sub_admin user_id
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refunds_patient ON refunds(patient_id);
CREATE INDEX idx_refunds_status  ON refunds(status);


-- ================================================================
-- 16. DISPUTES
-- ================================================================

CREATE TABLE disputes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organisation_id  UUID REFERENCES organisations(id) ON DELETE SET NULL,
  subject          TEXT NOT NULL,
  category         TEXT NOT NULL,
  priority         dispute_priority NOT NULL DEFAULT 'medium',
  status           dispute_status NOT NULL DEFAULT 'open',
  assigned_to      UUID,            -- sub_admin user_id
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disputes_patient  ON disputes(patient_id);
CREATE INDEX idx_disputes_status   ON disputes(status);
CREATE INDEX idx_disputes_priority ON disputes(priority);

CREATE TABLE dispute_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id  UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  sent_by     TEXT NOT NULL CHECK (sent_by IN ('patient','admin','system')),
  sender_id   UUID,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dispute_msgs ON dispute_messages(dispute_id);


-- ================================================================
-- 17. AUDIT LOGS  (Every admin action recorded)
-- ================================================================

CREATE TABLE audit_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_name       TEXT NOT NULL,
  admin_role       TEXT NOT NULL,
  admin_user_id    UUID,
  action           TEXT NOT NULL,
  module           TEXT NOT NULL,
  target           TEXT NOT NULL,
  organisation_id  UUID REFERENCES organisations(id) ON DELETE SET NULL,
  org_name         TEXT,
  ip_address       TEXT,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_admin   ON audit_logs(admin_user_id);
CREATE INDEX idx_audit_module  ON audit_logs(module);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);


-- ================================================================
-- 18. FEATURE FLAGS
-- ================================================================

CREATE TABLE feature_flags (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT UNIQUE NOT NULL,
  description     TEXT,
  app             flag_app NOT NULL DEFAULT 'both',
  category        TEXT NOT NULL DEFAULT 'General',
  enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percent INT NOT NULL DEFAULT 0
                  CHECK (rollout_percent BETWEEN 0 AND 100),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT
);

-- Per-organisation overrides for feature flags
CREATE TABLE feature_flag_org_overrides (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flag_id          UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  enabled          BOOLEAN NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(flag_id, organisation_id)
);


-- ================================================================
-- 19. KILL SWITCHES  (Emergency master toggles)
-- ================================================================

CREATE TABLE kill_switches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT UNIQUE NOT NULL,
  description  TEXT,
  category     TEXT NOT NULL DEFAULT 'General',
  enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  last_toggled TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  toggled_by   TEXT
);


-- ================================================================
-- 20. SERVICE CATEGORIES  (Patient app home screen tiles)
-- ================================================================

CREATE TABLE service_categories (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name           TEXT UNIQUE NOT NULL,
  icon           TEXT NOT NULL,
  description    TEXT,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  display_order  INT NOT NULL DEFAULT 0,
  app            TEXT NOT NULL DEFAULT 'patient',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ================================================================
-- 21. PRICING RULES
-- ================================================================

CREATE TABLE pricing_rules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service      TEXT NOT NULL,
  type         TEXT NOT NULL,    -- 'appointment','homecare','lab','subscription'
  base_price   NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pricing_org_overrides (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id          UUID NOT NULL REFERENCES pricing_rules(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  price            NUMERIC(10,2) NOT NULL,
  UNIQUE(rule_id, organisation_id)
);


-- ================================================================
-- 22. BANNERS  (In-app promotional banners)
-- ================================================================

CREATE TABLE banners (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  subtitle    TEXT,
  app         TEXT NOT NULL DEFAULT 'patient'
              CHECK (app IN ('patient','provider','both')),
  position    TEXT NOT NULL DEFAULT 'home_top',
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  start_date  DATE,
  end_date    DATE,
  bg_color    TEXT NOT NULL DEFAULT '#821c03',
  action_url  TEXT,
  clicks      INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ================================================================
-- 23. PUSH NOTIFICATIONS HISTORY
-- ================================================================

CREATE TABLE push_notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  audience   TEXT NOT NULL,
  sent_by    UUID,
  delivered  INT NOT NULL DEFAULT 0,
  opened     INT NOT NULL DEFAULT 0,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ================================================================
-- 24. SLA RULES & ESCALATIONS
-- ================================================================

CREATE TABLE sla_rules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  threshold   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'healthy'
              CHECK (status IN ('healthy','warning','breach')),
  compliance  INT NOT NULL DEFAULT 100
              CHECK (compliance BETWEEN 0 AND 100)
);

CREATE TABLE sla_escalations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id       UUID REFERENCES sla_rules(id) ON DELETE SET NULL,
  breach_target TEXT NOT NULL,
  org_name      TEXT,
  note          TEXT,
  escalated_by  UUID,
  escalated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ================================================================
-- 25. SUB-ADMINS  (Admin portal internal team)
-- ================================================================

CREATE TABLE sub_admins (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  role          sub_admin_role NOT NULL DEFAULT 'support',
  scope         TEXT NOT NULL DEFAULT 'platform'
                CHECK (scope IN ('platform','org')),
  org_ids       UUID[],
  permissions   JSONB NOT NULL DEFAULT '{}',
  status        sub_admin_status NOT NULL DEFAULT 'active',
  expires_at    TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sub_admins_email  ON sub_admins(email);
CREATE INDEX idx_sub_admins_status ON sub_admins(status);


-- ================================================================
-- AUTO-TRIGGER: Keep updated_at current
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table that has updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organisations','profiles','wallets','appointments',
    'pharmacy_orders','lab_orders','homecare_orders',
    'disputes','service_categories','pricing_rules','banners'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()',
      t, t
    );
  END LOOP;
END $$;


-- ================================================================
-- AUTO-TRIGGER: Create wallet when a new patient profile is created
-- ================================================================

CREATE OR REPLACE FUNCTION create_wallet_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (patient_id, balance) VALUES (NEW.id, 0)
  ON CONFLICT (patient_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_wallet
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_wallet_on_signup();


-- ================================================================
-- AUTO-TRIGGER: Keep provider_count in sync on staff changes
-- ================================================================

CREATE OR REPLACE FUNCTION sync_org_provider_count()
RETURNS TRIGGER AS $$
DECLARE
  target_org_id UUID;
BEGIN
  -- Figure out which org changed
  target_org_id := COALESCE(NEW.organisation_id, OLD.organisation_id);
  UPDATE organisations SET
    provider_count = (
      SELECT COUNT(*) FROM staff
      WHERE organisation_id = target_org_id AND status = 'active'
    ),
    updated_at = NOW()
  WHERE id = target_org_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_count
  AFTER INSERT OR UPDATE OR DELETE ON staff
  FOR EACH ROW EXECUTE FUNCTION sync_org_provider_count();


-- ================================================================
-- AUTO-TRIGGER: Generate order IDs with prefix
-- ================================================================

CREATE OR REPLACE FUNCTION generate_order_id(prefix TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN prefix || '-' || LPAD(FLOOR(RANDOM() * 99999 + 10000)::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_pharmacy_order_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NULL OR NEW.order_id = '' THEN
    NEW.order_id := generate_order_id('PH');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_lab_order_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NULL OR NEW.order_id = '' THEN
    NEW.order_id := generate_order_id('LB');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_homecare_order_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NULL OR NEW.order_id = '' THEN
    NEW.order_id := generate_order_id('HC');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pharmacy_order_id BEFORE INSERT ON pharmacy_orders FOR EACH ROW EXECUTE FUNCTION set_pharmacy_order_id();
CREATE TRIGGER trg_lab_order_id      BEFORE INSERT ON lab_orders       FOR EACH ROW EXECUTE FUNCTION set_lab_order_id();
CREATE TRIGGER trg_homecare_order_id BEFORE INSERT ON homecare_orders  FOR EACH ROW EXECUTE FUNCTION set_homecare_order_id();


-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- Every table is locked down. Service role (admin portal) bypasses all.
-- ================================================================

-- Enable RLS
ALTER TABLE organisations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_queue           ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_adjustments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_addresses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records             ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE homecare_orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_org_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE kill_switches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_rules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_org_overrides      ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_admins                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_rules                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_escalations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications         ENABLE ROW LEVEL SECURITY;


-- ── Helper: is this user a hospital admin for a given org? ────────────────────
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organisations
    WHERE id = org_id AND admin_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Helper: get the org_id for a staff member ─────────────────────────────────
CREATE OR REPLACE FUNCTION my_org_id()
RETURNS UUID AS $$
  SELECT organisation_id FROM staff WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER;


-- ── ORGANISATIONS ─────────────────────────────────────────────────────────────

CREATE POLICY "orgs: admin reads own"
  ON organisations FOR SELECT
  USING (admin_user_id = auth.uid());

CREATE POLICY "orgs: admin updates own"
  ON organisations FOR UPDATE
  USING (admin_user_id = auth.uid());

CREATE POLICY "orgs: staff reads own org"
  ON organisations FOR SELECT
  USING (id = my_org_id());

CREATE POLICY "orgs: service role all"
  ON organisations FOR ALL
  USING (auth.role() = 'service_role');


-- ── ONBOARDING QUEUE ──────────────────────────────────────────────────────────

-- Public insert (hospital submits before they have auth)
CREATE POLICY "onboarding: anyone can apply"
  ON onboarding_queue FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "onboarding: service role all"
  ON onboarding_queue FOR ALL
  USING (auth.role() = 'service_role');


-- ── STAFF ─────────────────────────────────────────────────────────────────────

CREATE POLICY "staff: reads own profile"
  ON staff FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "staff: reads org colleagues"
  ON staff FOR SELECT
  USING (organisation_id = my_org_id());

CREATE POLICY "staff: org admin manages own"
  ON staff FOR ALL
  USING (is_org_admin(organisation_id));

CREATE POLICY "staff: service role all"
  ON staff FOR ALL
  USING (auth.role() = 'service_role');


-- ── PROFILES ─────────────────────────────────────────────────────────────────

CREATE POLICY "profiles: patient manages own"
  ON profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles: staff reads org patients"
  ON profiles FOR SELECT
  USING (organisation_id = my_org_id());

CREATE POLICY "profiles: org admin reads own org"
  ON profiles FOR SELECT
  USING (is_org_admin(organisation_id));

CREATE POLICY "profiles: service role all"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');


-- ── WALLETS ───────────────────────────────────────────────────────────────────

CREATE POLICY "wallets: patient reads own"
  ON wallets FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "wallets: patient updates own"
  ON wallets FOR UPDATE
  USING (patient_id = auth.uid());

CREATE POLICY "wallets: service role all"
  ON wallets FOR ALL
  USING (auth.role() = 'service_role');


-- ── WALLET ADJUSTMENTS ───────────────────────────────────────────────────────

CREATE POLICY "wallet_adj: patient reads own"
  ON wallet_adjustments FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "wallet_adj: service role all"
  ON wallet_adjustments FOR ALL
  USING (auth.role() = 'service_role');


-- ── SAVED ADDRESSES & FAMILY ─────────────────────────────────────────────────

CREATE POLICY "saved_addresses: patient manages own"
  ON saved_addresses FOR ALL
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "family_profiles: patient manages own"
  ON family_profiles FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());


-- ── APPOINTMENTS ──────────────────────────────────────────────────────────────

CREATE POLICY "appointments: patient reads own"
  ON appointments FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "appointments: patient creates"
  ON appointments FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "appointments: patient cancels own scheduled"
  ON appointments FOR UPDATE
  USING (patient_id = auth.uid() AND status = 'scheduled');

CREATE POLICY "appointments: doctor reads & updates assigned"
  ON appointments FOR ALL
  USING (
    doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "appointments: org admin reads all in org"
  ON appointments FOR SELECT
  USING (is_org_admin(organisation_id));

CREATE POLICY "appointments: org admin updates"
  ON appointments FOR UPDATE
  USING (is_org_admin(organisation_id));

CREATE POLICY "appointments: service role all"
  ON appointments FOR ALL
  USING (auth.role() = 'service_role');


-- ── PRESCRIPTIONS ─────────────────────────────────────────────────────────────

CREATE POLICY "rx: patient reads own"
  ON prescriptions FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "rx: doctor creates & reads"
  ON prescriptions FOR ALL
  USING (
    doctor_staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid())
  );

CREATE POLICY "rx: service role all"
  ON prescriptions FOR ALL
  USING (auth.role() = 'service_role');


-- ── HEALTH RECORDS ────────────────────────────────────────────────────────────

CREATE POLICY "records: patient manages own"
  ON health_records FOR ALL
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "records: service role all"
  ON health_records FOR ALL
  USING (auth.role() = 'service_role');


-- ── PHARMACY ORDERS ───────────────────────────────────────────────────────────

CREATE POLICY "pharmacy: patient reads own"
  ON pharmacy_orders FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "pharmacy: patient creates"
  ON pharmacy_orders FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "pharmacy: staff reads & updates org orders"
  ON pharmacy_orders FOR ALL
  USING (organisation_id = my_org_id());

CREATE POLICY "pharmacy: service role all"
  ON pharmacy_orders FOR ALL
  USING (auth.role() = 'service_role');


-- ── LAB ORDERS ───────────────────────────────────────────────────────────────

CREATE POLICY "lab: patient reads own"
  ON lab_orders FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "lab: patient creates"
  ON lab_orders FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "lab: staff reads & updates org orders"
  ON lab_orders FOR ALL
  USING (organisation_id = my_org_id());

CREATE POLICY "lab: service role all"
  ON lab_orders FOR ALL
  USING (auth.role() = 'service_role');


-- ── HOMECARE ORDERS ───────────────────────────────────────────────────────────

CREATE POLICY "homecare: patient reads own"
  ON homecare_orders FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "homecare: patient creates"
  ON homecare_orders FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "homecare: staff reads & updates org orders"
  ON homecare_orders FOR ALL
  USING (organisation_id = my_org_id());

CREATE POLICY "homecare: service role all"
  ON homecare_orders FOR ALL
  USING (auth.role() = 'service_role');


-- ── TRANSACTIONS ──────────────────────────────────────────────────────────────

CREATE POLICY "txn: patient reads own"
  ON transactions FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "txn: patient creates"
  ON transactions FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "txn: service role all"
  ON transactions FOR ALL
  USING (auth.role() = 'service_role');


-- ── REFUNDS ───────────────────────────────────────────────────────────────────

CREATE POLICY "refunds: patient reads own"
  ON refunds FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "refunds: patient creates"
  ON refunds FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "refunds: service role all"
  ON refunds FOR ALL
  USING (auth.role() = 'service_role');


-- ── DISPUTES ─────────────────────────────────────────────────────────────────

CREATE POLICY "disputes: patient reads own"
  ON disputes FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY "disputes: patient creates"
  ON disputes FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY "disputes: service role all"
  ON disputes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "dispute_msgs: patient reads own"
  ON dispute_messages FOR SELECT
  USING (
    dispute_id IN (SELECT id FROM disputes WHERE patient_id = auth.uid())
  );

CREATE POLICY "dispute_msgs: service role all"
  ON dispute_messages FOR ALL
  USING (auth.role() = 'service_role');


-- ── AUDIT LOGS ────────────────────────────────────────────────────────────────

-- Only service role writes. Sub-admins read via service role in admin portal.
CREATE POLICY "audit_logs: service role all"
  ON audit_logs FOR ALL
  USING (auth.role() = 'service_role');


-- ── FEATURE FLAGS  (Read by all authenticated apps) ───────────────────────────

CREATE POLICY "flags: authenticated reads"
  ON feature_flags FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "flags: service role all"
  ON feature_flags FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "flag_overrides: authenticated reads"
  ON feature_flag_org_overrides FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "flag_overrides: service role all"
  ON feature_flag_org_overrides FOR ALL
  USING (auth.role() = 'service_role');


-- ── KILL SWITCHES ─────────────────────────────────────────────────────────────

CREATE POLICY "kill_switches: authenticated reads"
  ON kill_switches FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "kill_switches: service role all"
  ON kill_switches FOR ALL
  USING (auth.role() = 'service_role');


-- ── SERVICE CATEGORIES ───────────────────────────────────────────────────────

CREATE POLICY "service_cats: authenticated reads enabled"
  ON service_categories FOR SELECT
  USING (auth.role() = 'authenticated' AND enabled = TRUE);

CREATE POLICY "service_cats: service role all"
  ON service_categories FOR ALL
  USING (auth.role() = 'service_role');


-- ── PRICING ───────────────────────────────────────────────────────────────────

CREATE POLICY "pricing: authenticated reads"
  ON pricing_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "pricing: service role all"
  ON pricing_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "pricing_overrides: authenticated reads"
  ON pricing_org_overrides FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "pricing_overrides: service role all"
  ON pricing_org_overrides FOR ALL
  USING (auth.role() = 'service_role');


-- ── BANNERS ───────────────────────────────────────────────────────────────────

CREATE POLICY "banners: authenticated reads live"
  ON banners FOR SELECT
  USING (auth.role() = 'authenticated' AND enabled = TRUE);

CREATE POLICY "banners: service role all"
  ON banners FOR ALL
  USING (auth.role() = 'service_role');


-- ── SLA ───────────────────────────────────────────────────────────────────────

CREATE POLICY "sla_rules: authenticated reads"
  ON sla_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "sla_rules: service role all"
  ON sla_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "sla_escalations: service role all"
  ON sla_escalations FOR ALL
  USING (auth.role() = 'service_role');


-- ── SUB-ADMINS ────────────────────────────────────────────────────────────────

CREATE POLICY "sub_admins: reads own"
  ON sub_admins FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "sub_admins: service role all"
  ON sub_admins FOR ALL
  USING (auth.role() = 'service_role');


-- ── PUSH NOTIFICATIONS ────────────────────────────────────────────────────────

CREATE POLICY "push_notifs: service role all"
  ON push_notifications FOR ALL
  USING (auth.role() = 'service_role');


-- ================================================================
-- SEED DATA
-- Populates default platform configuration
-- ================================================================

-- Feature flags
INSERT INTO feature_flags (name, description, app, category, enabled, rollout_percent, updated_by) VALUES
  ('Book Appointment',    'Allow patients to book appointments',       'patient',  'Booking',       TRUE,  100, 'system'),
  ('Video Consultation',  'In-app video calls with doctors',           'both',     'Booking',       FALSE,   0, 'system'),
  ('Wallet Top-up',       'Allow patients to add money to wallet',     'patient',  'Payments',      TRUE,  100, 'system'),
  ('Card Payments',       'Credit/Debit card payment method',          'both',     'Payments',      FALSE,   0, 'system'),
  ('Home Care Orders',    'Book home visit services',                  'patient',  'Services',      TRUE,   65, 'system'),
  ('Lab Orders',          'Order lab tests from app',                  'patient',  'Services',      TRUE,  100, 'system'),
  ('Prescriptions',       'Provider prescription creation',            'provider', 'Clinical',      TRUE,  100, 'system'),
  ('Staff Management',    'Hospital staff management module',          'provider', 'Management',    TRUE,  100, 'system'),
  ('Healio Plus',         'Premium subscription paywall',              'patient',  'Payments',      TRUE,  100, 'system'),
  ('Chat with Doctor',    'In-app messaging between patient/provider', 'both',     'Communication', TRUE,   80, 'system');

-- Kill switches
INSERT INTO kill_switches (name, description, category, enabled) VALUES
  ('All Systems',         'Master switch — disables all app functionality',    'Critical',      TRUE),
  ('Video Consultations', 'Disable video calling across both apps',            'Communication', TRUE),
  ('Card Payments',       'Disable credit/debit card payment method',          'Payments',      TRUE),
  ('Wallet Top-ups',      'Disable wallet recharge for all patients',          'Payments',      TRUE),
  ('Lab Orders',          'Disable lab test booking from patient app',         'Services',      TRUE),
  ('Pharmacy Orders',     'Disable medicine ordering from patient app',        'Services',      TRUE),
  ('Home Care Booking',   'Disable home visit service booking',                'Services',      TRUE),
  ('Chat Messaging',      'Disable in-app chat between patients/providers',    'Communication', TRUE),
  ('New Registrations',   'Block new patient and provider signups',            'Critical',      TRUE),
  ('Appointment Booking', 'Disable appointment booking across all orgs',       'Services',      TRUE);

-- Service categories
INSERT INTO service_categories (name, icon, description, enabled, display_order) VALUES
  ('Doctors',   'person-add',   'Find and book doctors',    TRUE,  1),
  ('Hospitals', 'business',     'Browse nearby hospitals',  TRUE,  2),
  ('Medicine',  'medkit',       'Order medicines online',   TRUE,  3),
  ('Labs',      'flask',        'Book lab tests',           TRUE,  4),
  ('Home Care', 'home',         'Book home visit services', TRUE,  5),
  ('Emergency', 'alert-circle', 'Emergency services',       TRUE,  6),
  ('Ambulance', 'car',          'Request ambulance',        FALSE, 7),
  ('Insurance', 'shield',       'Health insurance plans',   FALSE, 8);

-- Pricing rules
INSERT INTO pricing_rules (service, type, base_price, platform_fee) VALUES
  ('General Consultation',     'appointment',  300, 20),
  ('Specialist Consultation',  'appointment',  500, 30),
  ('Video Consultation',       'appointment',  250, 20),
  ('Home Visit',               'homecare',     500, 50),
  ('Nurse Visit',              'homecare',     350, 30),
  ('CBC Test',                 'lab',          150, 15),
  ('Thyroid Panel',            'lab',          350, 25),
  ('Healio Plus Subscription', 'subscription', 499,  0);

-- SLA rules
INSERT INTO sla_rules (name, threshold, status, compliance) VALUES
  ('Appointment Wait Time',  '< 15 min',   'healthy', 94),
  ('Pharmacy Delivery Time', '< 60 min',   'healthy', 87),
  ('Lab Report Turnaround',  '< 48 hours', 'healthy', 91),
  ('Home Care Response',     '< 2 hours',  'warning', 82),
  ('Dispute Resolution',     '< 24 hours', 'breach',  68),
  ('Refund Processing',      '< 72 hours', 'healthy', 95);

-- Initial banners
INSERT INTO banners (title, subtitle, app, position, enabled, start_date, end_date, bg_color) VALUES
  ('Healio Plus — Get 20% off',   'Subscribe now and unlock premium features', 'patient',  'home_top', TRUE, '2026-05-01', '2026-06-30', '#821c03'),
  ('Activate Subscription',        'Unlock all provider features',              'provider', 'home_top', TRUE, '2026-05-01', '2026-12-31', '#821c03');


-- ================================================================
-- DONE
-- Schema created successfully.
--
-- NEXT STEPS:
--   1. In Supabase Dashboard → Authentication → Settings:
--      • Enable Phone OTP (for patients and staff login)
--      • Enable Email (for admin portal login)
--
--   2. In Supabase Dashboard → Authentication → URL Configuration:
--      • Set Site URL to your admin portal URL
--
--   3. Add to healio-admin/.env.local:
--      NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
--      NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
--      SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  ← for admin portal
--
--   4. Add to mobile apps (src/services/env.js / src/lib/env.js):
--      SUPABASE_URL=https://your-project.supabase.co
--      SUPABASE_ANON_KEY=your-anon-key
--
--   5. The admin portal uses the SERVICE ROLE KEY (bypasses RLS).
--      The mobile apps use the ANON KEY (RLS enforced).
-- ================================================================
