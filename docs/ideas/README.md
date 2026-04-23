# Ide & Rencana Fitur — Agrosphere Plant Factory ERP

Folder ini berisi **ide-ide fitur yang belum diimplementasi** untuk referensi diskusi di kemudian hari.
Setiap file adalah satu ide/modul mandiri yang siap dibahas ulang kapan pun.

## Index Ide

| File | Topik | Status | Prioritas sugesti |
| ---- | ----- | ------ | ----------------- |
| [`surveillance-cameras.md`](./surveillance-cameras.md) | Kamera surveillance + integrasi video/timelapse ke dashboard | 💡 Konsep | Medium |
| [`user-roles-hierarchy.md`](./user-roles-hierarchy.md) | Hierarki role, alur pendaftaran, audit log, lifecycle akun | 📋 Keputusan (Sprint 2+) | High |

## Cara menambah ide baru

1. Buat file markdown baru di folder ini dengan nama deskriptif kebab-case (mis. `iot-sensors.md`, `ml-yield-prediction.md`)
2. Sertakan **metadata header**: status, tanggal, kaitan modul
3. Gunakan struktur: Ringkasan → Analisis → Opsi → Rekomendasi → Roadmap → Pertanyaan Pending
4. Update tabel index di README ini

## Konvensi

- **Status**: 💡 Konsep / 🧪 POC / ✅ Diimplementasi / ❌ Ditolak
- Kaitkan dengan file existing pakai relative link
- Cantumkan estimasi effort & budget kalau ada
