# Sprint 2 — RLS Policy Matrix

Human-readable source of truth for the RLS rewrite in migration `00017`. Review this table before approving the migration; every cell maps to a specific `CREATE POLICY` clause.

---

## Roles (5)

| Role | Who | Notes |
|---|---|---|
| `admin` | SARC staff managing the system | Full CRUD on everything. |
| `operator` | Production/lab staff | CRUD on cultivation, inventory, expenses, sales, visits. Read-only on HR of others. Can link supervisors to projects. |
| `researcher` | Mahasiswa / internal peneliti | CRUD only on their OWN research projects (rows where `created_by = auth.uid()`). Read cultivation context to plan. No sales/HR/expenses. |
| `supervisor` | Dosen pembimbing | Read projects they supervise + review via `research_progress_logs`. Cannot insert/delete projects. Multi-project via `research_supervisors`. |
| `viewer` | Default ; juga alumni bila `status='alumni'` ; pengunjung ber-akun | Read-only catalogue + sales summary. No HR/expenses/research-private. |

## Profile statuses (orthogonal to role)

| Status | Meaning | Effect via RLS |
|---|---|---|
| `active` | Normal account | Full role permissions apply. |
| `pending` | Just self-registered | Can only read/update own profile. Cannot read or write anything else. |
| `suspended` | Admin-disabled | Same as `pending` — profile-self-only. |
| `alumni` | Ex-researcher, kept for archival | Read-only; research tables carve-out returns rows they created. |

`is_active_user()` returns TRUE only for `status='active'`. It's on EVERY write policy.

---

## Table × role permission matrix

Legend: `C`=INSERT, `R`=SELECT, `U`=UPDATE, `D`=DELETE, `—`=denied, `*`=conditional (see notes).

### Core cultivation (read for everyone active; write for staff)

| Table | admin | operator | researcher | supervisor | viewer | alumni |
|---|---|---|---|---|---|---|
| `holes`              | CRUD | CRUD | R | R | R | R |
| `planting_cycles`    | CRUD | CRUD | R | R | R | R |
| `batches`            | CRUD | CRUD | R | R | R | R |
| `crop_catalog`       | CRUD | CRUD | R | R | R | R |
| `environmental_logs` | CRUD | CRUD | R | R | R | R |
| `nutrient_logs`      | CRUD | CRUD | R | R | R | R |
| `planting_photos`    | CRUD | CRUD | R | R | R | R |

### Profiles

| Action | admin | non-admin |
|---|---|---|
| SELECT all | ✓ | ✓ (when active/alumni), self-only (when pending/suspended) |
| UPDATE self | ✓ | ✓ — **but trigger blocks `role` / `status` change from non-admin** |
| INSERT | ✓ | — (auth trigger handles new-signup row) |
| DELETE | ✓ | — |

### Inventory + Expenses

| Table | admin | operator | researcher | supervisor | viewer |
|---|---|---|---|---|---|
| `inventory_items`        | CRUD | CRU+D | — | — | R |
| `inventory_transactions` | CRUD | CRU+D | — | — | R |
| `expenses`               | CRUD | CRU   | — | — | — |
| `expenses` DELETE        | D    | —     | — | — | — |

Viewer reads inventory (names, stock count) but UI hides cost columns. RLS does not hide columns — app layer does.

### HR

| Table | admin | operator | researcher/supervisor/viewer |
|---|---|---|---|
| `employee_details` | CRUD | R self + U self | R self + U self |
| `attendance_logs`  | CRUD | R any ; C self only | R self only |
| `payroll_records`  | CRUD | R team           | R self |

Operators can check attendance of anyone (team view) but can only self-INSERT new attendance rows. Payroll reads are admin + operator (team-wide); researchers/supervisors/viewers read own only. Writes stay admin-only because payroll carries direct financial impact and is audit-sensitive.

`workload_logs` was planned in the original matrix but the table does not yet exist in the DB (will come in a future HR extension). Policies omitted from 00017.

### Sales

| Table | admin | operator | viewer | researcher/supervisor |
|---|---|---|---|---|
| `customers`          | CRUD | CRUD | R | — |
| `sales_orders`       | CRUD | CRUD | R | — |
| `sales_order_items`  | CRUD | CRUD | R | — |
| `price_history`      | CRUD | CRUD | R | — |
| `payment_logs`       | CRUD | CRUD | R | — |

### Research

| Table | admin | operator | researcher (owner = `created_by=uid`) | supervisor (via `research_supervisors`) | viewer | alumni |
|---|---|---|---|---|---|---|
| `research_projects`        | CRUD | CRUD | C, R any, U/D own                   | R any, U supervised                | R | R own only |
| `research_supervisors`     | CRUD | CRUD | R                                   | R                                  | R | R |
| `research_hole_allocations`| CRUD | CRUD | CRUD on own project                 | R supervised                       | R | R |
| `research_progress_logs`   | CRUD | CRUD | CRUD on own project                 | CRUD on supervised (review notes)  | R | R |
| `research_attachments`     | CRUD | CRUD | CRUD on own project                 | R supervised                       | R | R |
| `research_materials`       | CRUD | CRUD | CRUD on own project                 | R supervised                       | R | R |

Notes:
- "own project" means `research_projects.created_by = auth.uid()` — validated by helper `is_owner_of_project(project_id)`.
- "supervised" means there exists an unreleased row in `research_supervisors` linking the current user to the project — helper `is_supervisor_of(project_id)`.
- `research_projects DELETE` is admin-only regardless.

### Visits

| Table | admin | operator | researcher/supervisor/viewer |
|---|---|---|---|
| `visits`           | CRUD | CRUD | R |
| `visit_contacts`   | CRUD | CRUD | R |
| `visit_attachments`  | CRUD | CRUD | R |

### Audit

| Table | admin | anyone else |
|---|---|---|
| `audit_logs` | R | — |

Writes only happen via the `SECURITY DEFINER` trigger `audit_row_change()`. Direct client writes are denied; UPDATE/DELETE have no policy → denied by default.

---

## Helper functions (defined in `00016`)

| Function | Returns | Purpose |
|---|---|---|
| `get_user_role()`          | `user_role` | Already existed; snapshot of `profiles.role`. |
| `is_active_user()`         | `boolean` | TRUE iff `profiles.status='active'`. |
| `current_profile_status()` | `profile_status` | Read-only getter. |
| `is_staff()`               | `boolean` | `role IN (admin, operator)`. |
| `is_supervisor_of(pid)`    | `boolean` | Active supervising link exists. |
| `is_owner_of_project(pid)` | `boolean` | `research_projects.created_by = uid`. |

All are `STABLE SECURITY DEFINER` so they bypass the caller's RLS on lookup (lookup tables themselves: `profiles`, `research_supervisors`, `research_projects`).

---

## Audit triggers

Generic function `audit_row_change(pk_col_name)` mirrors every INSERT/UPDATE/DELETE on the attached tables into `audit_logs` with:
- timestamp, `user_id` + `user_role` snapshot
- full `before_row` / `after_row` as JSONB
- `changed_cols` array for UPDATE

Attached to: `profiles`, `holes`, `batches`, `planting_cycles`, `inventory_items`, `inventory_transactions`, `expenses`, `sales_orders`, `payroll_records`, `research_projects`, `research_supervisors`, `visits`.

To add coverage later: copy the `CREATE TRIGGER aud_<table> AFTER INSERT OR UPDATE OR DELETE ON <table> FOR EACH ROW EXECUTE FUNCTION audit_row_change('<pk-col>');` pattern.

---

## Migration run order

Postgres does not allow a newly-added enum value to be used in the same transaction that adds it.

```
00015_supervisor_enum.sql       ← run first (adds 'supervisor')
                                ← COMMIT ; start a new session
00016_sprint2_schema.sql        ← schema + helpers + audit triggers
00017_sprint2_rls_rewrite.sql   ← drops old policies, installs matrix
```

For local Supabase dev: `supabase migration up` should run them in order automatically because each file commits before the next starts. For prod: apply manually in sequence, confirming the new enum value is visible with `SELECT enum_range(NULL::user_role);` after 00015 before running 00016.

---

## Decisions (answered 2026-04-24)

1. **Alumni project access** → ✅ Yes — alumni can read supervisor reviews (`research_progress_logs`) on their own past projects. Already in 00017.
2. **Operator visibility on payroll** → ✅ Admin + operator can read team payroll. Writes stay admin-only. Applied to 00017 `payroll_select`.
3. **Researcher read on holes** → ✅ Full read of all holes (not scoped). Already in 00017.
4. **Audit retention** → ✅ No purge in Sprint 2. Revisit when `audit_logs` grows past ~1M rows (likely ~year 2 of ops). Monthly partition job is the future path.
5. **Self-register `status='pending'`** → ✅ Option (a): app-layer overrides via `UPDATE profiles SET status='pending' WHERE id=...` immediately after supabase `signUp()` on the public `/daftar/*` routes. Trigger `handle_new_user` left untouched — admin-created accounts via `/settings/users` invite flow still land as `active`.

---

## Test plan after apply

For each of the 5 roles (+ alumni), using one seeded account each:

1. Log in as role → verify `SELECT` on every table returns the expected row set (empty for denied, full for allowed, scoped for conditional).
2. Attempt forbidden INSERT / UPDATE / DELETE → expect `42501: new row violates row-level security policy`.
3. Researcher attempts to modify another researcher's project → expect denial.
4. Supervisor inserts a progress_log on a supervised project → expect success; on an unsupervised project → denial.
5. Self-update profile: change role → expect trigger error.
6. Alumni reads own old project → expect the row; alumni reads someone else's project → expect 0 rows.
7. Admin reads `audit_logs` → expect rows from every change above, with correct `user_id` / `op`.
