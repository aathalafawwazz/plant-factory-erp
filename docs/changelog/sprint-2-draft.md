# Sprint 2 — Role System + Audit Trail (APPLIED)

**Tanggal:** 2026-04-24
**Commits:** `85547ba`
**Status:** ✅ Applied to hosted Supabase `bmavkufkbdprcrllqojj` via SQL Editor. Next.js types sync + typecheck 0 error.

## Konteks

Sebelum `/daftar/peneliti`, `/daftar/dosen`, `/tur` dibuka untuk user luar SARC, sistem butuh:

1. **Role system 5-layer** — `admin`, `operator`, `researcher`, `supervisor` (dosen pembimbing, baru), `viewer`.
2. **Profile status** — `active` / `pending` (self-register menunggu approve admin) / `suspended` / `alumni` (ex-peneliti, read-only).
3. **Supervisor many-to-many** — satu proyek bisa punya banyak dosen pembimbing, satu dosen bisa bimbing banyak proyek.
4. **Audit trail** — setiap perubahan di tabel kritis (holes, batches, expenses, payroll, research_projects, …) masuk `audit_logs` supaya bisa di-review admin.
5. **RLS rewrite** — policy per tabel × per role × per status harus match matrix di [`docs/sprint-2-rls-matrix.md`](../sprint-2-rls-matrix.md).

## Perubahan teknis (draft)

### Migration files

1. [`supabase/migrations/00015_supervisor_enum.sql`](../../supabase/migrations/00015_supervisor_enum.sql) — `ALTER TYPE user_role ADD VALUE 'supervisor'`. Harus commit ke transaksi sendiri (Postgres limitation).
2. [`supabase/migrations/00016_sprint2_schema.sql`](../../supabase/migrations/00016_sprint2_schema.sql):
   - `profile_status` enum + kolom `profiles.status/status_reason/status_changed_at/approved_by/approved_at`.
   - Tabel `research_supervisors` (M2M, ada `role: primary|co|external`, `released_at` untuk soft-release).
   - Tabel `audit_logs` + generic trigger `audit_row_change(pk_col)` + trigger di 12 tabel kritis.
   - Helper fn RLS: `is_active_user()`, `current_profile_status()`, `is_supervisor_of(pid)`, `is_owner_of_project(pid)`, `is_staff()`. Semua `STABLE SECURITY DEFINER`.
3. [`supabase/migrations/00017_sprint2_rls_rewrite.sql`](../../supabase/migrations/00017_sprint2_rls_rewrite.sql):
   - DROP semua policy lama (looped via `pg_policies` lookup supaya tidak bergantung ke nama legacy).
   - CREATE policy baru per matrix.
   - Trigger anti-escalation `profiles_prevent_self_escalation` — user non-admin yang UPDATE `role`/`status` sendiri akan error.

### Decisions yang sudah di-seal (2026-04-24)

| # | Q | Jawaban |
|---|---|---|
| 1 | Alumni baca review dosen di proyek sendiri | Ya |
| 2 | Operator baca payroll tim | Ya (write tetap admin-only) |
| 3 | Researcher baca holes | Full read (tidak scoped) |
| 4 | Audit log retention | Skip (revisit ~1M rows) |
| 5 | Self-register pending | App UPDATE setelah `signUp()` |

## Upgrade steps (untuk nanti saat apply)

Urutan wajib:

```sh
# 1. Supervisor enum — commit sendiri
supabase migration up --to 00015_supervisor_enum
# VERIFIKASI: SELECT enum_range(NULL::user_role); harus berisi 'supervisor'

# 2. Schema + helpers + audit
supabase migration up --to 00016_sprint2_schema

# 3. RLS rewrite (DROP+CREATE seluruh policy)
supabase migration up --to 00017_sprint2_rls_rewrite

# 4. Regenerate TypeScript types
supabase gen types typescript --local > src/lib/types/database.ts

# 5. Typecheck — harus 0 error
bun run typecheck
```

Kalau pakai Supabase hosted (bukan local), jalankan 3 migration ini **di SQL editor satu per satu** dengan klik Run ulang antara 00015 dan 00016 (tidak bisa batch karena enum limitation).

## Rollback

- Urutan balik: drop policy 00017 → drop tabel & kolom 00016 → `ALTER TYPE user_role DROP VALUE 'supervisor'` **tidak didukung Postgres**; kalau bener-bener harus hapus enum value, harus recreate enum (downtime).
- Saran: kalau apply 00015 saja dan gagal di 00016, tidak perlu rollback enum — biarkan nilai `supervisor` di enum, lanjut debug 00016.

## Open follow-ups untuk sprint berikutnya

- Middleware + `<CurrentUserProvider>` + `<RoleGate>` component — gate halaman & element berdasarkan role.
- Landing page `/` publik + 3 CTA (Daftar Peneliti, Daftar Dosen, Daftar Tur).
- Route `/daftar/peneliti`, `/daftar/dosen`, `/tur`, + admin approval queue di `/settings/users`.
- Dashboard widget conditional per role.
- Sidebar menu conditional per role.
- Alumni lifecycle (scheduled job yang auto-flip ex-researcher ke `status='alumni'` setelah proyek `completed` + N bulan).

## Fixes selama apply

Saat 00017 di-run pertama kali ada 4 hal yang perlu dibenerin di draft:

1. `workload_logs` — tabel tidak pernah dibuat di 00005; referensi dihapus dari 00017. Policies untuk tabel ini akan ditambah di migration mendatang saat tabel dibuat.
2. `visit_documents` → `visit_attachments` — nama tabel sebenarnya di 00014.
3. `project_id` → `research_id` — kolom FK di `research_hole_allocations`, `research_progress_logs`, `research_attachments`, `research_materials` memakai nama `research_id` (bukan `project_id` seperti di tabel baru `research_supervisors`).
4. `EXECUTE (SELECT string_agg(...))` return NULL saat tabel belum punya policy apapun → error `22004`. Dibungkus `COALESCE(..., '')` supaya jalan juga untuk tabel kosong.

## Status tracking

- [x] Draft migration 00015/00016/00017
- [x] RLS matrix doc
- [x] Open questions answered
- [x] Apply migrations di Supabase (hosted)
- [x] Update `src/lib/types/database.ts` manual sync
- [x] Typecheck clean (0 error)
- [x] Commit migration + types (`85547ba`)
- [ ] Lanjut ke middleware + `<CurrentUserProvider>` + `<RoleGate>`
- [ ] Landing page `/` + self-register routes
