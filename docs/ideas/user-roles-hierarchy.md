# Ide & Keputusan: Hierarki Role & Alur Kerja Sistem

> **Status**: Sprint 2 onwards (setelah Sprint 1 polish selesai)
> **Tanggal keputusan**: 2026-04-22
> **Kaitan modul**: Authentication, Profile, semua modul via RLS

---

## Ringkasan Keputusan

- **5 role** (bukan 7 seperti draft awal): `admin`, `operator`, `researcher`, `supervisor`, `viewer`
- `admin` = gabungan superadmin + admin + manager (keputusan user)
- **Single-tenant UGM** (tidak multi-tenant)
- **Multi-supervisor per proyek riset** (many-to-many)
- **Alumni** = researcher dengan `profiles.status='alumni'`, read-only via middleware
- **Self-register** diperbolehkan untuk researcher (mahasiswa/peneliti) dan supervisor (dosen)
- **Pengunjung** tidak perlu akun — cukup records di `visits` table (+ public form `/tur`)
- **Audit log** full-track semua perubahan critical

---

## 1. Role & Permission Matrix

### 5 Role Sistem

| Role | Peran Real-World | Akses |
|------|------------------|-------|
| `admin` | Admin SARC, IT, koordinator, manajer | Full CRUD semua modul, approve workflow, user management |
| `operator` | Staff, pekerja, teknisi | Operasional harian: tanam, panen, log, inventory, check-in |
| `researcher` | Mahasiswa, peneliti profesional | CRUD proyek sendiri, reservasi lubang, log progres, material, dokumen |
| `supervisor` | Dosen pembimbing | Read + approve proyek mahasiswa bimbingannya |
| `viewer` | Pengunjung dengan akun, stakeholder external, alumni | Read-only non-sensitif |

### Matrix Permission per Modul

| Modul | admin | operator | researcher | supervisor | viewer |
|-------|-------|----------|------------|------------|--------|
| Dashboard | R | R | R | R | R |
| Peta Lubang & Cycle | RCUD | RCU | R | R | R |
| Komoditas | RCUD | R | R | R | R |
| Panen | RCUD | RCU | R (own cycle) | R | R |
| Log Lingkungan/Nutrisi | RCUD | RCU | R | R | R |
| Inventory | RCUD | RCU | — | — | R |
| Expenses | RCUD | RCU | — | — | — |
| HR | RCUD | R (own) | — | — | — |
| Sales | RCUD | RCU | — | — | — |
| Riset projects | RCUD + A | R | RCU (own) | R + A (bimbingan) | R (archive own) |
| Riset allocations | RCUD | R | RCU (own) | R | R |
| Riset progress logs | RCUD | R | RCU (own) | R (read + comment) | R (own) |
| Kunjungan | RCUD | RCU (check-in) | — | — | R |
| Kalender | R | R | R (+ own milestones) | R (+ bimbingan) | R |
| Profiles | RCUD | R (limited) | R (own) | R (own + bimbingan) | R (own) |
| System settings | RCUD | — | — | — | — |
| Audit log | R | — | — | — | — |

### Notes
- `R`=Read, `C`=Create, `U`=Update, `D`=Delete, `A`=Approve/state change
- `own` = row-level filter via `auth.uid()` match

---

## 2. Account Lifecycle

```
pending → active → suspended → archived
             ↓
          expired → alumni (khusus researcher)
```

| Status | Bisa login? | Catatan |
|--------|-------------|---------|
| `pending` | Tidak | Menunggu approval admin |
| `active` | Ya | Normal |
| `suspended` | Tidak | Dibekukan sementara |
| `expired` | Tidak | Masa berlaku habis (mis. kontrak) |
| `alumni` | Ya (read-only) | Mahasiswa lulus, akses hanya lihat proyek lama sendiri |
| `archived` | Tidak | Permanen non-aktif, data tetap untuk audit |

**Implementasi**: kolom `profiles.status` + middleware check + kolom `expires_at TIMESTAMPTZ` untuk auto-expire.

---

## 3. Alur Pendaftaran per Role

### Admin, Operator → **Invite-only** (admin-created)
1. Admin buka `/settings/users` → klik "Undang user"
2. Isi email + role + nama
3. Sistem panggil `supabase.auth.admin.inviteUserByEmail()` via Edge Function / Server Action dengan service_role key
4. User terima email → klik link → set password → auto-login

### Researcher (Mahasiswa/Peneliti) → **Self-register + approval**
1. Buka `/daftar/peneliti` (public)
2. Isi form: email (validate domain `@*.ugm.ac.id`), nama, NIM, nama dosen pembimbing, judul proposal riset
3. Submit → auth user dengan `status='pending'`
4. Notif ke admin (via email)
5. Admin review proposal + verify pembimbing
6. Admin approve → `status='active'`, role `researcher`, proyek draft dibuat
7. User terima email "akun diaktifkan"

### Supervisor (Dosen) → **Self-register**
1. Buka `/daftar/dosen` (public, domain UGM filter)
2. Isi: email, NIP, nama lengkap, fakultas
3. Submit → `status='pending'`
4. Admin verify via email atau database UGM
5. Approve → `status='active'`, role `supervisor`

### Pengunjung → **No login** (default) atau **Viewer account** (special case)
- Default: pakai form `/tur` (public, anon insert ke `visits` table)
- Special: admin buat akun `viewer` untuk mitra tetap

---

## 4. Table Changes Needed

### Extend enum `user_role`
- Tambah `supervisor` (sudah ada: admin, operator, researcher, viewer)

### Extend table `profiles`
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending','active','suspended','expired','alumni','archived'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
```

### New table: `research_supervisors` (many-to-many)
```sql
CREATE TABLE research_supervisors (
  research_id   INTEGER NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  supervisor_user_id UUID NOT NULL REFERENCES auth.users(id),
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (research_id, supervisor_user_id)
);
```

### New table: `audit_logs`
```sql
CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL,          -- 'insert', 'update', 'delete', 'approve', etc
  table_name    TEXT NOT NULL,
  row_id        TEXT,
  old_data      JSONB,
  new_data      JSONB,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON audit_logs (table_name, row_id);
CREATE INDEX ON audit_logs (actor_user_id);
CREATE INDEX ON audit_logs (created_at DESC);
```

### Research project schema update
- Hapus kolom `supervisor_name` dan `supervisor_email` yang denormal (move to `research_supervisors`)
- Atau: keep kolom itu untuk backwards-compat + juga tabel many-to-many untuk proper linking

---

## 5. Yang Perlu Dibangun (Ordered)

### Sprint 2 — Landing Page + Role Foundation
1. Landing page `/` dengan 3 CTA self-register
2. Route `/daftar/peneliti`, `/daftar/dosen`
3. Migration 00015: tambah enum `supervisor` (split file)
4. Migration 00016: profile enhancements + `research_supervisors` + `audit_logs` + RLS rewrite
5. Helper SQL functions: `has_role_in()`, `is_research_supervisor_of()`, `is_active_user()`
6. Middleware enhancement: cek `status` (reject suspended/archived), handle alumni read-only
7. `CurrentUserProvider` context + `<RoleGate>` + `<StatusGate>` components

### Sprint 3 — Admin UI + Workflow
8. Halaman `/settings/users` — list, filter, search, invite, edit role, suspend
9. Halaman `/settings/users/pending` — approval queue
10. Supervisor linking UI di detail riset (add/remove supervisor)
11. Supervisor review UI (comment on progress logs, approve milestones)
12. Alumni state transition (manual + auto-expire scheduler)

### Sprint 4 — Audit Log & Dashboard Adaptation
13. Audit log triggers generic function + apply ke semua tabel critical
14. Halaman `/settings/audit` untuk admin
15. Dashboard widget conditional per role
16. Sidebar menu conditional per role

---

## 6. Technical Notes

### RLS Complexity
Pakai helper functions di SQL:
```sql
CREATE OR REPLACE FUNCTION has_role_in(roles user_role[]) RETURNS BOOLEAN AS $$
  SELECT role = ANY(roles) FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_active_user() RETURNS BOOLEAN AS $$
  SELECT status IN ('active','alumni') FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_supervisor_of(research_id INT) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM research_supervisors
    WHERE research_supervisors.research_id = is_supervisor_of.research_id
    AND supervisor_user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE;
```

### UI conditional rendering
Dobel layer: RLS (data security) + UI guards (UX polish).
- `CurrentUserProvider` expose `{ user, profile, role, status }` ke seluruh app
- `<RoleGate allow={["admin","operator"]}>` untuk conditional rendering
- Middleware redirect user yang akses URL tidak berwenang

### Session refresh
Role change via DB tidak auto-refresh JWT user. RLS query `profiles.role` per-request → tidak masalah di backend. Di frontend, `CurrentUserProvider` re-fetch profile on focus/interval.

### Audit log implementation
Generic trigger function:
```sql
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (actor_user_id, action, table_name, row_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id::TEXT ELSE NEW.id::TEXT END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply ke tabel critical:
CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE
  ON planting_cycles FOR EACH ROW EXECUTE FUNCTION audit_trigger();
-- Repeat untuk: batches, visits, research_projects, profiles, expenses, sales_orders
```

---

## 7. Status Implementation

| Task | Sprint | Status |
|------|--------|--------|
| Save ide & decisions (file ini) | - | ✅ Selesai |
| Polish foundation (EN + light theme) | 1 | 🚧 In progress |
| Landing page + self-register | 2 | ⏳ Pending |
| Role migration + RLS rewrite | 2 | ⏳ Pending |
| Admin UI user management | 3 | ⏳ Pending |
| Audit log | 4 | ⏳ Pending |

---

## Pointer untuk Pickup Diskusi

Kalau nanti mau bahas lagi:
- **"Mulai Sprint 2"** → saya langsung mulai migration + landing page
- **"Mari buat role X saja dulu"** → subset specific (mis. supervisor only)
- **"Perlu ubah role architecture"** → balik ke dokumen ini untuk revisi matrix permission
