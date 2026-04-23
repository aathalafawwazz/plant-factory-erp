# Sprint 1 — Translation Roadmap (Wave 2+)

> **Status**: Wave 1 selesai. Wave 2+ dijalankan di session berikutnya.
> **Default lang**: sudah diubah ke `en` di [src/lib/i18n.tsx](../src/lib/i18n.tsx).
> **Toggle bahasa**: aktif di login page + top navbar (via `useLang()`).

---

## ✅ Yang Sudah Selesai (Wave 1)

### Fondasi
- [x] Expand `src/lib/i18n.tsx` dict dengan **~150 key baru** (status, types, phases, areas, units, common, dashboard)
- [x] Set `DEFAULT_LANG = "en"` di `LangProvider`
- [x] Expose `translate(key, lang)` helper untuk non-client context

### Constants instrumentation
- [x] [src/lib/constants.ts](../src/lib/constants.ts): `HOLE_STATUS`, `VISUAL_CONDITIONS`, `POST_HARVEST_HANDLING` + `labelKey`
- [x] [src/lib/research-meta.ts](../src/lib/research-meta.ts): `RESEARCH_STATUS_META`, `RESEARCH_TYPE_KEY`, `RESEARCH_PHASE_KEY`
- [x] [src/lib/visit-meta.ts](../src/lib/visit-meta.ts): `VISIT_STATUS_META`, `VISIT_TYPE_META`, `VISIT_AREA_KEY`

### Theme (tidak terkait i18n, tapi parallel di Sprint 1)
- [x] Buat [src/lib/use-chart-theme.ts](../src/lib/use-chart-theme.ts) hook theme-aware Recharts
- [x] Fix 7 file chart (dashboard-charts, visit-trend-chart, lingkungan, nutrisi, panen, sales, sales/laporan) dari hardcoded hex → hook
- [x] Tooltip, grid, axis sekarang otomatis menyesuaikan theme

---

## 🚧 Wave 2 — Update Komponen untuk Pakai `t()` (BESAR)

**Strategi**: karena ~75 file masih hardcoded Indonesian, tangani per **modul** (bukan per-file) biar konteksnya terjaga.

### Prioritas (berdasarkan visibility + effort ratio)

#### 🔴 P1 — Navigation & Dashboard (harus EN dulu)
Ini muka aplikasi — harus EN-first sebelum external user (dosen/mahasiswa) lihat.

- [ ] **`src/components/nav-sidebar.tsx`** — sudah pakai `t()`, tapi ada hardcode "Bahasa Indonesia" / "English" di language switcher
- [ ] **`src/components/top-navbar.tsx`** — check hardcoded "Agrosphere ERP", badge, dsb
- [ ] **`src/app/(dashboard)/page.tsx`** — dashboard home (~45 hardcoded strings):
  - Title, subtitle, KPI card titles
  - Section headers (Ikhtisar Lingkungan, Ikhtisar Nutrisi, Batch Aktif, Pemasukan, Pengeluaran, dll.)
  - Recent activities labels
  - Footer version
  - Semua sudah punya key di dict (`dashboard.*`), tinggal wire ke `t()`

#### 🟡 P2 — Modul yang sering dipakai
- [ ] **`src/app/(dashboard)/lubang/page.tsx`** + [rack-map.tsx](../src/components/rack-map.tsx) — peta lubang (high traffic)
- [ ] **`src/app/(dashboard)/panen/page.tsx`** — harvest management
- [ ] **`src/app/(dashboard)/lingkungan/page.tsx`** + baru/
- [ ] **`src/app/(dashboard)/nutrisi/page.tsx`** + baru/
- [ ] **`src/app/(dashboard)/tanam/baru/page.tsx`** — planting form
- [ ] **`src/app/(dashboard)/kalender/page.tsx`** — calendar view
- [ ] **`src/app/(dashboard)/riset/**`** — research pages
- [ ] **`src/app/(dashboard)/kunjungan/**`** — visit pages
- [ ] **`src/components/rack-map.tsx`** — bulk plant modal, action buttons

#### 🟢 P3 — Modul yang lebih internal (admin/ops-oriented)
- [ ] **`src/app/(dashboard)/hr/**`** — HR pages
- [ ] **`src/app/(dashboard)/sales/**`** — Sales pages
- [ ] **`src/app/(dashboard)/inventory/**`** — Inventory
- [ ] **`src/app/(dashboard)/pengeluaran/**`** — Expenses
- [ ] **`src/app/(dashboard)/komoditas/page.tsx`** — Commodities
- [ ] **`src/app/(dashboard)/laporan/page.tsx`** — Reports

#### ⚫ P4 — Detail komponen lain
- [ ] [src/components/research-detail.tsx](../src/components/research-detail.tsx) (~30 strings)
- [ ] [src/components/visit-detail.tsx](../src/components/visit-detail.tsx) (~20 strings)
- [ ] [src/components/hole-detail-panel.tsx](../src/components/hole-detail-panel.tsx) (~15 strings)
- [ ] [src/components/research-hole-picker.tsx](../src/components/research-hole-picker.tsx)
- [ ] [src/components/research-mini-rackmap.tsx](../src/components/research-mini-rackmap.tsx)
- [ ] [src/components/research-list-tabs.tsx](../src/components/research-list-tabs.tsx)
- [ ] [src/components/visit-list-tabs.tsx](../src/components/visit-list-tabs.tsx)
- [ ] [src/components/dashboard-charts.tsx](../src/components/dashboard-charts.tsx) — legend labels
- [ ] [src/components/hole-action-panel.tsx](../src/components/hole-action-panel.tsx)
- [ ] [src/components/plant-log-section.tsx](../src/components/plant-log-section.tsx)
- [ ] [src/components/hole-status-stats.tsx](../src/components/hole-status-stats.tsx)
- [ ] [src/components/floating-form.tsx](../src/components/floating-form.tsx) — title prop passing

### Pola refactor per file

1. **Tambah import** di atas file:
   ```tsx
   import { useLang } from "@/lib/i18n";
   ```

2. **Tambah hook** di awal body component (client component only):
   ```tsx
   const { t } = useLang();
   ```

3. **Ganti string literal** dengan `t("namespace.key")`:
   ```tsx
   // Before
   <h1>Dashboard</h1>
   <p>Ringkasan kondisi plant factory</p>
   
   // After
   <h1>{t("dashboard.title")}</h1>
   <p>{t("dashboard.subtitle")}</p>
   ```

4. **Untuk dynamic string** (interpolation), biarkan string template literal tapi translate label-nya:
   ```tsx
   // Before
   `${count} lubang`
   
   // After
   `${count} ${t(count === 1 ? "unit.hole" : "unit.holes")}`
   ```

5. **Untuk server component**, pakai `translate(key, lang)` helper:
   ```tsx
   // Butuh lang dari cookie/context — untuk now bisa hardcode default atau wrap client component
   import { translate } from "@/lib/i18n";
   const title = translate("dashboard.title", "en");
   ```

### Gap di dict yang perlu ditambah saat kerja Wave 2

Saat menemukan string baru, tambahkan key di [i18n.tsx](../src/lib/i18n.tsx) lengkap dengan pasangan id/en.

Namespace yang sudah ada:
- `nav.*`, `common.*`, `dashboard.*`, `settings.*`
- `hole_status.*`, `cycle_status.*`
- `research_status.*`, `research_type.*`, `research_phase.*`
- `visit_status.*`, `visit_type.*`, `visit_type_short.*`, `visit_area.*`
- `visual.*`, `handling.*`, `grade.*`
- `unit.*`

Namespace baru yang mungkin perlu (belum dibuat):
- `form.*` — field labels umum (email, password, date, time, notes)
- `action.*` — button labels (confirm, approve, reject, export, download)
- `empty.*` — empty states ("No data yet", "Nothing to show")
- `error.*` — error messages
- `toast.*` — toast success/warning/error patterns
- `page.*` — page titles per modul (`page.harvest`, `page.inventory`, dll.)

---

## Estimasi Effort Wave 2+

| Priority | Files | Strings | Effort |
|----------|-------|---------|--------|
| P1 (nav + dashboard) | 3 | ~60 | 2-3 jam |
| P2 (modul utama) | 12 | ~200 | 8-10 jam |
| P3 (modul admin) | 15 | ~150 | 6-8 jam |
| P4 (komponen detail) | 13 | ~150 | 6-8 jam |
| **Total** | **43** | **~560** | **22-29 jam** |

Bisa dikerjakan bertahap — tidak harus sekali session.

---

## Cara Pick Up di Session Berikutnya

Cukup bilang salah satu:
- **"Lanjut Wave 2 P1"** → saya kerjakan nav-sidebar + top-navbar + dashboard
- **"Translate modul X"** → pick modul specific (mis. "translate modul riset")
- **"Audit string baru yang muncul"** → scan perubahan recent, tambah key yang kurang

Atau kalau user punya preferensi urutan sendiri, sebut saja file mana duluan.

---

## Catatan Penting

- **Jangan hapus ID** — bilingual toggle penting, user bisa switch sewaktu-waktu
- **Label database tetap sebagaimana adanya** (`crop_catalog.name_id`, dsb) — itu data bukan UI string
- **URL paths biarkan** (`/lubang`, `/panen`, `/tanam`) — slug tidak user-visible
- **Test setiap wave**: toggle EN ↔ ID, pastikan tidak ada key yang fallback ke raw key name
