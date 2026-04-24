# Sprint 1 — Polish Foundation

**Tanggal:** 2026-04-23 … 2026-04-24
**Commits:** `70c54bc` (chore) → `05f16b4` (feat)
**Status:** Applied

## Konteks

Setelah commit `aca034c` (semua modul operasional selesai), sistem siap secara fungsional tapi belum siap demo eksternal:

- Light theme ada tapi banyak spot masih dark-hardcoded — sidebar tetap gelap, chart bertabrakan, badges invisible.
- Hanya ~3 dari ~78 file komponen menggunakan `t()` — 96% string hardcoded dalam Bahasa Indonesia.
- Brand masih "Plant Factory ERP" sedangkan partner ingin pakai "Agrosphere" untuk rilis ke luar SARC.
- ±40 TypeScript error menumpuk sejak modul HR/Sales/Research/Visits ditambahkan.

Tujuan Sprint 1: bikin permukaan aplikasi siap dipamerkan (EN default, toggle ID, light theme rapi, toggle tanpa F5, zero TS error) sebelum masuk perubahan arsitektur di Sprint 2.

## Perubahan teknis

### Brand + typography

- Semua metadata, `<title>`, dropdown profile: "Plant Factory ERP" → "Agrosphere".
- Font: Inter → Poppins (weights 400/500/600/700).
- Logo SVG di `public/agrosphere-logo.svg` + gradient teal `#45DFB1 → #0AD1C8`.

### Light theme refactor (rounds 2)

- `src/app/globals.css` `:root` palette: background off-white tinted teal (0.975 L), card/sidebar pure white, primary teal 0.58 L (AA contrast di atas white), border naik jadi visible 0.905.
- `.dark` ikut di-harmonisasi ke teal primary supaya tidak ada gap saat toggle.
- Scrollbar jadi theme-aware (grey di light, darker di dark).
- `src/components/nav-sidebar.tsx` hardcoded `bg-[oklch(0.11_0.005_260)]` → pakai token `bg-sidebar`.
- `HOLE_STATUS` di `constants.ts` sekarang tiap entry punya `color/dotColor/cellColor` dengan varian `dark:` — light mode pakai darker ink + softer tint.
- `hole-status-stats.tsx`, `hole-action-panel.tsx`, `hole-detail-panel.tsx`, `dashboard/page.tsx`, `lingkungan/page.tsx`, `panen/page.tsx`, `plant-log-section.tsx` — semua badge + action button di-add `dark:` variants.
- Kalender `EVENT_STYLES` di-fix: `bg-blue-500/15 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200` (dari yang pale-200 invisible di white).

### Bilingual i18n (EN default, toggle ID)

Infrastruktur dibagi 3 modul:

| Modul | Scope |
|---|---|
| `src/lib/i18n-dict.ts` | Plain module (tidak `"use client"`). Berisi `dict`, `translate(key, lang)`, `type Lang`, `DEFAULT_LANG`. Aman diimpor dari server. |
| `src/lib/i18n.tsx` | Client module. React context, `<LangProvider>`, `useLang()`. Mirror `setLang` ke cookie `pfms-lang` + panggil `router.refresh()` supaya server component re-render otomatis. |
| `src/lib/i18n-server.ts` | Server module. `getServerLang()`, `getServerT()`, `getServerI18n()` — baca cookie saat SSR. |

Dict diperluas dari ~50 → ~1770 entry. Namespace: `nav.*`, `common.*`, `dashboard.*`, `cult.*`, `env.*`, `nut.*`, `inv.*`, `hr.*`, `pay.*`, `sales.*`, `visit.*`, `research.*`, `cal.*`, `rd.*`, `crop_form.*`, `hole_status.*`, `cycle_status.*`, `visual.*`, `handling.*`, `grade.*`, `unit.*`, `month.*`, `day.*`, `day_short.*`, `form.*`, `toast.*`, `page.*`, `error.*`, `settings.*`, `report.*`, `rmap.*`, `plog.*`, `dmc.*`, `dpc.*`, `vtc.*`.

Data-driven labels lewat `translate-helpers.ts`:
- `translateCommodity(name, lang)` — alias map 100+ tanaman (Bayam Hijau → Green Spinach). Nama custom user lewat tanpa di-translate.
- `translateJobTitle(title, lang)` — 10 alias jabatan umum SARC.
- `translateInventoryCategory` + `translateExpenseCategory` — enum label.
- `formatDateLocale` + `formatDateTimeLocale` — auto pakai `en-US`/`id-ID`.

56 file akhir terhubung ke i18n. HOLE_STATUS/VISUAL_CONDITIONS/POST_HARVEST_HANDLING sekarang di-render via `t(c.labelKey)`, bukan `.label`.

### UX polish

- `src/components/keyboard-shortcuts.tsx` — shortcut global, dipasang dari dashboard layout. Skip saat fokus di input/textarea/contenteditable.
- `src/app/(dashboard)/error.tsx` — route-level error boundary dengan retry, back-home, collapsible technical details.
- Popup settings top-navbar dilebarkan `w-56 → w-[280px]` supaya opsi "System" tidak overflow.

### TS fixes (0 error final)

- `src/components/ui/button.tsx` — tambah `asChild` prop, forward ke base-ui `render` prop.
- `src/components/research-detail.tsx` — Select `onValueChange` coerce against `string | null`.
- `src/components/visit-trend-chart.tsx` — tooltip formatter align recharts `ValueType | undefined`.
- `src/app/(dashboard)/riset/page.tsx` — explicit `ProjectWithAllocs` cast + `Boolean(...)` wrap untuk `overdue` supaya nested joined select tidak narrow ke `never`.

### Infrastructure

- `.gitignore` — exclude `reference/` (brand asset + credential) + `.claude/settings.local.json`.
- `.githooks/pre-commit` — run `bun x tsc --noEmit` hanya kalau ada `.ts`/`.tsx` staged. Aktifkan per clone: `git config core.hooksPath .githooks`.
- `package.json` script baru: `typecheck`, `check` (typecheck + lint).
- `AGENTS.md` jadi contributor guide lengkap.

## Upgrade steps

Sebagai developer baru clone repo:

1. `bun install`
2. `git config core.hooksPath .githooks`  (aktifkan pre-commit hook)
3. Set env var Supabase seperti biasa.
4. `bun dev`.

Tidak ada migrasi DB baru di sprint ini.

## Rollback

Semua perubahan ada di commit `70c54bc` + `05f16b4`. Kalau perlu mundur:

```sh
git reset --hard aca034c   # destruktif, reset ke sebelum Sprint 1
```

Atau mundur per-file via `git checkout aca034c -- <path>`.

## Open follow-ups

- `reference/` folder masih di filesystem (di-gitignore). Kalau mau bersihkan repo lokal → hapus manual.
- Next-themes 0.4.6 + React 19.2 masih memunculkan console warning "Encountered a script tag" — non-blocking, bisa di-upgrade ke `next-themes@1.0.0-beta` kalau mengganggu.
- Pre-existing `asChild` di Button sekarang support base-ui render, tapi belum diuji di semua varian (icon-only, disabled + asChild). Kalau ketemu edge case, lapor.
