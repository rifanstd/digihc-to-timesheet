# Activity Input Form — Design Spec

## Summary

Adds a two-step flow: after uploading the DigiHC PDF and timesheet template, the user sees a table of all parsed rows and can input activities (column K / Remark) before downloading the filled XLSX.

## Flow

1. User uploads PDF + template on the main page
2. User clicks "Preview Data" → `POST /preview` returns parsed records + existing K values
3. A table renders showing all month dates, check-in/out times, status, and an activity input on H (hadir) rows
4. User fills in activities, then clicks "Download Timesheet" → `POST /convert` generates the XLSX with user activities in column K

## New endpoint: `POST /preview`

**Input:** `multipart/form-data` with `pdf` and `template` files.

**Output (JSON):**

```json
{
  "month": { "month": 2, "year": 2026 },
  "rows": [
    {
      "serial": 45678,
      "date": "01 Maret 2026",
      "checkIn": "08:00:00",
      "checkOut": "17:00:00",
      "status": "H",
      "activity": null
    },
    {
      "serial": 45679,
      "date": "02 Maret 2026",
      "checkIn": null,
      "checkOut": null,
      "status": "LIB",
      "activity": "Idul Fitri"
    }
  ]
}
```

- `serial`: Excel 1900 serial number for date matching
- `date`: Indonesian locale string (`DD MMMM YYYY`)
- `checkIn` / `checkOut`: `HH:MM:SS` string, or `null` if no data
- `status`: `"H"` (hadir), `"LIB"` (libur), `"TK"` (tanpa keterangan), or `null`
- `activity`: existing text from column K of the template, or `null`

Reuses `lib/parser.js` for PDF parsing and adds a `previewTemplate()` function in `lib/filler.js` to read template layout and existing K values.

## Extended endpoint: `POST /convert`

**New optional field:** `activities` — JSON string in multipart form:

```json
[{ "serial": 45678, "activity": "Code review" }, ...]
```

- When `activities` is absent, empty, or invalid JSON → column K is preserved as-is (current behavior, backward compatible)
- When `activities` is provided → for each matched H row, column K is set to the user-provided text; unmatched serials are silently ignored
- LIB/TK rows are always cleared in columns B–K regardless of activities

**New validation:**
- If `activities` field is present but not valid JSON → 400: `"Format data aktivitas tidak valid"`

## Frontend

### Page layout

Single page (`public/index.html`), replaces current form:

1. **Upload section** (top) — file inputs for PDF and template, "Preview Data" button
2. **Activity table** (middle, hidden until preview loads) — scrollable table with rows
3. **Download button** (bottom, hidden until preview loads)

### Activity table

| Column | Content | Editable |
|--------|---------|----------|
| Date | `DD MMMM YYYY` (Indonesian) | No |
| Check-in | `HH:MM` | No |
| Check-out | `HH:MM` | No |
| Status | H / LIB / TK badge | No |
| Activity | Text input (H only) or status label (LIB/TK) | H rows only |

- H rows: text input, pre-filled with existing K text from template (if any)
- LIB rows: display status + existing K text (e.g., "Idul Fitri") as read-only label
- TK rows: display "Tanpa Keterangan" as read-only label

### Client state

- After preview, client holds `rows` array in memory
- `POST /convert` sends only rows where the user typed something into the activity input (avoids sending unchanged nulls)

## Error handling

All user-facing error messages in **bahasa Indonesia**:

| Scenario | Status | Message |
|----------|--------|---------|
| Missing PDF or template | 400 | `"File PDF dan template harus diunggah."` |
| No data found in PDF | 422 | `"Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?"` |
| Month mismatch | 422 | `"Bulan tidak cocok: PDF bulan {bulan} {tahun}, template bulan {bulan} {tahun}"` |
| Template no date rows | 422 | `"Tidak ada baris tanggal yang terdeteksi di template"` |
| Invalid activities JSON | 400 | `"Format data aktivitas tidak valid"` |
| Internal error | 500 | `"Terjadi kesalahan internal server"` |

## Backward compatibility

- The existing `/convert` endpoint without `activities` behaves identically to current behavior
- Existing `sample-*` files remain valid for manual testing
- No changes to parser.js API surface

## Files to change

- `server.js` — add `POST /preview`, extend `POST /convert` to accept `activities`
- `lib/filler.js` — add `previewTemplate()` function; extend `fillTimesheet()` to accept optional activities map
- `public/index.html` — replace current form with two-step UI (upload → preview table → download)
