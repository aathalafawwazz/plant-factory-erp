<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (16.2.x + React 19.2 + Turbopack) has breaking changes — APIs, conventions, and file structure may differ from what's in training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agrosphere ERP — Contributor Guide

Agrosphere ERP for SARC UGM Plant Factory. Single-tenant Next.js app, Supabase backend.

## Quick map

```
src/
  app/
    (auth)/            public routes (login)
    (dashboard)/       authenticated app shell — layout.tsx injects sidebar + navbar
      <module>/        per-module pages: lubang, tanam, panen, lingkungan,
                       nutrisi, komoditas, laporan, inventory, pengeluaran,
                       hr, sales, kalender, kunjungan, riset
      error.tsx        route-level error boundary (dashboard segment)
    layout.tsx         root: ThemeProvider + LangProvider + Toaster
  components/
    ui/                shadcn-flavoured primitives (base-ui-backed)
    nav-sidebar.tsx    desktop sidebar + mobile bottom nav (labelKey-driven)
    top-navbar.tsx     theme + language switcher, profile menu
    keyboard-shortcuts.tsx  global keybindings (Ctrl+Shift+D / Ctrl+Shift+L / Ctrl+B)
  lib/
    i18n-dict.ts       plain dict + translate() — safe to import from server
    i18n.tsx           React context/provider + useLang() hook (client-only)
    i18n-server.ts     getServerT() / getServerI18n() — reads cookie for SSR
    translate-helpers.ts
                       translateCommodity / translateJobTitle / translate-
                       InventoryCategory / translateExpenseCategory /
                       formatDateLocale / formatDateTimeLocale
    constants.ts       HOLE_STATUS, VISUAL_CONDITIONS, POST_HARVEST_HANDLING
                       (carry both `label` and `labelKey` — prefer labelKey)
    use-chart-theme.ts chart palette that tracks light/dark
    supabase/          server & client factories
    types/database.ts  Supabase generated types
  app/globals.css      CSS variables (light + .dark themes) — single source of truth
supabase/migrations/   SQL migrations (numbered)
```

## Design system

- Brand colour: **teal `#0AD1C8`** (primary) with gradient `#45DFB1 → #0AD1C8`
- Typography: **Poppins** (sans + heading) + **JetBrains Mono**
- Two themes (`:root` light, `.dark` dark). Tokens exposed as Tailwind `bg-primary`, `text-foreground`, `bg-sidebar`, etc. — **never hardcode `oklch(...)` or `#hex` in a component** unless you also provide a `dark:` variant. Check existing patterns in `hole-status-stats.tsx` for theme-aware hex pairing.

## i18n rules (bilingual ID/EN, EN default)

**Two worlds, one dict:**

1. **Dict + translate** live in `src/lib/i18n-dict.ts` (plain module, safe everywhere).
2. **React context** lives in `src/lib/i18n.tsx` (`"use client"`) — re-exports `Lang` and `translate` for call-site convenience.

**Per component type:**

- Client component:
  ```ts
  import { useLang } from "@/lib/i18n";
  const { t, lang } = useLang();
  ```
- Server component:
  ```ts
  import { getServerI18n } from "@/lib/i18n-server";
  const { t, lang } = await getServerI18n();   // or getServerT() if you don't need lang
  ```

**Data-driven values** (commodity names, categories, dates, job titles) — do **not** put in the dict. Use helpers:

- `translateCommodity(name, lang)` — crop/plant alias map (Bayam Hijau → Green Spinach). Unknown strings pass through unchanged.
- `translateJobTitle(title, lang)` — HR `position` alias map.
- `translateInventoryCategory(cat, lang)` / `translateExpenseCategory(cat, lang)` — typed enum labels.
- `formatDateLocale(d, lang, opts)` / `formatDateTimeLocale(d, lang, opts)` — replace all `toLocaleDateString("id-ID", ...)` sites.

**Status / enum labels** in `constants.ts` carry `labelKey`. Always render via `t(HOLE_STATUS[key].labelKey)`, not `.label`.

**Language switch** — `setLang()` mirrors to cookie + calls `router.refresh()` so server components re-render with the new cookie automatically. No manual browser refresh needed.

## Commands

| | |
|-|-|
| `bun dev` | dev server (Turbopack) |
| `bun run build` | production build |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | ESLint |
| `bun run check` | typecheck + lint (use before commits) |

Prefer `bun` over `npm` / `npx` in this repo (Node isn't in PATH, Bun is).

## Git hooks

Pre-commit typecheck lives at `.githooks/pre-commit`. Enable once:

```sh
git config core.hooksPath .githooks
```

The hook only runs `tsc --noEmit` when staged changes include `.ts`/`.tsx`. Skip with `git commit --no-verify` when truly needed (rarely).

## Conventions

- **Do not commit to** `reference/` (gitignored — may contain credentials & large brand assets). Do not commit `.claude/settings.local.json`.
- **Keep existing behaviour when translating** — DB enum string values (`.eq("status", "active")`, chart axis data keys) stay in English code, only user-visible display strings get `t()`.
- **Status arrays** like `VISUAL_CONDITIONS` keep `label` AND `labelKey` both. `label` is the legacy ID fallback; new code reads `labelKey` via `t()`.
- **Prefer tokens over hex** — if you need a one-off colour, add it with a `dark:` variant. Audit before claiming a theme polish done.
