# Dynamic Template Layout & Month Validation — Design Spec

**Date:** 2026-04-30
**Status:** Draft
**Depends on:** 2026-04-29-digihc-to-timesheet-design.md, 2026-04-29-preserve-xlsx-formatting-design.md

## Problem

The filler hardcodes `DATA_END_ROW = 39` and `TOTAL_ROW = 40`, assuming every template has 31 day rows. The new `sample-timesheet-final.xlsx` has 30 day rows (April 2026) with the COUNTIF formula in row 39. This hardcoded assumption breaks for any month with fewer than 31 days.

Additionally, there is no validation that the PDF month matches the template month. A user could accidentally upload a March PDF with an April template and get silently wrong results.

## Goal

The app auto-detects the template layout (how many date rows, where the formula row is), validates that PDF and template months match, rejects mismatches with a clear error, and applies a white background fill to all columns in every month row (both `H` and `LIB`/`TK`).

## Design

### Layout detection (`lib/filler.js` — new `detectLayout` function)

Scan column A from row 9 downwards, reading cell values:

1. If value is a `Date` or `number` (Excel serial) — treat as a date row.
2. If value is `null`/`undefined`/empty — stop scanning. This marks the end of date rows.
3. From the first date row, extract month (0–11) and year.
4. Return:

```js
{
  month: 0-11,     // from the first date row
  year: 2026,
  dataStart: 9,    // always row 9 (1-indexed)
  dataEnd: 38,     // last row with a date in col A
  formulaRow: 39,  // dataEnd + 1
  dayCount: 30
}
```

If zero date rows are found, throw so the caller returns 422.

### Month validation (new in `fillTimesheet`)

**lib/parser.js** gains a `getRecordMonth(records)` helper — returns `{ month: 0-11, year }` from the first record's parsed date.

**lib/filler.js** — before filling:
1. Call `getRecordMonth(records)` for the PDF month.
2. Call `detectLayout(ws)` for the template month.
3. If `pdfMonth !== templateMonth` → throw `"Month mismatch: PDF is Maret 2026, template is April 2026"` (Indonesian month names in the error, as that's what users see on DigiHC reports).
4. The thrown error is caught by `POST /convert` and returned as 422.

### Filling logic (updated in `fillTimesheet`)

Same logic as before but using detected bounds:

- Iterate `dataStart` through `dataEnd` instead of hardcoded 9–39.
- **Days with data (`H`):** Write check-in (col 2), check-out (col 3), total = checkout − checkin (col 4), `P` (col 5). Preserve col 11 remark if it has content.
- **Days without data (`LIB`/`TK`):** Clear cols 2–11 (`cell.value = null`). Leave col 1 (date) intact.
- **COUNTIF formula:** Write to `formulaRow`, col 5 as `COUNTIF(E{dataStart}:E{dataEnd},"P")` with computed `result`.

### White fill on month rows (new in `fillTimesheet`)

After filling all data rows, iterate `dataStart` through `dataEnd`, for every column 1 to `ws.columnCount`:

```js
cell.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFFFF' }
};
```

This overrides any pre-existing row fills (colored weekends, holidays, etc.) for every cell in the month's date range.

### Functions affected

| File | Function | Change |
|------|----------|--------|
| `lib/parser.js` | new `getRecordMonth(records)` | Extract `{month, year}` from first record |
| `lib/filler.js` | new `detectLayout(ws)` | Scan col A to find date rows and formula row |
| `lib/filler.js` | `fillTimesheet(templateBuffer, records)` | Use detected layout, add month validation, add white fill |
| `server.js` | `POST /convert` handler | No changes needed (existing error handling catches thrown errors) |
| `AGENTS.md` | Row range and formula docs | Update to reflect auto-detected layout |

### What is preserved

- All existing behavior: PDF parsing, date matching, time writing, formula writing
- All exceljs-based formatting preservation
- `dataStart` remains row 9 (assumed invariant — template header occupies rows 1–8)

### Error handling

All error messages returned to the user are in Indonesian, so end users can understand them:

| Scenario | HTTP | Message |
|----------|------|---------|
| PDF month ≠ template month | 422 | `"Bulan tidak cocok: PDF bulan {pdf}, template bulan {template}"` |
| Template has zero date rows | 422 | `"Tidak ada baris tanggal yang terdeteksi di template"` |
| Missing PDF/template files | 400 | `"File PDF dan template harus diunggah"` (updated from English) |
| PDF unreadable or no data | 422 | `"Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?"` (updated from English) |
| Template unreadable | 500 | `"Gagal membaca file template"` (updated from English) |

**Existing English messages in `server.js` are also updated to Indonesian.** All user-facing text in `public/index.html` remains Indonesian-friendly (labels like "DigiHC Attendance PDF" stay in English since they describe file types).

### AGENTS.md updates

- Row range: replace hardcoded "8–38 (0-indexed)" with description of auto-detection
- Formula row: replace "Row 39 column E" with "one row below the last date row"
- Add note: "The filler validates that the PDF month matches the template month"
- Add note: "All month rows receive a white background fill"
- Add note: "All user-facing error messages are in Indonesian"

### Out of scope

- Multi-page PDFs / batch processing
- Non-Indonesian month names
- Preserving pre-colored weekend/holiday cell fills (white fill overrides them)
- Validating day count (e.g., PDF has 20 records but template has 30 dates) — only month/year is validated
