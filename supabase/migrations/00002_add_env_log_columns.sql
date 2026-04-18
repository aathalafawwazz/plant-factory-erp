-- Add CO2, VPD, PPFD columns to environmental_logs
ALTER TABLE environmental_logs
  ADD COLUMN IF NOT EXISTS co2_ppm NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS vpd_kpa NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS ppfd_umol NUMERIC(6,1);
