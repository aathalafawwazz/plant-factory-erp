-- ============================================================
-- PLANTING PHOTOS
-- Per-cycle photo evidence (planting, maintenance, harvest)
-- ============================================================

CREATE TABLE IF NOT EXISTS planting_photos (
  id             SERIAL PRIMARY KEY,
  cycle_id       INTEGER NOT NULL REFERENCES planting_cycles(id) ON DELETE CASCADE,
  storage_path   TEXT NOT NULL,                      -- object path inside bucket
  kind           TEXT NOT NULL DEFAULT 'planting'
                 CHECK (kind IN ('planting', 'maintenance', 'harvest')),
  captured_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  captured_by    UUID REFERENCES auth.users(id),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planting_photos_cycle ON planting_photos(cycle_id);
CREATE INDEX IF NOT EXISTS idx_planting_photos_kind  ON planting_photos(kind);

ALTER TABLE planting_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PlantingPhotos: select for authenticated"
  ON planting_photos FOR SELECT TO authenticated USING (true);

CREATE POLICY "PlantingPhotos: operator+ insert"
  ON planting_photos FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "PlantingPhotos: operator+ update"
  ON planting_photos FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "PlantingPhotos: admin delete"
  ON planting_photos FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');

-- ============================================================
-- STORAGE BUCKET: planting-photos
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('planting-photos', 'planting-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Read: authenticated users only
DROP POLICY IF EXISTS "PlantingPhotos storage: read authenticated" ON storage.objects;
CREATE POLICY "PlantingPhotos storage: read authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'planting-photos');

-- Upload: operator+
DROP POLICY IF EXISTS "PlantingPhotos storage: operator+ upload" ON storage.objects;
CREATE POLICY "PlantingPhotos storage: operator+ upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'planting-photos'
    AND get_user_role() IN ('admin', 'operator')
  );

-- Delete: admin only
DROP POLICY IF EXISTS "PlantingPhotos storage: admin delete" ON storage.objects;
CREATE POLICY "PlantingPhotos storage: admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'planting-photos'
    AND get_user_role() = 'admin'
  );
