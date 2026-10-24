-- Banner motion/animation style (DR-2026-10 feedback item 1).
-- Non-destructive, additive-only: existing rows keep working and default
-- to "none" (no animation), matching previous behaviour exactly.
ALTER TABLE "Banner" ADD COLUMN "animation" TEXT NOT NULL DEFAULT 'none';
