-- ============================================================
-- Migration 050 — independent labs & pharmacies can WRITE their own orders.
--
-- An independent provider is its own organisations row (type 'diagnostic' or
-- 'pharmacy') whose operator is organisations.admin_user_id. They have NO staff
-- row, because approveOnboarding() only ever creates the organisation and
-- migration-040 links admin_user_id by phone at first login.
--
-- my_org_id() (schema.sql:884) resolves via the staff table only, so the
-- "staff reads & updates org orders" policies (schema.sql:1071 / :1090) never
-- match them. migration-004 (:15-21) granted org admins SELECT only. Net effect
-- today: an independent provider can read their queue but cannot create a quote,
-- advance an order or attach a report — every write fails with 42501.
--
-- Same shape as the payouts policy in migration-034 (:28-31). RLS policies are
-- permissive and OR-ed together, so this only ADDS access; nothing that works
-- today changes. The SELECT-only policies from migration-004 can stay as they are.
--
-- Run in Supabase SQL Editor (after migration 043).
-- ============================================================

DROP POLICY IF EXISTS "lab: org admin writes" ON lab_orders;
CREATE POLICY "lab: org admin writes"
  ON lab_orders FOR ALL
  USING      (is_org_admin(organisation_id))
  WITH CHECK (is_org_admin(organisation_id));

DROP POLICY IF EXISTS "pharmacy: org admin writes" ON pharmacy_orders;
CREATE POLICY "pharmacy: org admin writes"
  ON pharmacy_orders FOR ALL
  USING      (is_org_admin(organisation_id))
  WITH CHECK (is_org_admin(organisation_id));

NOTIFY pgrst, 'reload schema';
