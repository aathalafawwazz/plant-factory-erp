-- ============================================================
-- VISITS MODULE
-- Tracks guest / partner / field trip / media visits.
-- Single-file migration (tidak butuh split karena tidak menambah
-- nilai enum baru — semua pakai TEXT CHECK).
-- ============================================================

-- 1. visits
CREATE TABLE IF NOT EXISTS visits (
  id                SERIAL PRIMARY KEY,
  code              TEXT UNIQUE,

  visit_type        TEXT NOT NULL DEFAULT 'tour'
                    CHECK (visit_type IN ('tour','meeting','field_trip','media','partnership','training','government','other')),
  purpose           TEXT NOT NULL,

  visit_date        DATE NOT NULL,
  start_time        TIME,
  end_time          TIME,

  checked_in_at     TIMESTAMPTZ,
  checked_out_at    TIMESTAMPTZ,

  organization      TEXT NOT NULL,
  group_size        INTEGER NOT NULL DEFAULT 1 CHECK (group_size >= 1),

  host_user_id      UUID REFERENCES auth.users(id),
  host_name         TEXT,
  areas_visited     TEXT[],

  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','confirmed','ongoing','completed','cancelled','no_show')),

  feedback_rating   SMALLINT CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_notes    TEXT,

  notes             TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_date       ON visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_visits_status     ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_host       ON visits(host_user_id);
CREATE INDEX IF NOT EXISTS idx_visits_type       ON visits(visit_type);

-- Auto-generate VST-YYYYMMDD-XXX
CREATE OR REPLACE FUNCTION generate_visit_code() RETURNS TRIGGER AS $$
DECLARE
  date_str TEXT;
  seq_num INT;
BEGIN
  IF NEW.code IS NOT NULL THEN RETURN NEW; END IF;
  date_str := to_char(COALESCE(NEW.created_at, now()), 'YYYYMMDD');
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM '\d+$') AS INT)), 0) + 1
  INTO seq_num
  FROM visits
  WHERE code LIKE 'VST-' || date_str || '-%';
  NEW.code := 'VST-' || date_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_visit_code ON visits;
CREATE TRIGGER trg_generate_visit_code
  BEFORE INSERT ON visits
  FOR EACH ROW EXECUTE FUNCTION generate_visit_code();

CREATE OR REPLACE FUNCTION touch_visits_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_visits ON visits;
CREATE TRIGGER trg_touch_visits
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION touch_visits_updated_at();

-- 2. visit_contacts
CREATE TABLE IF NOT EXISTS visit_contacts (
  id                SERIAL PRIMARY KEY,
  visit_id          INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  role              TEXT,
  email             TEXT,
  phone             TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_contacts_visit ON visit_contacts(visit_id);

-- 3. visit_attachments
CREATE TABLE IF NOT EXISTS visit_attachments (
  id                SERIAL PRIMARY KEY,
  visit_id          INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL DEFAULT 'photo'
                    CHECK (kind IN ('photo','document','signature')),
  storage_path      TEXT NOT NULL,
  filename          TEXT,
  notes             TEXT,
  uploaded_by       UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_attachments_visit ON visit_attachments(visit_id);

-- ============================================================
-- RLS POLICIES
-- admin/operator: full CRUD
-- viewer/researcher: read-only
-- (Anon INSERT policy akan ditambahkan saat /tur page dibuat nanti)
-- ============================================================

ALTER TABLE visits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_contacts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_attachments  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Visits: select authenticated" ON visits;
CREATE POLICY "Visits: select authenticated"
  ON visits FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Visits: staff insert" ON visits;
CREATE POLICY "Visits: staff insert"
  ON visits FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin','operator'));

DROP POLICY IF EXISTS "Visits: staff update" ON visits;
CREATE POLICY "Visits: staff update"
  ON visits FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin','operator'));

DROP POLICY IF EXISTS "Visits: admin delete" ON visits;
CREATE POLICY "Visits: admin delete"
  ON visits FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "VisitContacts: select authenticated" ON visit_contacts;
CREATE POLICY "VisitContacts: select authenticated"
  ON visit_contacts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "VisitContacts: staff insert" ON visit_contacts;
CREATE POLICY "VisitContacts: staff insert"
  ON visit_contacts FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin','operator'));
DROP POLICY IF EXISTS "VisitContacts: staff update" ON visit_contacts;
CREATE POLICY "VisitContacts: staff update"
  ON visit_contacts FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin','operator'));
DROP POLICY IF EXISTS "VisitContacts: staff delete" ON visit_contacts;
CREATE POLICY "VisitContacts: staff delete"
  ON visit_contacts FOR DELETE TO authenticated
  USING (get_user_role() IN ('admin','operator'));

DROP POLICY IF EXISTS "VisitAttach: select authenticated" ON visit_attachments;
CREATE POLICY "VisitAttach: select authenticated"
  ON visit_attachments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "VisitAttach: staff insert" ON visit_attachments;
CREATE POLICY "VisitAttach: staff insert"
  ON visit_attachments FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin','operator'));
DROP POLICY IF EXISTS "VisitAttach: admin delete" ON visit_attachments;
CREATE POLICY "VisitAttach: admin delete"
  ON visit_attachments FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Visit storage: read authenticated" ON storage.objects;
CREATE POLICY "Visit storage: read authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'visit-photos');

DROP POLICY IF EXISTS "Visit storage: staff upload" ON storage.objects;
CREATE POLICY "Visit storage: staff upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'visit-photos'
    AND get_user_role() IN ('admin','operator')
  );

DROP POLICY IF EXISTS "Visit storage: admin delete" ON storage.objects;
CREATE POLICY "Visit storage: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'visit-photos'
    AND get_user_role() = 'admin'
  );
