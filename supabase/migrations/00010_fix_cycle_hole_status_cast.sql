-- Fix sync_hole_from_cycle trigger: direct ENUM-to-ENUM cast (cycle_status -> hole_status)
-- is not allowed in Postgres even when the labels overlap. Must go through TEXT.
-- Symptom: INSERT on planting_cycles fails with
--   "cannot cast type cycle_status to hole_status"

CREATE OR REPLACE FUNCTION sync_hole_from_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('planted', 'growing', 'ready_harvest') THEN
      UPDATE holes
      SET status = NEW.status::text::hole_status,
          current_cycle_id = NEW.id
      WHERE id = NEW.hole_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('harvested', 'cancelled') AND OLD.status NOT IN ('harvested', 'cancelled') THEN
      UPDATE holes
      SET status = CASE WHEN NEW.status = 'harvested' THEN 'harvested'::hole_status
                        ELSE 'empty'::hole_status END,
          current_cycle_id = NULL
      WHERE id = NEW.hole_id AND current_cycle_id = NEW.id;
    ELSIF NEW.status IN ('planted', 'growing', 'ready_harvest') AND NEW.status IS DISTINCT FROM OLD.status THEN
      UPDATE holes
      SET status = NEW.status::text::hole_status,
          current_cycle_id = NEW.id
      WHERE id = NEW.hole_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
