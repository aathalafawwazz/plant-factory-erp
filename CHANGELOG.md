# Changelog

Semua perubahan berarti di Agrosphere ERP dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versi semantik belum diterapkan (masih pre-1.0, sprint-based).

Entri detail per rilis/sprint — termasuk rationale, migrasi DB, dan catatan upgrade — tersedia di [`docs/changelog/`](docs/changelog/).

---

## [Unreleased]

### Added

- Bottom nav mobile sekarang punya tombol **More** (ikon `MoreHorizontal`) yang membuka bottom-sheet berisi seluruh menu (Inventory, HR, Research, Visits, dll.) — sebelumnya mobile hanya bisa akses 4 menu (Dashboard, Cultivation, Calendar, Sales). List di sheet di-filter per role memakai `filterNavByRole(NAV_ITEMS, role)` (sama seperti `<DesktopSidebar>`), grup ber-children bisa di-expand/collapse, dan tap link auto-close sheet. Key i18n baru: `nav.more`, `nav.all_menus`.
- Middleware `src/middleware.ts` sekarang enforce: (a) unauthenticated → `/login`, (b) `status='pending'|'suspended'` → `/account-status`, (c) role-gated route prefix (via `ROUTE_ROLE_GATES` di `@/lib/auth-helpers`) → redirect ke `/` dengan `?denied=<path>`.
- `<CurrentUserProvider>` + hook `useCurrentUser()` / `useHasRole()` — identity + role + status dibagi ke tree client tanpa round-trip extra.
- `<RoleGate roles="..."|"any" fallback disableInstead allowAlumni>` — element-level hide/disable tombol/kolom sensitif.
- `<RouteDenialToast>` — baca `?denied=` dari URL, toast peringatan, lalu clean URL. Mount di dashboard layout.
- Halaman `/account-status` — lander untuk user `pending`/`suspended` dengan pesan yang jelas + logout.
- Sidebar (desktop + bottom nav) sekarang filter menu per role — researcher tidak lihat HR/Inventory/Sales, viewer tidak lihat HR, dst.
- `<RoleGate roles="admin">` diterapkan di: tombol Delete expense (`/pengeluaran`), tombol Generate Payroll (`/hr/penggajian`).
- Helper `getCurrentUser()` di `@/lib/auth-helpers` — single server-side fetch identity + role + status.

### Docs

- [`docs/sprint-2-test-users.md`](docs/sprint-2-test-users.md) — panduan seed akun test (operator/researcher/supervisor/viewer/pending/suspended/alumni) + checklist per-role untuk verifikasi middleware + RLS.

Sprint 2 phase berikutnya: landing page publik `/` + self-register routes (`/daftar/peneliti`, `/daftar/dosen`, `/tur`) + admin approval queue (`/settings/users`).

---

## [Sprint 2 — schema] — 2026-04-24 — Role System + Audit Trail (applied)

### Added

- Migrasi `00015` applied — enum `user_role` sekarang berisi `admin|operator|viewer|researcher|supervisor`.
- Migrasi `00016` applied — enum `profile_status` (`active|alumni|suspended|pending`) + 5 kolom baru di `profiles` (`status`, `status_changed_at`, `status_reason`, `approved_by`, `approved_at`); tabel `research_supervisors` (M2M dosen ↔ proyek, dengan `supervisor_role` enum); tabel `audit_logs` write-once + generic trigger `audit_row_change(pk_col)`; 12 audit trigger terpasang di tabel kritis (profiles, holes, batches, planting_cycles, inventory_items, inventory_transactions, expenses, sales_orders, payroll_records, research_projects, research_supervisors, visits); 5 helper fn RLS (`is_active_user`, `current_profile_status`, `is_supervisor_of`, `is_owner_of_project`, `is_staff`).
- Migrasi `00017` applied — RLS rewrite per matrix 5-role × 4-status untuk ~26 tabel; trigger `trg_profiles_prevent_self_escalation` mencegah user non-admin ubah role/status sendiri.
- TypeScript types di `src/lib/types/database.ts` disinkronkan: enum baru (`ProfileStatus`, `SupervisorRole`, `AuditOp`), tabel baru (`research_supervisors`, `audit_logs`), kolom baru di `profiles`.

### Fixed

- 00017 draft → apply: skip `workload_logs` (tabel tidak pernah dibuat di 00005), rename `visit_documents` → `visit_attachments` sesuai 00014, fix nama kolom FK research-* dari `project_id` → `research_id`, wrap `EXECUTE string_agg(...)` dengan `COALESCE(..., '')` untuk handle tabel tanpa policy existing.

Detail: [`docs/changelog/sprint-2-draft.md`](docs/changelog/sprint-2-draft.md) (status diubah ke Applied).

---

## [Sprint 1] — 2026-04-24 — Polish Foundation

Commits: `70c54bc` (chore), `05f16b4` (feat).

### Added

- Shortcut keyboard global: `Ctrl+Shift+D` cycle theme, `Ctrl+Shift+L` toggle bahasa, `Ctrl+B` collapse sidebar ([`src/components/keyboard-shortcuts.tsx`](src/components/keyboard-shortcuts.tsx)).
- Error boundary route-level untuk dashboard ([`src/app/(dashboard)/error.tsx`](src/app/(dashboard)/error.tsx)).
- Server-side i18n helpers: `getServerT()` + `getServerI18n()` ([`src/lib/i18n-server.ts`](src/lib/i18n-server.ts)).
- Translate helpers data-driven: `translateCommodity` (100+ alias tanaman), `translateJobTitle`, `translateInventoryCategory`, `translateExpenseCategory`, `formatDateLocale`, `formatDateTimeLocale` ([`src/lib/translate-helpers.ts`](src/lib/translate-helpers.ts)).
- Pre-commit git hook untuk `tsc --noEmit` ([`.githooks/pre-commit`](.githooks/pre-commit)).
- Script `bun run typecheck` + `bun run check`.
- Contributor guide di [`AGENTS.md`](AGENTS.md).

### Changed

- **Brand rename**: Plant Factory ERP → Agrosphere (metadata, navbar, dropdown user).
- **Font**: Inter → Poppins (weights 400/500/600/700).
- **Primary color**: electric blue (hue 260) → brand teal `#0AD1C8` (hue 192) di seluruh token light+dark.
- Light theme di-refactor: off-white dengan subtle teal tint, card/sidebar pure white, border lebih visible, scrollbar theme-aware.
- Dict i18n diperluas dari ~50 → ~1770 entry, pecah jadi `i18n-dict.ts` (non-client, server-safe) + `i18n.tsx` (React context).
- Language switch sekarang `router.refresh()` otomatis — server components ikut re-render tanpa F5 manual.
- Popup settings di top-navbar dilebarkan (w-56 → w-[280px]) supaya opsi "System" tidak overflow.

### Fixed

- `Button` shadcn sekarang support `asChild` via base-ui `render` prop.
- `research-detail.tsx` Select `onValueChange` type coercion.
- `visit-trend-chart.tsx` Formatter signature align dengan recharts `ValueType | undefined`.
- `riset/page.tsx` `'never'` type narrowing via explicit `ProjectWithAllocs` cast + `Boolean()` wrap.
- Sidebar (desktop + mobile) hardcoded `bg-[oklch(0.11_...)]` → pakai token `bg-sidebar` theme-aware.
- Semua inline hex/oklch di panels/badges/charts diberi `dark:` variant (status hole, harvest grade, dashboard metric, commodity palette, calendar event blocks).
- `i18n` runtime error saat server render fixed dengan split client/non-client module.

### Infrastructure

- `.gitignore`: exclude `reference/` (berisi credential + brand asset) dan `.claude/settings.local.json`.
- 56 file terhubung ke i18n (vs 30 sebelumnya). Semua modul bilingual (ID/EN).
- TypeScript: 0 error (turun dari ~40).

Detail: [`docs/changelog/sprint-1.md`](docs/changelog/sprint-1.md).

---

## [Pre-Sprint] — baseline

Snapshot awal commit `aca034c`: dashboard, cultivation, harvest, environment, nutrient, commodity, reports, inventory, expenses, HR (attendance/workload/payroll), sales (customers/orders/log/report), research module, visits module, calendar. Supabase migration 00001–00014.
