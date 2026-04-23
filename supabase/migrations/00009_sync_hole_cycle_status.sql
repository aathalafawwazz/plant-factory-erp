-- Auto-sync holes.status and holes.current_cycle_id with planting_cycles
-- Prevents drift where a hole is marked ready_harvest/growing without an active cycle,
-- or where a cycle is harvested but the hole stays "ready_harvest".

-- ============================================================
-- TRIGGER: apply cycle insert/update to parent hole
-- ============================================================

CREATE OR REPLACE FUNCTION sync_hole_from_cycle()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new active cycle is inserted → set hole status to match, link cycle
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('planted', 'growing', 'ready_harvest') THEN
      UPDATE holes
      SET status = NEW.status::hole_status,
          current_cycle_id = NEW.id
      WHERE id = NEW.hole_id;
    END IF;
    RETURN NEW;
  END IF;

  -- When a cycle transitions
  IF TG_OP = 'UPDATE' THEN
    -- If cycle becomes harvested/cancelled → reset hole
    IF NEW.status IN ('harvested', 'cancelled') AND OLD.status NOT IN ('harvested', 'cancelled') THEN
      UPDATE holes
      SET status = CASE WHEN NEW.status = 'harvested' THEN 'harvested'::hole_status
                        ELSE 'empty'::hole_status END,
          current_cycle_id = NULL
      WHERE id = NEW.hole_id AND current_cycle_id = NEW.id;
    -- Otherwise, cycle is still active → mirror status
    ELSIF NEW.status IN ('planted', 'growing', 'ready_harvest') AND NEW.status IS DISTINCT FROM OLD.status THEN
      UPDATE holes
      SET status = NEW.status::hole_status,
          current_cycle_id = NEW.id
      WHERE id = NEW.hole_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_hole_from_cycle ON planting_cycles;
CREATE TRIGGER trg_sync_hole_from_cycle
AFTER INSERT OR UPDATE ON planting_cycles
FOR EACH ROW EXECUTE FUNCTION sync_hole_from_cycle();

-- ============================================================
-- ONE-TIME CLEANUP: fix any existing orphan holes
-- (hole has active status but no matching active cycle)
-- ============================================================

UPDATE holes h
SET status = 'empty',
    current_cycle_id = NULL
WHERE h.status IN ('planted', 'growing', 'ready_harvest')
  AND NOT EXISTS (
    SELECT 1 FROM planting_cycles pc
    WHERE pc.hole_id = h.id
      AND pc.status IN ('planted', 'growing', 'ready_harvest')
  );

-- And fix holes where current_cycle_id points at a dead cycle
UPDATE holes h
SET current_cycle_id = (
  SELECT pc.id
  FROM planting_cycles pc
  WHERE pc.hole_id = h.id
    AND pc.status IN ('planted', 'growing', 'ready_harvest')
  ORDER BY pc.planted_at DESC
  LIMIT 1
)
WHERE h.current_cycle_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM planting_cycles pc
    WHERE pc.id = h.current_cycle_id
      AND pc.status NOT IN ('planted', 'growing', 'ready_harvest')
  );
