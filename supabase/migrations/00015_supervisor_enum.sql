-- ============================================================
-- SPRINT 2 — PART 1/3
-- Add 'supervisor' to user_role enum.
--
-- Postgres does NOT allow a newly-added enum value to be used in the
-- SAME transaction that adds it (this is why 00012 exists as a split
-- file for 'researcher'). Any policy or check constraint that
-- references 'supervisor' must live in a SEPARATE migration run —
-- see 00016 (schema) and 00017 (RLS rewrite).
--
-- RUN ORDER: 00015 → (new session/tx) → 00016 → 00017
-- ============================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'supervisor';
