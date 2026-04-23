-- ============================================================
-- RESEARCH MODULE — PART 1/2
-- Hanya menambah nilai enum baru 'researcher'.
-- Postgres tidak mengizinkan nilai enum baru dipakai dalam
-- transaction yang sama dengan yang menambahkannya, jadi bagian
-- RLS/schema dipisah ke file 00013.
--
-- JALANKAN FILE INI DULU, lalu JALANKAN 00013 di query terpisah.
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'researcher';
