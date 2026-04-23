-- Inventory & Expenses module
-- Tracks: seeds, nutrients, growing media, pH solutions, packaging, and finished products
-- Expenses: purchases + operational costs tied to cultivation

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE inventory_category AS ENUM (
  'seed',        -- Benih
  'nutrient',    -- Nutrisi (AB mix, dll)
  'media',       -- Media tanam (rockwool, cocopeat)
  'ph_solution', -- Larutan pH up/down
  'packaging',   -- Kemasan (box, plastik)
  'equipment',   -- Alat/perlengkapan kecil
  'product',     -- Produk jadi (hasil panen siap jual)
  'other'
);

CREATE TYPE inventory_txn_type AS ENUM (
  'in',          -- Stok masuk (pembelian / hasil panen)
  'out',         -- Stok keluar (terpakai / terjual / rusak)
  'adjustment'   -- Koreksi manual (stock opname)
);

CREATE TYPE inventory_txn_source AS ENUM (
  'purchase',    -- Pembelian (dari expense)
  'harvest',     -- Dari hasil panen (untuk kategori product)
  'sale',        -- Terjual (dari sales_order)
  'usage',       -- Terpakai dalam budidaya
  'waste',       -- Rusak / terbuang
  'manual'       -- Penyesuaian manual
);

CREATE TYPE expense_category AS ENUM (
  'seed',        -- Pembelian benih
  'nutrient',    -- Pembelian nutrisi
  'media',       -- Pembelian media tanam
  'ph_solution', -- Pembelian larutan pH
  'packaging',   -- Pembelian kemasan
  'utility',     -- Listrik, air, internet
  'labor',       -- Upah tambahan (di luar payroll)
  'equipment',   -- Alat, perlengkapan
  'maintenance', -- Perawatan fasilitas
  'other'
);

CREATE TYPE expense_payment_method AS ENUM (
  'tunai', 'transfer', 'ewallet', 'kartu', 'lainnya'
);

-- ============================================================
-- INVENTORY ITEMS
-- ============================================================

CREATE TABLE inventory_items (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  category        inventory_category NOT NULL,
  sku             TEXT UNIQUE,
  unit            TEXT NOT NULL DEFAULT 'pcs', -- kg, gram, liter, ml, pcs, pack
  current_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
  min_stock       NUMERIC(12,3) DEFAULT 0,
  unit_cost       NUMERIC(12,2) DEFAULT 0,     -- harga rata-rata per unit
  unit_price      NUMERIC(12,2),                -- harga jual (untuk produk)
  supplier        TEXT,
  notes           TEXT,
  -- optional link ke crop_catalog untuk produk jadi
  crop_catalog_id INTEGER REFERENCES crop_catalog(id) ON DELETE SET NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_inventory_items_updated_at
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_inventory_items_category ON inventory_items(category);
CREATE INDEX idx_inventory_items_active ON inventory_items(is_active);

-- ============================================================
-- INVENTORY TRANSACTIONS (stock movement ledger)
-- ============================================================

CREATE TABLE inventory_transactions (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  txn_type        inventory_txn_type NOT NULL,
  source          inventory_txn_source NOT NULL DEFAULT 'manual',
  quantity        NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_cost       NUMERIC(12,2) DEFAULT 0,
  total_cost      NUMERIC(14,2) DEFAULT 0,
  -- Reference ke tabel lain (opsional)
  reference_type  TEXT,  -- 'expense', 'sales_order', 'planting_cycle', 'harvest'
  reference_id    INTEGER,
  notes           TEXT,
  recorded_by     UUID REFERENCES auth.users(id),
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_txn_item ON inventory_transactions(item_id);
CREATE INDEX idx_inventory_txn_type ON inventory_transactions(txn_type);
CREATE INDEX idx_inventory_txn_recorded_at ON inventory_transactions(recorded_at DESC);
CREATE INDEX idx_inventory_txn_reference ON inventory_transactions(reference_type, reference_id);

-- ============================================================
-- TRIGGER: auto-update inventory_items.current_stock
-- ============================================================

CREATE OR REPLACE FUNCTION apply_inventory_txn()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.txn_type = 'in' THEN
      UPDATE inventory_items SET current_stock = current_stock + NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.txn_type = 'out' THEN
      UPDATE inventory_items SET current_stock = current_stock - NEW.quantity WHERE id = NEW.item_id;
    ELSIF NEW.txn_type = 'adjustment' THEN
      -- adjustment: quantity can be net change, stored positive but we need sign via source/notes
      -- convention: 'adjustment' positive quantity is an increase; use separate txn with negative-intent if decrease
      UPDATE inventory_items SET current_stock = NEW.quantity WHERE id = NEW.item_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.txn_type = 'in' THEN
      UPDATE inventory_items SET current_stock = current_stock - OLD.quantity WHERE id = OLD.item_id;
    ELSIF OLD.txn_type = 'out' THEN
      UPDATE inventory_items SET current_stock = current_stock + OLD.quantity WHERE id = OLD.item_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_inventory_txn
AFTER INSERT OR DELETE ON inventory_transactions
FOR EACH ROW EXECUTE FUNCTION apply_inventory_txn();

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE expenses (
  id               SERIAL PRIMARY KEY,
  expense_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  category         expense_category NOT NULL,
  amount           NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  description      TEXT NOT NULL,
  vendor           TEXT,
  payment_method   expense_payment_method DEFAULT 'tunai',
  -- Optional: menghubungkan expense ke pembelian item inventory
  inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
  quantity         NUMERIC(12,3),  -- jumlah yang dibeli jika terhubung ke inventory
  receipt_url      TEXT,           -- URL bukti (storage)
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users
CREATE POLICY "inventory_items_select" ON inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventory_txn_select"    ON inventory_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_select"         ON expenses FOR SELECT TO authenticated USING (true);

-- INSERT/UPDATE/DELETE: admin + operator
CREATE POLICY "inventory_items_write" ON inventory_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operator')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operator')));

CREATE POLICY "inventory_txn_write" ON inventory_transactions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operator')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operator')));

CREATE POLICY "expenses_write" ON expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operator')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','operator')));

-- ============================================================
-- SEED: contoh item inventory starter
-- ============================================================

INSERT INTO inventory_items (name, category, unit, current_stock, min_stock, unit_cost, supplier) VALUES
  ('Benih Selada Grand Rapids',   'seed',        'pack',  20,   5,    25000,  'Known You Seed'),
  ('Benih Bayam Hijau',           'seed',        'pack',  15,   5,    15000,  'Panah Merah'),
  ('Benih Kangkung',              'seed',        'pack',  12,   5,    12000,  'Panah Merah'),
  ('Benih Pakcoy',                'seed',        'pack',  18,   5,    20000,  'Known You Seed'),
  ('Benih Basil',                 'seed',        'pack',  8,    3,    35000,  'Ewindo'),
  ('Nutrisi AB Mix Sayur Daun',   'nutrient',    'liter', 50,   10,   45000,  'Hydro Sejahtera'),
  ('Larutan pH Up',               'ph_solution', 'ml',    1000, 250,  150,    'Hydro Sejahtera'),
  ('Larutan pH Down',             'ph_solution', 'ml',    1000, 250,  150,    'Hydro Sejahtera'),
  ('Rockwool Cultilene',          'media',       'slab',  200,  50,   8500,   'Agrifarm'),
  ('Cocopeat Fine',               'media',       'kg',    25,   5,    12000,  'Agrifarm'),
  ('Kemasan Plastik 250g',        'packaging',   'pcs',   500,  100,  350,    'Kemasan Jaya'),
  ('Kemasan Box 1kg',             'packaging',   'pcs',   150,  30,   2500,   'Kemasan Jaya')
ON CONFLICT DO NOTHING;
