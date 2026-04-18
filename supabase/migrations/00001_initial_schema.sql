-- Plant Factory ERP — Initial Schema
-- 480 planting holes across 2 racks × 3 tiers × 4 lanes × 20 holes

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE hole_status AS ENUM (
  'empty', 'planted', 'growing', 'ready_harvest', 'harvested', 'maintenance'
);

CREATE TYPE user_role AS ENUM (
  'admin', 'operator', 'viewer'
);

CREATE TYPE cycle_status AS ENUM (
  'planted', 'growing', 'ready_harvest', 'harvested', 'cancelled'
);

CREATE TYPE batch_status AS ENUM (
  'active', 'completed'
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  role        user_role NOT NULL DEFAULT 'viewer',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- CROP CATALOG
-- ============================================================

CREATE TABLE crop_catalog (
  id              SERIAL PRIMARY KEY,
  name_id         TEXT NOT NULL,           -- Indonesian name
  name_latin      TEXT,                    -- Latin/scientific name
  grow_duration_days INTEGER NOT NULL DEFAULT 30,
  ec_min          NUMERIC(4,2),
  ec_max          NUMERIC(4,2),
  ph_min          NUMERIC(3,1),
  ph_max          NUMERIC(3,1),
  density_notes   TEXT,
  photo_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- HOLES (master table — 480 records)
-- ============================================================

CREATE TABLE holes (
  id              SERIAL PRIMARY KEY,
  rack            CHAR(1) NOT NULL CHECK (rack IN ('A', 'B')),
  tier            SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
  lane            SMALLINT NOT NULL CHECK (lane BETWEEN 1 AND 4),
  hole_number     SMALLINT NOT NULL CHECK (hole_number BETWEEN 1 AND 20),
  canonical_id    TEXT GENERATED ALWAYS AS (
    rack || '-' || tier::TEXT || '-' || lane::TEXT || '-' || hole_number::TEXT
  ) STORED,
  status          hole_status NOT NULL DEFAULT 'empty',
  current_cycle_id INTEGER,               -- FK added after planting_cycles table
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rack, tier, lane, hole_number)
);

CREATE INDEX idx_holes_status ON holes(status);
CREATE INDEX idx_holes_canonical ON holes(canonical_id);

-- ============================================================
-- BATCHES
-- ============================================================

CREATE TABLE batches (
  id              SERIAL PRIMARY KEY,
  batch_code      TEXT NOT NULL UNIQUE,
  crop_catalog_id INTEGER NOT NULL REFERENCES crop_catalog(id),
  planted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  status          batch_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-generate batch_code: BATCH-YYYYMMDD-NNN
CREATE OR REPLACE FUNCTION generate_batch_code()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
BEGIN
  today_str := to_char(now(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO seq_num
  FROM batches
  WHERE batch_code LIKE 'BATCH-' || today_str || '-%';
  NEW.batch_code := 'BATCH-' || today_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_batch_code
  BEFORE INSERT ON batches
  FOR EACH ROW
  WHEN (NEW.batch_code IS NULL OR NEW.batch_code = '')
  EXECUTE FUNCTION generate_batch_code();

-- ============================================================
-- PLANTING CYCLES
-- ============================================================

CREATE TABLE planting_cycles (
  id                  SERIAL PRIMARY KEY,
  hole_id             INTEGER NOT NULL REFERENCES holes(id),
  batch_id            INTEGER NOT NULL REFERENCES batches(id),
  crop_catalog_id     INTEGER NOT NULL REFERENCES crop_catalog(id),
  planted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_harvest_at TIMESTAMPTZ,
  harvested_at        TIMESTAMPTZ,
  harvest_weight_g    NUMERIC(8,2),
  quality_grade       TEXT CHECK (quality_grade IN ('A', 'B', 'C')),
  status              cycle_status NOT NULL DEFAULT 'planted',
  notes               TEXT,
  created_by          UUID REFERENCES auth.users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cycles_hole ON planting_cycles(hole_id);
CREATE INDEX idx_cycles_batch ON planting_cycles(batch_id);
CREATE INDEX idx_cycles_status ON planting_cycles(status);

-- Add FK from holes to planting_cycles
ALTER TABLE holes
  ADD CONSTRAINT fk_holes_current_cycle
  FOREIGN KEY (current_cycle_id) REFERENCES planting_cycles(id);

-- ============================================================
-- ENVIRONMENTAL LOGS
-- ============================================================

CREATE TABLE environmental_logs (
  id              SERIAL PRIMARY KEY,
  rack            CHAR(1) CHECK (rack IN ('A', 'B')),  -- NULL = whole room
  tier            SMALLINT CHECK (tier BETWEEN 1 AND 3),
  temperature_c   NUMERIC(4,1),
  humidity_pct    NUMERIC(4,1),
  ec_ms           NUMERIC(4,2),
  ph              NUMERIC(3,1),
  water_temp_c    NUMERIC(4,1),
  growlight_on    BOOLEAN,
  ac_on           BOOLEAN,
  fan_on          BOOLEAN,
  notes           TEXT,
  recorded_by     UUID REFERENCES auth.users(id),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_envlog_recorded ON environmental_logs(recorded_at DESC);

-- ============================================================
-- NUTRIENT LOGS
-- ============================================================

CREATE TABLE nutrient_logs (
  id              SERIAL PRIMARY KEY,
  mixed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  volume_liters   NUMERIC(6,2),
  formula_name    TEXT,
  ec_target       NUMERIC(4,2),
  ph_target       NUMERIC(3,1),
  ec_actual       NUMERIC(4,2),
  ph_actual       NUMERIC(3,1),
  mixed_by        UUID REFERENCES auth.users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- UPDATED_AT TRIGGER (reusable)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_holes_updated_at
  BEFORE UPDATE ON holes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_cycles_updated_at
  BEFORE UPDATE ON planting_cycles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE planting_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE environmental_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrient_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Profiles: select for authenticated"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles: update own"
  ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Profiles: admin insert"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'admin');

-- CROP CATALOG
CREATE POLICY "Crops: select for authenticated"
  ON crop_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Crops: admin manage"
  ON crop_catalog FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');

-- HOLES
CREATE POLICY "Holes: select for authenticated"
  ON holes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Holes: operator+ modify"
  ON holes FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'operator'));

-- BATCHES
CREATE POLICY "Batches: select for authenticated"
  ON batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Batches: operator+ insert"
  ON batches FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'operator'));
CREATE POLICY "Batches: operator+ update"
  ON batches FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'operator'));

-- PLANTING CYCLES
CREATE POLICY "Cycles: select for authenticated"
  ON planting_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Cycles: operator+ insert"
  ON planting_cycles FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'operator'));
CREATE POLICY "Cycles: operator+ update"
  ON planting_cycles FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'operator'));

-- ENVIRONMENTAL LOGS
CREATE POLICY "EnvLogs: select for authenticated"
  ON environmental_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "EnvLogs: operator+ insert"
  ON environmental_logs FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'operator'));

-- NUTRIENT LOGS
CREATE POLICY "NutrientLogs: select for authenticated"
  ON nutrient_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "NutrientLogs: operator+ insert"
  ON nutrient_logs FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'operator'));
