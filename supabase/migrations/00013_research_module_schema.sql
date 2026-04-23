-- ============================================================
-- RESEARCH MODULE — PART 2/2
-- Skema tabel, RLS, storage bucket.
-- Prerequisite: migration 00012 sudah dijalankan (enum 'researcher' ada).
-- ============================================================

-- 1. Research projects
CREATE TABLE IF NOT EXISTS research_projects (
  id                SERIAL PRIMARY KEY,
  code              TEXT UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT,
  research_type     TEXT NOT NULL DEFAULT 'skripsi'
                    CHECK (research_type IN
                      ('skripsi','tesis','disertasi','dosen','eksternal','internal')),
  objective         TEXT,

  researcher_user_id UUID REFERENCES auth.users(id),
  researcher_name    TEXT NOT NULL,
  researcher_id_no   TEXT,
  institution        TEXT,
  email              TEXT,
  phone              TEXT,
  supervisor_name    TEXT,
  supervisor_email   TEXT,

  proposed_start    DATE,
  proposed_end      DATE,
  actual_start      DATE,
  actual_end        DATE,

  status            TEXT NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed','approved','active','paused','completed','cancelled')),
  approved_by       UUID REFERENCES auth.users(id),
  approved_at       TIMESTAMPTZ,

  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_projects_status      ON research_projects(status);
CREATE INDEX IF NOT EXISTS idx_research_projects_researcher  ON research_projects(researcher_user_id);

-- Auto-generate code RSH-YYYYMMDD-XXX
CREATE OR REPLACE FUNCTION generate_research_code() RETURNS TRIGGER AS $$
DECLARE
  date_str TEXT;
  seq_num INT;
BEGIN
  IF NEW.code IS NOT NULL THEN RETURN NEW; END IF;
  date_str := to_char(COALESCE(NEW.created_at, now()), 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '\d+$') AS INT)), 0) + 1
  INTO seq_num
  FROM research_projects
  WHERE code LIKE 'RSH-' || date_str || '-%';
  NEW.code := 'RSH-' || date_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_research_code ON research_projects;
CREATE TRIGGER trg_generate_research_code
  BEFORE INSERT ON research_projects
  FOR EACH ROW EXECUTE FUNCTION generate_research_code();

CREATE OR REPLACE FUNCTION touch_research_projects_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_research_projects ON research_projects;
CREATE TRIGGER trg_touch_research_projects
  BEFORE UPDATE ON research_projects
  FOR EACH ROW EXECUTE FUNCTION touch_research_projects_updated_at();

-- 2. Allocations
CREATE TABLE IF NOT EXISTS research_hole_allocations (
  id                SERIAL PRIMARY KEY,
  research_id       INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  hole_id           INTEGER NOT NULL REFERENCES holes(id),
  treatment_label   TEXT,
  treatment_group   TEXT,
  reserved_from     DATE NOT NULL,
  reserved_until    DATE NOT NULL,
  released_at       TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_research_alloc_research ON research_hole_allocations(research_id);
CREATE INDEX IF NOT EXISTS idx_research_alloc_hole     ON research_hole_allocations(hole_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_research_alloc_active_hole
  ON research_hole_allocations(hole_id)
  WHERE released_at IS NULL;

-- 3. Progress logs
CREATE TABLE IF NOT EXISTS research_progress_logs (
  id                SERIAL PRIMARY KEY,
  research_id       INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  phase             TEXT,
  log_date          DATE NOT NULL DEFAULT current_date,
  summary           TEXT NOT NULL,
  metrics           JSONB,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_logs_research ON research_progress_logs(research_id);
CREATE INDEX IF NOT EXISTS idx_research_logs_date     ON research_progress_logs(log_date);

-- 4. Attachments
CREATE TABLE IF NOT EXISTS research_attachments (
  id                SERIAL PRIMARY KEY,
  research_id       INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  progress_log_id   INTEGER REFERENCES research_progress_logs(id) ON DELETE SET NULL,
  kind              TEXT NOT NULL DEFAULT 'photo'
                    CHECK (kind IN ('photo','document','dataset','report')),
  storage_path      TEXT NOT NULL,
  filename          TEXT,
  notes             TEXT,
  uploaded_by       UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_attach_research ON research_attachments(research_id);

-- 5. Materials
CREATE TABLE IF NOT EXISTS research_materials (
  id                SERIAL PRIMARY KEY,
  research_id       INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  item_name         TEXT NOT NULL,
  qty               NUMERIC,
  unit              TEXT,
  expense_id        INTEGER,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_research_materials_research ON research_materials(research_id);

-- 6. Link planting_cycles to research
ALTER TABLE planting_cycles
  ADD COLUMN IF NOT EXISTS research_id INTEGER REFERENCES research_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cycles_research ON planting_cycles(research_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE research_projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_hole_allocations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_progress_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_attachments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_materials          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Research: select authenticated" ON research_projects;
CREATE POLICY "Research: select authenticated"
  ON research_projects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Research: staff insert" ON research_projects;
CREATE POLICY "Research: staff insert"
  ON research_projects FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin','operator','researcher'));

DROP POLICY IF EXISTS "Research: staff or owner update" ON research_projects;
CREATE POLICY "Research: staff or owner update"
  ON research_projects FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND researcher_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Research: admin delete" ON research_projects;
CREATE POLICY "Research: admin delete"
  ON research_projects FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

CREATE OR REPLACE FUNCTION is_research_owner(_research_id INT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM research_projects
    WHERE id = _research_id AND researcher_user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE;

-- research_hole_allocations
DROP POLICY IF EXISTS "ResearchAlloc: select authenticated" ON research_hole_allocations;
CREATE POLICY "ResearchAlloc: select authenticated"
  ON research_hole_allocations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ResearchAlloc: staff insert" ON research_hole_allocations;
CREATE POLICY "ResearchAlloc: staff insert"
  ON research_hole_allocations FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND is_research_owner(research_id))
  );
DROP POLICY IF EXISTS "ResearchAlloc: staff update" ON research_hole_allocations;
CREATE POLICY "ResearchAlloc: staff update"
  ON research_hole_allocations FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND is_research_owner(research_id))
  );
DROP POLICY IF EXISTS "ResearchAlloc: staff delete" ON research_hole_allocations;
CREATE POLICY "ResearchAlloc: staff delete"
  ON research_hole_allocations FOR DELETE TO authenticated
  USING (get_user_role() IN ('admin','operator'));

-- research_progress_logs
DROP POLICY IF EXISTS "ResearchLog: select authenticated" ON research_progress_logs;
CREATE POLICY "ResearchLog: select authenticated"
  ON research_progress_logs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ResearchLog: insert" ON research_progress_logs;
CREATE POLICY "ResearchLog: insert"
  ON research_progress_logs FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND is_research_owner(research_id))
  );
DROP POLICY IF EXISTS "ResearchLog: update" ON research_progress_logs;
CREATE POLICY "ResearchLog: update"
  ON research_progress_logs FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND is_research_owner(research_id))
  );
DROP POLICY IF EXISTS "ResearchLog: delete" ON research_progress_logs;
CREATE POLICY "ResearchLog: delete"
  ON research_progress_logs FOR DELETE TO authenticated
  USING (get_user_role() IN ('admin','operator'));

-- research_attachments
DROP POLICY IF EXISTS "ResearchAttach: select authenticated" ON research_attachments;
CREATE POLICY "ResearchAttach: select authenticated"
  ON research_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ResearchAttach: insert" ON research_attachments;
CREATE POLICY "ResearchAttach: insert"
  ON research_attachments FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND is_research_owner(research_id))
  );
DROP POLICY IF EXISTS "ResearchAttach: delete" ON research_attachments;
CREATE POLICY "ResearchAttach: delete"
  ON research_attachments FOR DELETE TO authenticated
  USING (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND is_research_owner(research_id))
  );

-- research_materials
DROP POLICY IF EXISTS "ResearchMat: select authenticated" ON research_materials;
CREATE POLICY "ResearchMat: select authenticated"
  ON research_materials FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ResearchMat: insert" ON research_materials;
CREATE POLICY "ResearchMat: insert"
  ON research_materials FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND is_research_owner(research_id))
  );
DROP POLICY IF EXISTS "ResearchMat: update" ON research_materials;
CREATE POLICY "ResearchMat: update"
  ON research_materials FOR UPDATE TO authenticated
  USING (
    get_user_role() IN ('admin','operator')
    OR (get_user_role() = 'researcher' AND is_research_owner(research_id))
  );
DROP POLICY IF EXISTS "ResearchMat: delete" ON research_materials;
CREATE POLICY "ResearchMat: delete"
  ON research_materials FOR DELETE TO authenticated
  USING (get_user_role() IN ('admin','operator'));

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-attachments', 'research-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Research storage: read authenticated" ON storage.objects;
CREATE POLICY "Research storage: read authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'research-attachments');

DROP POLICY IF EXISTS "Research storage: staff+researcher upload" ON storage.objects;
CREATE POLICY "Research storage: staff+researcher upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'research-attachments'
    AND get_user_role() IN ('admin','operator','researcher')
  );

DROP POLICY IF EXISTS "Research storage: admin delete" ON storage.objects;
CREATE POLICY "Research storage: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'research-attachments'
    AND get_user_role() = 'admin'
  );
