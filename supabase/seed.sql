-- Seed 480 planting holes: 2 racks × 3 tiers × 4 lanes × 20 holes
INSERT INTO holes (rack, tier, lane, hole_number)
SELECT
  r.rack,
  t.tier,
  l.lane,
  h.hole_number
FROM
  (VALUES ('A'), ('B')) AS r(rack),
  generate_series(1, 3) AS t(tier),
  generate_series(1, 4) AS l(lane),
  generate_series(1, 20) AS h(hole_number)
ORDER BY r.rack, t.tier, l.lane, h.hole_number;

-- Seed crop catalog with common Indonesian hydroponic crops
INSERT INTO crop_catalog (name_id, name_latin, grow_duration_days, ec_min, ec_max, ph_min, ph_max, density_notes) VALUES
  ('Selada Keriting', 'Lactuca sativa var. crispa', 35, 1.0, 1.5, 5.5, 6.5, '1 tanaman per lubang, jarak ideal 15cm'),
  ('Selada Romaine', 'Lactuca sativa var. longifolia', 40, 1.0, 1.5, 5.5, 6.5, '1 tanaman per lubang'),
  ('Bayam Hijau', 'Amaranthus tricolor', 25, 1.5, 2.0, 6.0, 7.0, '2-3 tanaman per lubang'),
  ('Kangkung', 'Ipomoea aquatica', 25, 1.5, 2.0, 5.5, 6.5, '3-4 tanaman per lubang'),
  ('Pakcoy', 'Brassica rapa var. chinensis', 30, 1.5, 2.5, 6.0, 7.0, '1 tanaman per lubang'),
  ('Basil', 'Ocimum basilicum', 40, 1.0, 1.6, 5.5, 6.5, '1 tanaman per lubang, perlu pemangkasan rutin'),
  ('Kailan', 'Brassica oleracea var. alboglabra', 45, 1.5, 2.5, 6.0, 6.8, '1 tanaman per lubang'),
  ('Sawi Hijau', 'Brassica juncea', 28, 1.5, 2.5, 6.0, 7.0, '1 tanaman per lubang');
