-- ============================================================
-- SPRINT 2 — PART 2/3  (schema additions; run in a new tx AFTER 00015)
--
-- Adds:
--   - profile_status enum + profiles.status column
--   - research_supervisors  (many-to-many dosen ↔ project)
--   - audit_logs + generic trigger fn + triggers on critical tables
--   - helper SQL functions used by the new RLS policies in 00017
--
-- Existing data — no destructive changes. New columns default to safe
-- values, new tables are empty.
-- ============================================================

-- ------------------------------------------------------------
-- 1. profile_status
-- ------------------------------------------------------------
-- States:
--   'active'     — normal user, full role permissions
--   'alumni'     — ex-researcher; read-only access to own archived data
--   'suspended'  — admin-disabled; no access to any table via RLS
--   'pending'    — just self-registered, awaiting admin approval
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('active', 'alumni', 'suspended', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status           profile_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_reason    TEXT,
  ADD COLUMN IF NOT EXISTS approved_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles (status);

-- Self-register default — new researchers / supervisors land as 'pending'.
-- `handle_new_user` keeps 'active' for admin-created accounts; for
-- self-registered users the landing page explicitly sets status='pending'
-- via its own insert (see app code). This migration only ensures the
-- column exists and is NOT NULL.

-- ------------------------------------------------------------
-- 2. research_supervisors  (many-to-many)
-- ------------------------------------------------------------
-- One project can have multiple supervising lecturers; one lecturer can
-- supervise multiple projects. A `role` discriminates the primary vs
-- co-supervisors so downstream UI can label / sort accordingly.
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE supervisor_role AS ENUM ('primary', 'co', 'external');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS research_supervisors (
  id              SERIAL PRIMARY KEY,
  project_id      INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  supervisor_id   UUID    NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  role            supervisor_role NOT NULL DEFAULT 'co',
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  released_at     TIMESTAMPTZ,   -- set when supervisor stops advising
  notes           TEXT,
  UNIQUE (project_id, supervisor_id)
);

CREATE INDEX IF NOT EXISTS idx_rs_project    ON research_supervisors (project_id);
CREATE INDEX IF NOT EXISTS idx_rs_supervisor ON research_supervisors (supervisor_id);
CREATE INDEX IF NOT EXISTS idx_rs_active     ON research_supervisors (project_id) WHERE released_at IS NULL;

-- ------------------------------------------------------------
-- 3. audit_logs  (generic, write-once)
-- ------------------------------------------------------------
-- Every row-level change on a critical table is mirrored here via the
-- trigger below. Entries are intentionally append-only: RLS (see 00017)
-- denies UPDATE/DELETE to everyone, including admins; the only way to
-- "correct" an audit log is to insert a compensating event.
--
-- `user_id` is captured from auth.uid() inside the trigger; when a
-- service-role job or SQL migration performs the change, the value is
-- NULL — distinguishable from user activity at query time.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_role  user_role,                      -- snapshot; survives role change
  table_name TEXT    NOT NULL,
  row_pk     TEXT    NOT NULL,               -- stringified primary key (single or composite)
  op         TEXT    NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
  before_row JSONB,                          -- null on INSERT
  after_row  JSONB,                          -- null on DELETE
  changed_cols TEXT[]                        -- populated for UPDATE; NULL otherwise
);

CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_table_row   ON audit_logs (table_name, row_pk);
CREATE INDEX IF NOT EXISTS idx_audit_table_op    ON audit_logs (table_name, op);

-- Generic audit trigger function.
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS TRIGGER AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_role  user_role;
  v_pk    TEXT;
  v_before JSONB;
  v_after  JSONB;
  v_changed TEXT[];
BEGIN
  -- Look up current role for snapshot (NULL for unauthenticated SQL).
  IF v_uid IS NOT NULL THEN
    SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  END IF;

  -- Best-effort PK extraction. Trigger must be created with
  -- `pg_trigger_depth()`-safe arguments: we pass the PK column name
  -- via TG_ARGV[0]. When absent, fall back to 'id'.
  DECLARE
    v_pk_col TEXT := COALESCE(TG_ARGV[0], 'id');
  BEGIN
    IF TG_OP = 'DELETE' THEN
      EXECUTE format('SELECT ($1).%I::text', v_pk_col) INTO v_pk USING OLD;
      v_before := to_jsonb(OLD);
      v_after  := NULL;
    ELSIF TG_OP = 'INSERT' THEN
      EXECUTE format('SELECT ($1).%I::text', v_pk_col) INTO v_pk USING NEW;
      v_before := NULL;
      v_after  := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
      EXECUTE format('SELECT ($1).%I::text', v_pk_col) INTO v_pk USING NEW;
      v_before := to_jsonb(OLD);
      v_after  := to_jsonb(NEW);
      -- Compute changed columns — compares jsonb keys & values.
      SELECT array_agg(key)
        INTO v_changed
        FROM jsonb_each(v_before) b
        WHERE b.value IS DISTINCT FROM (v_after -> b.key);
    END IF;
  END;

  INSERT INTO audit_logs (user_id, user_role, table_name, row_pk, op,
                          before_row, after_row, changed_cols)
  VALUES (v_uid, v_role, TG_TABLE_NAME, v_pk, TG_OP, v_before, v_after, v_changed);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to critical tables. Add more by copying the pattern.
DROP TRIGGER IF EXISTS aud_profiles              ON profiles;
DROP TRIGGER IF EXISTS aud_holes                 ON holes;
DROP TRIGGER IF EXISTS aud_batches               ON batches;
DROP TRIGGER IF EXISTS aud_planting_cycles       ON planting_cycles;
DROP TRIGGER IF EXISTS aud_inventory_items       ON inventory_items;
DROP TRIGGER IF EXISTS aud_inventory_transactions ON inventory_transactions;
DROP TRIGGER IF EXISTS aud_expenses              ON expenses;
DROP TRIGGER IF EXISTS aud_sales_orders          ON sales_orders;
DROP TRIGGER IF EXISTS aud_payroll_records       ON payroll_records;
DROP TRIGGER IF EXISTS aud_research_projects     ON research_projects;
DROP TRIGGER IF EXISTS aud_research_supervisors  ON research_supervisors;
DROP TRIGGER IF EXISTS aud_visits                ON visits;

CREATE TRIGGER aud_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_holes
  AFTER INSERT OR UPDATE OR DELETE ON holes
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_batches
  AFTER INSERT OR UPDATE OR DELETE ON batches
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_planting_cycles
  AFTER INSERT OR UPDATE OR DELETE ON planting_cycles
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_inventory_items
  AFTER INSERT OR UPDATE OR DELETE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_inventory_transactions
  AFTER INSERT OR UPDATE OR DELETE ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_sales_orders
  AFTER INSERT OR UPDATE OR DELETE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_payroll_records
  AFTER INSERT OR UPDATE OR DELETE ON payroll_records
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_research_projects
  AFTER INSERT OR UPDATE OR DELETE ON research_projects
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_research_supervisors
  AFTER INSERT OR UPDATE OR DELETE ON research_supervisors
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

CREATE TRIGGER aud_visits
  AFTER INSERT OR UPDATE OR DELETE ON visits
  FOR EACH ROW EXECUTE FUNCTION audit_row_change('id');

-- ------------------------------------------------------------
-- 4. Helper functions for RLS (used heavily in 00017)
-- ------------------------------------------------------------

-- Returns TRUE when the current user's profile is active — i.e., not
-- pending/suspended/alumni. Alumni get a narrower carve-out elsewhere.
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT status = 'active' FROM profiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_profile_status()
RETURNS profile_status AS $$
  SELECT status FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Is the current user supervising this project (any role, not released)?
CREATE OR REPLACE FUNCTION is_supervisor_of(p_project_id INTEGER)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM research_supervisors
    WHERE project_id    = p_project_id
      AND supervisor_id = auth.uid()
      AND released_at IS NULL
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Is the current user the researcher who owns this project (created_by)?
CREATE OR REPLACE FUNCTION is_owner_of_project(p_project_id INTEGER)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM research_projects
    WHERE id = p_project_id AND created_by = auth.uid()
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Convenience — staff = admin OR operator. Used in many write policies.
CREATE OR REPLACE FUNCTION is_staff()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'operator');
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
