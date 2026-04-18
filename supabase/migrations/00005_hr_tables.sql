-- Human Resource tables

-- Employee details (extends profiles)
CREATE TABLE employee_details (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nik             TEXT,
  position        TEXT,
  department      TEXT,
  join_date       DATE,
  contract_type   TEXT CHECK (contract_type IN ('tetap', 'kontrak', 'magang', 'paruh_waktu')),
  base_salary     NUMERIC(12,0) DEFAULT 0,
  phone           TEXT,
  address         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_employee_details_updated_at
  BEFORE UPDATE ON employee_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Attendance logs
CREATE TABLE attendance_logs (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in        TIMESTAMPTZ,
  clock_out       TIMESTAMPTZ,
  total_hours     NUMERIC(5,2) DEFAULT 0,
  overtime_hours  NUMERIC(5,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'hadir' CHECK (status IN ('hadir', 'izin', 'sakit', 'cuti', 'alpha')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_attendance_user_date ON attendance_logs(user_id, date);

-- Payroll records
CREATE TABLE payroll_records (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  period_month    SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     SMALLINT NOT NULL,
  base_salary     NUMERIC(12,0) DEFAULT 0,
  overtime_pay    NUMERIC(12,0) DEFAULT 0,
  allowances      NUMERIC(12,0) DEFAULT 0,
  deductions      NUMERIC(12,0) DEFAULT 0,
  total           NUMERIC(12,0) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_month, period_year)
);

-- RLS
ALTER TABLE employee_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- All authenticated can read
CREATE POLICY "employee_details_select" ON employee_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_logs_select" ON attendance_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_records_select" ON payroll_records FOR SELECT TO authenticated USING (true);

-- Admin + operator can manage
CREATE POLICY "employee_details_manage" ON employee_details FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'operator'))
  WITH CHECK (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "attendance_logs_insert" ON attendance_logs FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'operator'));
CREATE POLICY "attendance_logs_update" ON attendance_logs FOR UPDATE TO authenticated
  USING (get_user_role() IN ('admin', 'operator'));

CREATE POLICY "payroll_records_manage" ON payroll_records FOR ALL TO authenticated
  USING (get_user_role() = 'admin')
  WITH CHECK (get_user_role() = 'admin');
