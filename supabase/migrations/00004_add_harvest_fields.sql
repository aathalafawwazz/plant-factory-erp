-- Add harvest detail fields to planting_cycles
ALTER TABLE planting_cycles
  ADD COLUMN IF NOT EXISTS visual_condition TEXT CHECK (visual_condition IN ('segar', 'layu', 'bercak', 'rusak')),
  ADD COLUMN IF NOT EXISTS post_harvest_handling TEXT CHECK (post_harvest_handling IN ('cuci', 'potong', 'kemas', 'langsung')),
  ADD COLUMN IF NOT EXISTS harvest_notes TEXT,
  ADD COLUMN IF NOT EXISTS early_harvest_reason TEXT;
