-- Sales module tables

-- Customers
CREATE TABLE customers (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'individu' CHECK (type IN ('restoran', 'retail', 'distributor', 'individu')),
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sales orders
CREATE TABLE sales_orders (
  id              SERIAL PRIMARY KEY,
  customer_id     INTEGER NOT NULL REFERENCES customers(id),
  order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'delivered', 'paid', 'cancelled')),
  total_amount    NUMERIC(12,0) DEFAULT 0,
  payment_method  TEXT CHECK (payment_method IN ('tunai', 'transfer', 'invoice')),
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_sales_orders_updated_at
  BEFORE UPDATE ON sales_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_sales_orders_status ON sales_orders(status);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);

-- Sales order items
CREATE TABLE sales_order_items (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  crop_catalog_id INTEGER NOT NULL REFERENCES crop_catalog(id),
  quantity_kg     NUMERIC(8,2) NOT NULL DEFAULT 0,
  unit_price      NUMERIC(10,0) NOT NULL DEFAULT 0,
  subtotal        NUMERIC(12,0) NOT NULL DEFAULT 0,
  quality_grade   TEXT CHECK (quality_grade IN ('A', 'B', 'C')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_items_order ON sales_order_items(order_id);

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_manage" ON customers FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "sales_orders_select" ON sales_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_orders_manage" ON sales_orders FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "sales_order_items_select" ON sales_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "sales_order_items_manage" ON sales_order_items FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));
