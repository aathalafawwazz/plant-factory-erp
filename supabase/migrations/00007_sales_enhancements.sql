-- Sales enhancements: discount, tax, payment logs, price history

-- Add discount/tax fields to sales_orders
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_percent NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total NUMERIC(12,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Add discount per item
ALTER TABLE sales_order_items
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,0) DEFAULT 0;

-- Payment logs
CREATE TABLE payment_logs (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  payment_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  amount          NUMERIC(12,0) NOT NULL,
  method          TEXT CHECK (method IN ('tunai', 'transfer', 'invoice')),
  reference       TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_logs_order ON payment_logs(order_id);

-- Price history
CREATE TABLE price_history (
  id              SERIAL PRIMARY KEY,
  crop_catalog_id INTEGER NOT NULL REFERENCES crop_catalog(id),
  quality_grade   TEXT CHECK (quality_grade IN ('A', 'B', 'C')),
  price_per_kg    NUMERIC(10,0) NOT NULL,
  effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_crop ON price_history(crop_catalog_id, effective_date DESC);

-- Auto-generate invoice number trigger
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.invoice_number IS NULL THEN
    today_str := to_char(now(), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO seq_num
    FROM sales_orders
    WHERE invoice_number LIKE 'INV-' || today_str || '-%';
    NEW.invoice_number := 'INV-' || today_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

-- RLS for new tables
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_logs_select" ON payment_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "payment_logs_manage" ON payment_logs FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "price_history_select" ON price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "price_history_manage" ON price_history FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));
