# Changelog Archive

Ringkasan kronologis ada di [`/CHANGELOG.md`](../../CHANGELOG.md). Folder ini menyimpan **detail teknis per rilis/sprint** — rationale, breaking change, migration step-by-step, catatan upgrade.

## Konvensi

1. **Setiap fitur besar atau sprint dapat satu file** di sini dengan format `<slug>.md` — misalnya `sprint-1.md`, `sprint-2-draft.md`, `feat-landing-page.md`.
2. **Ringkas di `/CHANGELOG.md`** (2-3 bullet per kategori); detail lengkap masuk sini.
3. **Tiap file pakai template berikut:**

   ```markdown
   # <Nama Rilis/Fitur>

   **Tanggal:** YYYY-MM-DD
   **Commit:** <hash pertama>..<hash terakhir>
   **Status:** Draft | Applied | Rolled back

   ## Konteks
   Mengapa perubahan ini dibuat — masalah yang dipecahkan.

   ## Perubahan teknis
   - File-file baru/diubah yang berarti.
   - Migrasi DB (kalau ada) + run order.
   - Breaking change yang perlu diketahui developer lain.

   ## Upgrade steps
   Langkah yang harus dijalankan developer/ops agar lingkungannya up-to-date.

   ## Rollback
   Cara mundur kalau perubahan bermasalah.

   ## Open follow-ups
   Hal yang sengaja ditunda ke rilis berikutnya.
   ```

4. **Setelah fitur applied**, edit file → ubah status + tambahkan hash commit final + catat anomali yang muncul saat apply.

## Index (paling baru dulu)

- [`sprint-2-draft.md`](sprint-2-draft.md) — Role system + landing page (DRAFT, belum apply)
- [`sprint-1.md`](sprint-1.md) — Agrosphere rebrand + light theme + bilingual i18n (APPLIED)

## Untuk AI agent / Claude

Setiap kali membuat fitur baru atau mengubah sistem signifikan:

1. **Buat entri `docs/changelog/<slug>.md`** pakai template di atas.
2. **Update `/CHANGELOG.md`** — tambah bullet di bagian Unreleased.
3. **Saat commit**, rujuk nama file changelog di commit message supaya rantai audit terpelihara.

Perubahan kecil (typo fix, polish copy, tweak CSS satu nilai) cukup bullet di `/CHANGELOG.md` — tidak perlu file detail.
