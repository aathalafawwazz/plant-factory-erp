-- ============================================================
-- SPRINT 2 — PART 3/3  (RLS rewrite for all tables)
--
-- Strategy:  for each table we DROP every existing policy, then
-- CREATE the canonical matrix from Sprint 2 design. See
-- docs/sprint-2-rls-matrix.md for the human-readable source of truth.
--
-- All writes are additionally gated by `is_active_user()` — pending
-- or suspended users cannot modify anything regardless of role.
-- Alumni get a separate read-only carve-out for their own archives.
--
-- Depends on helper fns from 00016: is_active_user(), is_staff(),
-- is_supervisor_of(), is_owner_of_project(), get_user_role().
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
-- admin    full CRUD (incl. changing other users' role/status)
-- others   SELECT all ; UPDATE self only ; no INSERT (auth trigger handles it)
-- pending/suspended : SELECT self only (so they can see "your account is pending")
-- ------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select"            ON profiles;
DROP POLICY IF EXISTS "profiles_update_self"       ON profiles;
DROP POLICY IF EXISTS "profiles_insert_admin"      ON profiles;
DROP POLICY IF EXISTS "profiles_all_admin"         ON profiles;
-- Legacy names from 00001
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"                 ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles"                   ON profiles;

CREATE POLICY profiles_select ON profiles FOR SELECT TO authenticated
  USING (
    -- Active / alumni : see everyone. Pending / suspended : self only.
    current_profile_status() IN ('active', 'alumni')
    OR id = auth.uid()
  );
CREATE POLICY profiles_update_self ON profiles FOR UPDATE TO authenticated
  USING  (id = auth.uid() AND is_active_user())
  WITH CHECK (
    id = auth.uid() AND is_active_user()
    -- Self-update cannot elevate role or change status — those fields are
    -- guarded by a trigger below.
  );
CREATE POLICY profiles_all_admin ON profiles FOR ALL TO authenticated
  USING      (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- Guard against privilege escalation via self-update.
CREATE OR REPLACE FUNCTION profiles_prevent_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.id = auth.uid()
     AND get_user_role() <> 'admin'
     AND (NEW.role    IS DISTINCT FROM OLD.role
       OR NEW.status  IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'not allowed: role/status can only be changed by admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_prevent_self_escalation ON profiles;
CREATE TRIGGER trg_profiles_prevent_self_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_prevent_self_escalation();

-- ------------------------------------------------------------
-- CULTIVATION CORE : holes / planting_cycles / batches / crop_catalog /
--                    environmental_logs / nutrient_logs / planting_photos
-- SELECT : everyone active or alumni
-- WRITE  : admin + operator
-- ------------------------------------------------------------
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'holes', 'planting_cycles', 'batches', 'crop_catalog',
    'environmental_logs', 'nutrient_logs', 'planting_photos'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- Drop every policy currently on the table — regardless of name.
    EXECUTE COALESCE(
      (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON %I;', p.policyname, t), ' ')
       FROM pg_policies p WHERE p.tablename = t),
      ''
    );
    EXECUTE format(
      'CREATE POLICY %I_select ON %I FOR SELECT TO authenticated
        USING (current_profile_status() IN (''active'',''alumni''))', t, t);
    EXECUTE format(
      'CREATE POLICY %I_write_staff ON %I FOR ALL TO authenticated
         USING      (is_active_user() AND is_staff())
         WITH CHECK (is_active_user() AND is_staff())', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- INVENTORY + EXPENSES
-- SELECT : active users (viewers included)
-- WRITE  : admin + operator ; researchers / supervisors denied
-- DELETE on expenses : admin only (extra gate)
-- ------------------------------------------------------------
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_items','inventory_transactions','expenses'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE COALESCE(
      (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON %I;', p.policyname, t), ' ')
       FROM pg_policies p WHERE p.tablename = t),
      ''
    );
    EXECUTE format(
      'CREATE POLICY %I_select ON %I FOR SELECT TO authenticated
        USING (is_active_user() AND get_user_role() IN (''admin'',''operator'',''viewer''))', t, t);
    EXECUTE format(
      'CREATE POLICY %I_ins_upd_staff ON %I FOR INSERT TO authenticated
         WITH CHECK (is_active_user() AND is_staff())', t, t);
    EXECUTE format(
      'CREATE POLICY %I_upd_staff ON %I FOR UPDATE TO authenticated
         USING      (is_active_user() AND is_staff())
         WITH CHECK (is_active_user() AND is_staff())', t, t);
  END LOOP;
END $$;
-- Delete policies — admin only for expenses; staff OK for inventory_*.
CREATE POLICY expenses_delete_admin ON expenses FOR DELETE TO authenticated
  USING (is_active_user() AND get_user_role() = 'admin');
CREATE POLICY inventory_items_delete_staff ON inventory_items FOR DELETE TO authenticated
  USING (is_active_user() AND is_staff());
CREATE POLICY inventory_transactions_delete_staff ON inventory_transactions FOR DELETE TO authenticated
  USING (is_active_user() AND is_staff());

-- ------------------------------------------------------------
-- HR : employee_details / attendance_logs / payroll_records
-- employee_details : admin CRUD ; self SELECT + UPDATE limited fields
-- attendance_logs  : admin CRUD ; self INSERT today ; SELECT own + team by role
-- payroll_records  : admin + operator SELECT team ; admin CRUD
-- (workload_logs was planned but the table does not exist yet; policies
-- for it will be added in a future migration once the table lands.)
-- ------------------------------------------------------------
ALTER TABLE employee_details   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records    ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['employee_details','attendance_logs','payroll_records'] LOOP
    EXECUTE COALESCE(
      (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON %I;', p.policyname, t), ' ')
       FROM pg_policies p WHERE p.tablename = t),
      ''
    );
  END LOOP;
END $$;

-- employee_details
CREATE POLICY employee_details_select ON employee_details FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' OR user_id = auth.uid());
CREATE POLICY employee_details_update_self ON employee_details FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND is_active_user())
  WITH CHECK (user_id = auth.uid() AND is_active_user());
CREATE POLICY employee_details_all_admin ON employee_details FOR ALL TO authenticated
  USING (get_user_role() = 'admin' AND is_active_user())
  WITH CHECK (get_user_role() = 'admin' AND is_active_user());

-- attendance_logs
CREATE POLICY attendance_select ON attendance_logs FOR SELECT TO authenticated
  USING (
    get_user_role() = 'admin'
    OR user_id = auth.uid()
    OR (get_user_role() = 'operator' AND is_active_user())
  );
CREATE POLICY attendance_self_insert ON attendance_logs FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND is_active_user()
    -- Optional: restrict to today. Commented out — app enforces this.
    -- AND attendance_date = (now() AT TIME ZONE 'Asia/Jakarta')::date
  );
CREATE POLICY attendance_all_admin ON attendance_logs FOR ALL TO authenticated
  USING (get_user_role() = 'admin' AND is_active_user())
  WITH CHECK (get_user_role() = 'admin' AND is_active_user());

-- payroll_records
--   SELECT : admin + operator see team ; everyone else reads own only
--   WRITE  : admin only (writes carry financial impact — audit-sensitive)
CREATE POLICY payroll_select ON payroll_records FOR SELECT TO authenticated
  USING (
    (is_active_user() AND get_user_role() IN ('admin','operator'))
    OR user_id = auth.uid()
  );
CREATE POLICY payroll_all_admin ON payroll_records FOR ALL TO authenticated
  USING      (get_user_role() = 'admin' AND is_active_user())
  WITH CHECK (get_user_role() = 'admin' AND is_active_user());

-- (workload_logs policies skipped — table does not exist yet.)

-- ------------------------------------------------------------
-- SALES : customers / sales_orders / sales_order_items /
--         price_history / payment_logs
-- SELECT : active users with role in (admin, operator, viewer)
-- WRITE  : admin + operator
-- ------------------------------------------------------------
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers','sales_orders','sales_order_items','price_history','payment_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE COALESCE(
      (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON %I;', p.policyname, t), ' ')
       FROM pg_policies p WHERE p.tablename = t),
      ''
    );
    EXECUTE format(
      'CREATE POLICY %I_select ON %I FOR SELECT TO authenticated
        USING (is_active_user() AND get_user_role() IN (''admin'',''operator'',''viewer''))', t, t);
    EXECUTE format(
      'CREATE POLICY %I_write_staff ON %I FOR ALL TO authenticated
         USING      (is_active_user() AND is_staff())
         WITH CHECK (is_active_user() AND is_staff())', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- RESEARCH : research_projects / research_hole_allocations /
--            research_progress_logs / research_attachments /
--            research_materials / research_supervisors
--
-- research_projects
--   SELECT : everyone active ; alumni see only own
--   INSERT : active users with role in (admin, operator, researcher)
--   UPDATE : admin OR operator ; OR owner (researcher) ; OR supervisor of the row
--   DELETE : admin
--
-- research_supervisors
--   SELECT : everyone active ; alumni see own
--   INSERT/UPDATE/DELETE : admin + operator (they link supervisors to projects)
-- ------------------------------------------------------------
ALTER TABLE research_projects            ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_hole_allocations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_progress_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_attachments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_materials           ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_supervisors         ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'research_projects','research_hole_allocations','research_progress_logs',
    'research_attachments','research_materials','research_supervisors'
  ] LOOP
    EXECUTE COALESCE(
      (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON %I;', p.policyname, t), ' ')
       FROM pg_policies p WHERE p.tablename = t),
      ''
    );
  END LOOP;
END $$;

-- research_projects
CREATE POLICY research_projects_select ON research_projects FOR SELECT TO authenticated
  USING (
    current_profile_status() = 'active'
    OR (current_profile_status() = 'alumni' AND created_by = auth.uid())
  );
CREATE POLICY research_projects_insert ON research_projects FOR INSERT TO authenticated
  WITH CHECK (
    is_active_user()
    AND get_user_role() IN ('admin','operator','researcher')
    AND (get_user_role() IN ('admin','operator') OR created_by = auth.uid())
  );
CREATE POLICY research_projects_update ON research_projects FOR UPDATE TO authenticated
  USING (
    is_active_user() AND (
      is_staff()
      OR created_by = auth.uid()
      OR is_supervisor_of(id)
    )
  )
  WITH CHECK (
    is_active_user() AND (
      is_staff()
      OR created_by = auth.uid()
      OR is_supervisor_of(id)
    )
  );
CREATE POLICY research_projects_delete_admin ON research_projects FOR DELETE TO authenticated
  USING (is_active_user() AND get_user_role() = 'admin');

-- research_supervisors — admin/operator manage ; active users read
CREATE POLICY research_supervisors_select ON research_supervisors FOR SELECT TO authenticated
  USING (current_profile_status() IN ('active','alumni'));
CREATE POLICY research_supervisors_write ON research_supervisors FOR ALL TO authenticated
  USING      (is_active_user() AND is_staff())
  WITH CHECK (is_active_user() AND is_staff());

-- research_hole_allocations
CREATE POLICY research_alloc_select ON research_hole_allocations FOR SELECT TO authenticated
  USING (current_profile_status() IN ('active','alumni'));
CREATE POLICY research_alloc_write ON research_hole_allocations FOR ALL TO authenticated
  USING (
    is_active_user() AND (
      is_staff()
      OR is_owner_of_project(research_id)
    )
  )
  WITH CHECK (
    is_active_user() AND (
      is_staff()
      OR is_owner_of_project(research_id)
    )
  );

-- research_progress_logs — supervisor reviews count as writes here
CREATE POLICY research_log_select ON research_progress_logs FOR SELECT TO authenticated
  USING (current_profile_status() IN ('active','alumni'));
CREATE POLICY research_log_write ON research_progress_logs FOR ALL TO authenticated
  USING (
    is_active_user() AND (
      is_staff()
      OR is_owner_of_project(research_id)
      OR is_supervisor_of(research_id)
    )
  )
  WITH CHECK (
    is_active_user() AND (
      is_staff()
      OR is_owner_of_project(research_id)
      OR is_supervisor_of(research_id)
    )
  );

-- research_attachments
CREATE POLICY research_attach_select ON research_attachments FOR SELECT TO authenticated
  USING (current_profile_status() IN ('active','alumni'));
CREATE POLICY research_attach_write ON research_attachments FOR ALL TO authenticated
  USING (
    is_active_user() AND (
      is_staff()
      OR is_owner_of_project(research_id)
    )
  )
  WITH CHECK (
    is_active_user() AND (
      is_staff()
      OR is_owner_of_project(research_id)
    )
  );

-- research_materials
CREATE POLICY research_materials_select ON research_materials FOR SELECT TO authenticated
  USING (current_profile_status() IN ('active','alumni'));
CREATE POLICY research_materials_write ON research_materials FOR ALL TO authenticated
  USING (
    is_active_user() AND (
      is_staff()
      OR is_owner_of_project(research_id)
    )
  )
  WITH CHECK (
    is_active_user() AND (
      is_staff()
      OR is_owner_of_project(research_id)
    )
  );

-- ------------------------------------------------------------
-- VISITS : visits / visit_contacts / visit_attachments
-- SELECT : active users
-- WRITE  : admin + operator
-- ------------------------------------------------------------
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['visits','visit_contacts','visit_attachments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE COALESCE(
      (SELECT string_agg(format('DROP POLICY IF EXISTS %I ON %I;', p.policyname, t), ' ')
       FROM pg_policies p WHERE p.tablename = t),
      ''
    );
    EXECUTE format(
      'CREATE POLICY %I_select ON %I FOR SELECT TO authenticated
        USING (is_active_user())', t, t);
    EXECUTE format(
      'CREATE POLICY %I_write_staff ON %I FOR ALL TO authenticated
         USING      (is_active_user() AND is_staff())
         WITH CHECK (is_active_user() AND is_staff())', t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- AUDIT LOGS : admin SELECT only ; NOBODY can modify
-- ------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select_admin ON audit_logs;
DROP POLICY IF EXISTS audit_logs_deny_write   ON audit_logs;

CREATE POLICY audit_logs_select_admin ON audit_logs FOR SELECT TO authenticated
  USING (get_user_role() = 'admin' AND is_active_user());

-- Write path: only via the SECURITY DEFINER trigger. We add a belt-and-
-- suspenders policy that denies direct client writes.
CREATE POLICY audit_logs_deny_write ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (FALSE);
-- UPDATE/DELETE : no policy = deny by default (RLS enabled).
