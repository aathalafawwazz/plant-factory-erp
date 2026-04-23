# Ide Fitur: Kamera Surveillance untuk Plant Factory

> **Status**: Belum diimplementasi — simpanan ide untuk dibahas/dibangun di kemudian hari.
> **Tanggal disimpan**: 2026-04-22
> **Kaitan modul**: Dashboard, Peta Lubang, Panen, Riset, Kunjungan

---

## Ringkasan

Tambahan fitur surveillance kamera untuk monitoring plant factory dengan fokus pada
**efisiensi bandwidth** (tidak full live streaming 24/7) dan **integrasi dengan data ERP existing**
(per-lubang, per-proyek riset, per-event panen/kunjungan).

---

## 1. Pilihan Hardware Kamera

| Jenis                         | Cocok? | Pro                                                              | Con                                                                                                  | Budget                     |
| ----------------------------- | ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------- |
| Webcam USB (Logitech C922)    | ⚠️     | Murah, plug & play, HD                                           | Butuh PC per kamera, kabel USB max 5m, low-light jelek, bukan weatherproof                           | Rp 500k–1.5jt + host       |
| **IP Camera PoE** ✅ pick     | ✅✅   | PoE (power+data 1 kabel), IP66, night vision IR, RTSP/ONVIF      | Harga lebih tinggi, butuh PoE switch                                                                 | Rp 800k–3jt/unit           |
| WiFi Camera (Tapo/EZVIZ/Imou) | ✅     | Gampang install, app vendor siap, ada pan-tilt                   | WiFi rawan putus di ruang lembap/banyak metal, bergantung cloud vendor                               | Rp 400k–1jt/unit           |
| Action Cam / GoPro            | ❌     | Kualitas bagus                                                   | Tidak untuk 24/7, pakai baterai, tidak ada RTSP                                                      | -                          |
| Raspberry Pi + Cam Module     | 🧪     | Fleksibel, bisa AI on-device                                     | Butuh coding, maintenance tinggi                                                                     | Rp 1.5–2jt                 |
| Smartphone bekas + IP Webcam  | 💡     | Gratis kalau ada HP nganggur                                     | Kualitas tergantung HP, charger permanen                                                             | Rp 0                       |

### Rekomendasi: IP Camera PoE

**Alasan spesifik untuk plant factory:**
- **Kelembapan tinggi** (70–90% RH) → butuh rating IP65/IP66
- **Cahaya grow light** (spektrum ungu/merah) → butuh sensor WDR (Wide Dynamic Range) bagus biar warna tidak hancur
- **Operasi 24/7** → CCTV didesain untuk itu, webcam tidak
- **ONVIF/RTSP standar** → bebas vendor lock-in
- **Multi-titik** → PoE switch 1 unit handle 4-8 kamera sekaligus

### Spek minimum rekomendasi

- **Resolusi**: 2MP (1080p) — lebih tidak perlu, bandwidth bengkak
- **Power**: PoE 802.3af
- **Rating**: IP66
- **WDR**: 120dB+
- **Night vision IR**: 20–30m
- **Lensa**: 2.8mm (wide cover 1 rak penuh) atau 4mm (lebih zoom)
- **Codec**: H.265 (hemat bandwidth 50% vs H.264)
- **Merk reliable**: Hikvision DS-2CD series, Dahua Lite, Reolink RLC (±Rp 1–1.5jt/unit)

### Budget estimasi untuk 4 titik kamera

| Item                                                    | Estimasi     |
| ------------------------------------------------------- | ------------ |
| 4× IP Camera 1080p PoE                                   | Rp 5jt       |
| 1× PoE Switch 8-port                                     | Rp 1.5jt     |
| Kabel UTP Cat6 + konektor                                | Rp 500k      |
| Mini-PC / NUC untuk NVR software (atau RPi 5 8GB + SSD) | Rp 2.5–6jt   |
| **Total**                                                | **Rp 10–13jt** |

---

## 2. Arsitektur Streaming — pilihan beserta trade-off

### Opsi A — Live streaming langsung
```
Kamera → RTSP → Relay (Go2rtc/MediaMTX) → HLS/WebRTC → Browser
```
- **Beban**: 1 user = 1 stream aktif. 5 user × 2Mbps = 10Mbps upload
- ❌ Tidak direkomendasikan untuk dashboard ERP default

### Opsi B — Snapshot periodik ⭐ favorit untuk dashboard
```
Kamera → Worker capture JPEG tiap 30-60s → Supabase Storage
Browser → fetch latest snapshot + auto-refresh
```
- **Beban**: Minimal. Client download 1 JPEG (~200KB) per 30s = 6KB/s
- ✅ Sangat efisien untuk widget dashboard "hampir live"

### Opsi C — Timelapse harian ⭐ ide awal dari user
```
Kamera 24/7 → worker capture JPEG tiap 5 menit (288 frame/hari)
            → end-of-day: ffmpeg compile → MP4 timelapse (~24 detik)
            → simpan ke Storage
Dashboard → video player scrub per tanggal
```
- **Beban**: Zero saat idle. Render 1x/hari di worker
- ✅ Cocok untuk review harian + arsip historis
- Contoh: "perkembangan 30 hari" = 12 menit video

### Opsi D — **Hybrid (rekomendasi final)**

Kombinasi ketiganya sesuai konteks:

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard widget:                                          │
│ ┌────────────────┐ ┌────────────────┐ ┌───────────────┐  │
│ │ Snapshot live  │ │ Timelapse hari │ │ Rekam panen   │  │
│ │ (refresh 30s)  │ │ ini (autoplay) │ │ (on-demand)   │  │
│ └────────────────┘ └────────────────┘ └───────────────┘  │
└──────────────────────────────────────────────────────────┘

Halaman /surveillance dedicated:
  - Live view (hanya kalau user klik "Live" → WebRTC lazy start)
  - Timelapse archive per tanggal, bisa scrub
  - Event replay: "foto/video 5 menit sebelum & sesudah harvest di A-1-4-6"
```

---

## 3. Ide Integrasi dengan Modul ERP

### 🏆 Ide 1 — Visual diary per lubang
- Klik detail lubang `A-1-4-6` → tampilkan timelapse 35 hari (1 siklus tanam) dari kamera terdekat, zoom ke ROI (Region of Interest) lubang
- Implementasi: saat snapshot disimpan, metadata include `crop_id/allocation_id` yang aktif di lubang tsb. Playback tinggal filter by crop/allocation

### Ide 2 — Before/After harvest proof
- Saat user klik "Catat Panen", sistem otomatis pull snapshot 5 menit sebelum + 5 menit sesudah sebagai bukti visual
- Timestamp sinkron dengan `harvested_at`

### Ide 3 — Research video log
- Attachment type "video" auto-generated dari timelapse ranges yang match `proposed_start` – `proposed_end` proyek riset
- Peneliti dapat video evolusi lengkap tanpa effort manual

### Ide 4 — Anomaly detection (advanced/future)
- Frigate / TensorFlow Lite di mini-PC → deteksi perubahan signifikan (daun layu, ada hama)
- Auto-tag snapshot + trigger notifikasi
- Butuh setup lebih serius tapi dampak besar

### Ide 5 — Visitor recording
- Saat kunjungan check-in, video dari area yang dikunjungi otomatis ter-tag ke `visit_id`
- Berguna untuk audit / dokumentasi kunjungan VIP

---

## 4. Stack Teknis Rekomendasi

### Hardware
- **Kamera**: Reolink RLC-520A (Rp 1.2jt) × 4 unit, PoE 1080p IP66
- **Switch**: TP-Link TL-SG1005P PoE (Rp 1.5jt, 4 PoE port)
- **NVR host**: Mini-PC Intel N100 atau Raspberry Pi 5 8GB + SSD 500GB
- **Placement (contoh 4 titik):**
  - 1× kamera per rak (2 unit untuk Rak A & Rak B)
  - 1× overview ruangan
  - 1× area packing/entry

### Software (open source)
- **[Frigate NVR](https://frigate.video)** — NVR Docker, AI object detection built-in, RTSP input, HTTP API, continuous recording, dashboard web
  - Alternatif: **Shinobi**, **Agent DVR**, **Scrypted**
- **[go2rtc](https://github.com/AlexxIT/go2rtc)** — streaming relay, convert RTSP ke WebRTC/HLS
- **Cron job / Supabase Edge Function** — capture snapshot tiap 30 detik → bucket `surveillance-snapshots`
- **ffmpeg** — compile snapshot jadi MP4 timelapse end-of-day

### Integrasi ERP (yang harus dibangun di sistem)

**Schema DB yang diperlukan:**

```sql
-- Kamera terdaftar
CREATE TABLE camera_feeds (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  location      TEXT,                      -- "Rak A", "Packing", dsb
  rack          CHAR(1),                   -- optional link ke peta
  rtsp_url      TEXT,                      -- untuk worker
  snapshot_url  TEXT,                      -- HTTP URL from NVR
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Snapshot berkala
CREATE TABLE camera_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  camera_id     INTEGER REFERENCES camera_feeds(id) ON DELETE CASCADE,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  storage_path  TEXT NOT NULL,
  thumbnail_path TEXT,
  width         INTEGER,
  height        INTEGER
);
CREATE INDEX ON camera_snapshots(camera_id, captured_at DESC);

-- Timelapse harian
CREATE TABLE camera_timelapses (
  id            SERIAL PRIMARY KEY,
  camera_id     INTEGER REFERENCES camera_feeds(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  storage_path  TEXT NOT NULL,
  duration_sec  INTEGER,
  frame_count   INTEGER,
  file_size_kb  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (camera_id, date)
);
```

**Storage buckets baru:**
- `surveillance-snapshots` (private, TTL 30 hari)
- `surveillance-timelapses` (private, retensi lebih panjang 1 tahun)
- `surveillance-events` (untuk before/after harvest/visit clips)

**UI yang harus dibangun:**
- Widget dashboard "Surveillance" — grid snapshot terbaru 4 kamera
- Halaman `/surveillance` — live (optional WebRTC) + archive timelapse scrubber per kamera per tanggal
- Embed di hole detail, research detail, panen, kunjungan (ide 1-5 di atas)

---

## 5. Jawaban Ringkas untuk Pertanyaan Awal

| Pertanyaan                          | Jawab                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Webcam bisa?                        | Bisa tapi tidak ideal — butuh host PC per kamera, tidak weatherproof, light handling jelek                                      |
| CCTV bisa?                          | ✅ Paling ideal, pilih IP Camera PoE merk reliable                                                                              |
| Kamera lain?                        | HP bekas (hack murah), Raspberry Pi (DIY), tapi CCTV tetap paling cost-effective jangka panjang                                |
| Live streaming di dashboard?        | Tidak disarankan default — beban besar. Pakai snapshot auto-refresh untuk widget                                                |
| Timelapse harian?                   | ✅ Ide bagus — hemat bandwidth, review lebih cepat, cocok untuk dashboard                                                        |
| Apakah sistem akan terbebani?       | Tidak, kalau pakai arsitektur snapshot + timelapse. Client cuma download file JPEG/MP4 biasa = zero streaming load              |

---

## 6. Roadmap Implementasi Bertahap

### Tahap 1 — Proof of Concept (1–2 minggu)
1. Beli 1 kamera IP + 1 HP lama sebagai backup test
2. Setup Frigate di PC/mini-PC existing
3. Buat table `camera_snapshots` + worker snapshot tiap 30 detik ke Supabase Storage
4. Widget dashboard: 1 kamera, auto-refresh
5. Validasi: latency, kualitas, stabilitas selama 3–7 hari

### Tahap 2 — Production Rollout (2–3 minggu)
1. Install 4 kamera PoE permanen
2. Halaman `/surveillance` dengan multi-view grid
3. Timelapse harian otomatis via ffmpeg cron
4. Integrasi ke hole detail: "lihat visual lubang ini 30 hari terakhir"

### Tahap 3 — Advanced Features (bertahap)
1. Frigate object detection → auto-tag anomali
2. Before/after harvest di panen detail
3. Research timelapse auto-generate
4. Public view (optional) untuk landing `/tur` — show-off area

---

## 7. Pertanyaan yang Perlu Dijawab Sebelum Eksekusi

1. **Berapa titik kamera** yang dibutuhkan? (per rak, per ruang, per area?)
2. Apakah ada **kamera CCTV existing** di lokasi yang bisa dimanfaatkan?
3. Tujuan utama:
   - **Monitoring real-time** (untuk admin yang memantau aktif), atau
   - **Dokumentasi historis** (review harian + share ke stakeholder)?
4. **Budget hardware** kira-kira di range berapa?
5. Server Next.js/Supabase ada di **lokasi plant factory** atau **cloud**?
   - (Penting untuk keputusan NVR lokal vs remote streaming)

---

## 8. Tiga Jalur Implementasi Paling Mungkin

### Jalur A — Snapshot-first (rekomendasi untuk mulai cepat)
- Buat migration + tabel + widget dashboard + placeholder worker script
- Hardware bisa menyusul, user tinggal isi RTSP URL saat sudah beli kamera
- **Effort**: rendah, low-risk
- **Output**: widget snapshot refresh di dashboard + halaman `/surveillance`

### Jalur B — Full Frigate integration
- Kalau hardware sudah siap & user mau setup Docker
- Frigate handle semuanya (recording, detection, API)
- **Effort**: menengah, butuh infra
- **Output**: live + snapshot + event detection terintegrasi

### Jalur C — Timelapse-only mode
- Kalau budget terbatas dan tidak butuh live
- Pakai 1 kamera murah (Rp 400–500k wireless) yang capture snapshot saja
- Worker compile jadi timelapse daily
- **Effort**: rendah, minimal hardware
- **Output**: arsip timelapse harian di dashboard, no live view

---

## Catatan / Pointer ke Diskusi

Kalau dibahas lagi nanti, titik masuk yang paling praktis adalah:

- **"Mari mulai dari Jalur A — snapshot-first"** → saya bisa langsung bangun schema + widget tanpa hardware
- **"Hardware sudah ada, mari full integration"** → ke Jalur B dengan Frigate
- **"Cukup timelapse archive saja"** → Jalur C, paling minimalis

Ide-ide integrasi 1–5 di bagian 3 bisa dipick individual tanpa harus semua sekaligus.
