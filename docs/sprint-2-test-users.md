# Sprint 2 — Test Users Setup

Panduan membuat akun test untuk masing-masing role (sekali saja per environment).

## Kenapa harus via dashboard, bukan SQL langsung?

Tabel `auth.users` dikelola oleh **Supabase Auth** (ada constraint internal, enkripsi password, dll). Langsung `INSERT INTO auth.users` bisa di-tolak / bikin akun tidak bisa login. Cara safe = via Supabase Dashboard Auth UI.

Setelah akun dibuat, kita adjust `profiles.role` + `profiles.status` via SQL.

## Langkah

### 1. Create 4 test accounts via Supabase dashboard

1. Buka [dashboard.supabase.com](https://dashboard.supabase.com) → project → **Authentication** → **Users** → **+ Add user** → **Create new user**.
2. Buat 4 akun berikut. **Password bebas** (pakai yang gampang diingat untuk test — misal `testpass123`), **Auto Confirm User** ✓ agar bisa langsung login tanpa verifikasi email.

| Email | Display name (di form) | Nanti role | Status awal |
|---|---|---|---|
| `test-operator@sarc.test` | Test Operator | operator | active |
| `test-researcher@sarc.test` | Test Researcher | researcher | active |
| `test-supervisor@sarc.test` | Dr. Test Supervisor | supervisor | active |
| `test-viewer@sarc.test` | Test Viewer | viewer | active |

Dashboard default akan create profile via `handle_new_user` trigger dengan `role='viewer'`, `status='active'`.

### 2. Update role via SQL

Di SQL Editor, jalankan (ganti email jika beda):

```sql
-- Set role tiap akun
UPDATE profiles SET role = 'operator'   WHERE id = (SELECT id FROM auth.users WHERE email = 'test-operator@sarc.test');
UPDATE profiles SET role = 'researcher' WHERE id = (SELECT id FROM auth.users WHERE email = 'test-researcher@sarc.test');
UPDATE profiles SET role = 'supervisor' WHERE id = (SELECT id FROM auth.users WHERE email = 'test-supervisor@sarc.test');
UPDATE profiles SET role = 'viewer'     WHERE id = (SELECT id FROM auth.users WHERE email = 'test-viewer@sarc.test');

-- Verifikasi
SELECT p.id, u.email, p.display_name, p.role, p.status
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email LIKE 'test-%@sarc.test'
ORDER BY p.role;
```

Expected: 4 baris dengan role berbeda.

### 3. (Opsional) Link supervisor ke proyek existing untuk test supervisi

Kalau ada `research_projects` existing yang Anda mau test sebagai supervisor:

```sql
-- Ganti <project_id> dengan id proyek riil di DB Anda
INSERT INTO research_supervisors (project_id, supervisor_id, role, assigned_by)
SELECT
  <project_id>,
  (SELECT id FROM auth.users WHERE email = 'test-supervisor@sarc.test'),
  'primary',
  auth.uid()
ON CONFLICT (project_id, supervisor_id) DO NOTHING;
```

### 4. (Opsional) Test status `pending` dan `suspended`

```sql
-- Bikin 2 akun tambahan via dashboard: test-pending@sarc.test, test-suspended@sarc.test

-- Lalu ubah status
UPDATE profiles SET status = 'pending'   WHERE id = (SELECT id FROM auth.users WHERE email = 'test-pending@sarc.test');
UPDATE profiles SET status = 'suspended' WHERE id = (SELECT id FROM auth.users WHERE email = 'test-suspended@sarc.test');
```

### 5. (Opsional) Test alumni

```sql
-- Ganti test-alumni@sarc.test sesuai email yang Anda buat
UPDATE profiles
SET role = 'researcher', status = 'alumni'
WHERE id = (SELECT id FROM auth.users WHERE email = 'test-alumni@sarc.test');
```

## Checklist test per role

Login dengan tiap akun di incognito/private window (supaya session tidak ketuker), lalu verifikasi:

### 🟦 operator (`test-operator@sarc.test`)

- [ ] Sidebar tampil: Dashboard, Cultivation, Inventory, HR, Sales, Research, Visits, Calendar (semua)
- [ ] Akses `/hr/penggajian` berhasil
- [ ] Tombol **Generate Payroll** **tidak muncul** (admin-only)
- [ ] Tombol **Delete** di pengeluaran **tidak muncul**
- [ ] Coba manual URL `/settings/users` → redirect ke `/` dengan toast "Access denied"

### 🟩 researcher (`test-researcher@sarc.test`)

- [ ] Sidebar **tidak punya**: Inventory, HR, Sales (expected, role-gated)
- [ ] Sidebar punya: Dashboard, Cultivation, Research, Visits, Calendar
- [ ] Akses `/hr` → redirect ke `/` + toast
- [ ] Akses `/pengeluaran` → redirect ke `/` + toast
- [ ] Bisa submit research baru di `/riset/baru`

### 🟪 supervisor (`test-supervisor@sarc.test`)

- [ ] Sidebar seperti researcher (no HR/Inventory/Sales)
- [ ] Bisa baca daftar proyek di `/riset`
- [ ] Kalau sudah di-link (step 3), bisa tambah progress log di proyek supervised

### 🟨 viewer (`test-viewer@sarc.test`)

- [ ] Sidebar: Dashboard, Cultivation, Inventory, Sales, Research, Visits, Calendar (tanpa HR)
- [ ] Semua tombol Create/Edit/Delete di-hide atau disabled
- [ ] Cuma bisa browse

### 🟧 pending (`test-pending@sarc.test`)

- [ ] Setelah login, auto-redirect ke `/account-status`
- [ ] Lihat pesan "Akun menunggu persetujuan"
- [ ] Tombol Logout berfungsi

### 🟥 suspended (`test-suspended@sarc.test`)

- [ ] Setelah login, auto-redirect ke `/account-status`
- [ ] Lihat pesan "Akun Anda dinonaktifkan"

### 🟫 alumni (`test-alumni@sarc.test`)

- [ ] Login berhasil, dashboard render (alumni `OR` condition pada RLS `profiles_select`)
- [ ] Hanya bisa lihat research_projects yang `created_by` = dirinya sendiri
- [ ] Write path ditolak oleh `is_active_user()` gate

## Cleanup setelah test (opsional)

```sql
-- Hapus test accounts
DELETE FROM auth.users WHERE email LIKE 'test-%@sarc.test';
-- (cascades ke profiles, research_supervisors, dll)
```
