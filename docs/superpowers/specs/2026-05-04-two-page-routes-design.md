# Two-Page Routes with Server Cache

## Goal

Split the single-page UI into two separate routes with real browser navigation, add in-memory server cache to avoid file re-upload, make the activity table full-width, and remove placeholder hints from activity inputs.

## Design decisions

- **Approach B:** Two separate HTML files (`index.html` for upload, `preview.html` for editor)
- **Cache:** In-memory `Map<string, CachedSession>` with UUID keys, 15-minute TTL
- **Routes:** `GET /`, `POST /preview` (redirect), `GET /preview/:id`, `POST /convert/:id`
- **Re-upload:** Not required — cache holds file buffers

---

## File structure

```
public/
├── index.html       ← Upload page (stripped from current)
└── preview.html     ← Preview + editor page (new)
```

- `server.js` — add cache, new routes, modify existing routes
- `lib/filler.js` — no changes
- `lib/parser.js` — no changes

---

## Routes

```
GET  /              → serve public/index.html
POST /preview       → parse PDF + template
                    → cache: { id → { pdfBuf, templateBuf, records, layout, metadata } }
                    → redirect 302 /preview/<id>
GET  /preview/:id   → lookup cache
                    → if miss: 410 "Sesi telah berakhir, silakan unggah ulang."
                    → serve public/preview.html with embedded <script> JSON data
POST /convert/:id   → lookup cache
                    → if miss: 410 "Sesi telah berakhir, silakan unggah ulang."
                    → fillTimesheet(cached.templateBuf, cached.records, activitiesMap, ...)
                    → delete cache entry
                    → return XLSX blob
```

---

## Cache

- Type: `Map<string, { files: Buffers, data: previewData, timer: Timeout }>`
- TTL: 15 minutes (auto-delete via `setTimeout`)
- On access (GET /preview/:id or POST /convert/:id): clear old timer, set new 15-min TTL
- On successful /convert: delete entry immediately
- Max entries: no hard limit (single-user tool, negligible memory)

---

## Page 1: Upload (`public/index.html`)

- Title: "DigiHC Attendance → Timesheet"
- Single centered card (`max-width: 420px`)
- Two file inputs: PDF and XLSX template, styled with `::file-selector-button`
- Preview button: full-width blue pill, `POST /preview`
- Status messages below button
- Dark theme (same CSS custom properties as current)

---

## Page 2: Preview + Editor (`public/preview.html`)

### Layout
- Back link: `<a href="/">← Back to Home</a>`, top-left, no underline, `var(--text-secondary)`
- Metadata form: 2-column grid, all 7 fields
- Divisi/Departement row: inline grid below metadata
- Activity table: **full-width** (no `max-width` on `#activitySection`), spans to body padding
- Download button: full-width green pill

### Table columns (desktop)
1. Tanggal
2. Check-in
3. Check-out
4. Status
5. Aktivitas
6. Project Name
7. Project ID
8. Aplikasi Terdampak
9. AIP Fitur

### Mobile (≤600px)
- Columns 2, 3, 6, 7, 8, 9 hidden — only Tanggal, Status, Aktivitas visible

### No placeholders
Activity input fields have **no `placeholder` attribute**. Fields show empty when blank.

### Data flow
- Server embeds preview data as `window.__PREVIEW_DATA__` in a `<script>` tag
- JS reads from `window.__PREVIEW_DATA__` to render the table and populate metadata fields
- Cache ID is in `window.__CACHE_ID__` for the download POST

### Download
- `POST /convert/<cacheId>` with `activities`, `headerFields`, `rowFields` as JSON in body
- No file re-upload
- Server returns XLSX blob

---

## CSS

Both pages share the same dark theme custom properties (`:root` block). The preview page has additional styles for the metadata form, full-width table, back link, and download button. No external CSS files.

---

## Error messages (Indonesian)

| Scenario | HTTP Status | Message |
|----------|-------------|---------|
| Cache expired or invalid ID | 410 | Sesi telah berakhir, silakan unggah ulang. |
| No files uploaded | 400 | File PDF dan template harus diunggah. |
| No attendance data found | 422 | Data kehadiran tidak ditemukan di PDF. |
| Month mismatch | 422 | Bulan tidak cocok: PDF bulan ... template bulan ... |
| Invalid activities JSON | 400 | Format data aktivitas tidak valid |
| Invalid header JSON | 400 | Format data header tidak valid |

---

## What does NOT change

- `lib/parser.js` — unchanged
- `lib/filler.js` — unchanged
- `package.json` — no new dependencies
- Dark theme color palette — unchanged
- All existing features (metadata form, S status, divisi/departement, activity fields, wrap text)

---

# Desain Dua Halaman dengan Cache Server (Versi Bahasa Indonesia)

## Tujuan

Memisahkan UI halaman tunggal menjadi dua rute terpisah dengan navigasi browser nyata, menambahkan cache server dalam memori untuk menghindari pengunggahan ulang file, membuat tabel aktivitas lebar penuh, dan menghapus petunjuk placeholder dari input aktivitas.

## Keputusan desain

- **Pendekatan B:** Dua file HTML terpisah (`index.html` untuk unggah, `preview.html` untuk editor)
- **Cache:** `Map<string, CachedSession>` dalam memori dengan kunci UUID, TTL 15 menit
- **Rute:** `GET /`, `POST /preview` (redirect), `GET /preview/:id`, `POST /convert/:id`
- **Unggah ulang:** Tidak diperlukan — cache menyimpan buffer file

---

## Struktur file

```
public/
├── index.html       ← Halaman unggah (diambil dari yang sekarang)
└── preview.html     ← Halaman pratinjau + editor (baru)
```

- `server.js` — tambahkan cache, rute baru, modifikasi rute yang ada
- `lib/filler.js` — tidak ada perubahan
- `lib/parser.js` — tidak ada perubahan

---

## Rute

```
GET  /              → sajikan public/index.html
POST /preview       → parse PDF + template
                    → cache: { id → { pdfBuf, templateBuf, records, layout, metadata } }
                    → redirect 302 /preview/<id>
GET  /preview/:id   → cari cache
                    → jika tidak ada: 410 "Sesi telah berakhir, silakan unggah ulang."
                    → sajikan public/preview.html dengan data JSON tertanam di <script>
POST /convert/:id   → cari cache
                    → jika tidak ada: 410 "Sesi telah berakhir, silakan unggah ulang."
                    → fillTimesheet(cached.templateBuf, cached.records, activitiesMap, ...)
                    → hapus entri cache
                    → kembalikan blob XLSX
```

---

## Cache

- Tipe: `Map<string, { files: Buffers, data: previewData, timer: Timeout }>`
- TTL: 15 menit (hapus otomatis via `setTimeout`)
- Saat diakses (GET /preview/:id atau POST /convert/:id): hapus timer lama, atur TTL 15 menit baru
- Saat /convert berhasil: hapus entri segera
- Batas maks entri: tidak ada (alat pengguna tunggal, memori dapat diabaikan)

---

## Halaman 1: Unggah (`public/index.html`)

- Judul: "DigiHC Attendance → Timesheet"
- Kartu tunggal terpusat (`max-width: 420px`)
- Dua input file: PDF dan template XLSX, bergaya dengan `::file-selector-button`
- Tombol pratinjau: pil biru lebar penuh, `POST /preview`
- Pesan status di bawah tombol
- Tema gelap (properti kustom CSS sama seperti saat ini)

---

## Halaman 2: Pratinjau + Editor (`public/preview.html`)

### Tata letak
- Tautan kembali: `<a href="/">← Back to Home</a>`, kiri atas, tanpa garis bawah, `var(--text-secondary)`
- Form metadata: grid 2 kolom, semua 7 field
- Baris Divisi/Departement: grid sejajar di bawah metadata
- Tabel aktivitas: **lebar penuh** (tanpa `max-width` pada `#activitySection`), membentang ke padding body
- Tombol unduh: pil hijau lebar penuh

### Kolom tabel (desktop)
1. Tanggal
2. Check-in
3. Check-out
4. Status
5. Aktivitas
6. Project Name
7. Project ID
8. Aplikasi Terdampak
9. AIP Fitur

### Mobile (≤600px)
- Kolom 2, 3, 6, 7, 8, 9 disembunyikan — hanya Tanggal, Status, Aktivitas yang terlihat

### Tanpa placeholder
Input aktivitas tidak memiliki atribut `placeholder`. Field tampak kosong saat tidak diisi.

### Alur data
- Server menanamkan data pratinjau sebagai `window.__PREVIEW_DATA__` dalam tag `<script>`
- JS membaca dari `window.__PREVIEW_DATA__` untuk merender tabel dan mengisi field metadata
- ID cache ada di `window.__CACHE_ID__` untuk POST unduh

### Unduh
- `POST /convert/<cacheId>` dengan `activities`, `headerFields`, `rowFields` sebagai JSON di body
- Tidak ada unggah ulang file
- Server mengembalikan blob XLSX

---

## CSS

Kedua halaman berbagi properti kustom tema gelap yang sama (blok `:root`). Halaman pratinjau memiliki gaya tambahan untuk form metadata, tabel lebar penuh, tautan kembali, dan tombol unduh. Tidak ada file CSS eksternal.

---

## Pesan error (Bahasa Indonesia)

| Skenario | Status HTTP | Pesan |
|----------|-------------|-------|
| Cache kedaluwarsa atau ID tidak valid | 410 | Sesi telah berakhir, silakan unggah ulang. |
| Tidak ada file yang diunggah | 400 | File PDF dan template harus diunggah. |
| Data kehadiran tidak ditemukan | 422 | Data kehadiran tidak ditemukan di PDF. |
| Bulan tidak cocok | 422 | Bulan tidak cocok: PDF bulan ... template bulan ... |
| Format JSON aktivitas tidak valid | 400 | Format data aktivitas tidak valid |
| Format JSON header tidak valid | 400 | Format data header tidak valid |

---

## Yang TIDAK berubah

- `lib/parser.js` — tidak berubah
- `lib/filler.js` — tidak berubah
- `package.json` — tidak ada dependensi baru
- Palet warna tema gelap — tidak berubah
- Semua fitur yang ada (form metadata, status S, divisi/departement, field aktivitas, wrap text)
