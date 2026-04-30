# AGENTS.md

## Run the app

```bash
npm start          # starts Express on http://localhost:3000 (override: PORT env)
```

No build, test, lint, or typecheck commands exist. Manual verification only.

## Architecture

- `server.js` — Express entry point, serves `public/index.html` and handles `POST /convert`
- `lib/parser.js` — extracts attendance records from a DigiHC PDF buffer
- `lib/filler.js` — matches records to template rows by Excel serial date and writes times
- `public/index.html` — upload form UI

Both `lib/parser.js` and `lib/filler.js` operate entirely on Buffers (no filesystem I/O).

## Sample files for manual testing

- `sample-digihc.pdf` — DigiHC March 2026 attendance report (Indonesian month names)
- `sample-timesheet.xlsx` — timesheet template, March 2026 (31 days)
- `sample-timesheet-final.xlsx` — timesheet template, April 2026 (30 days)

Both are tracked in git despite `.gitignore` blocking `*.pdf` / `*.xlsx` (negated by `!` rules).

## Non-obvious implementation details

### pdf-parse v2 API

The dependency is `pdf-parse@^2.4.5` — **not** the `pdf-parse@1.x` package. The v2 API is class-based:

```js
const { PDFParse } = require('pdf-parse');
const pdf = new PDFParse(new Uint8Array(buffer));
const result = await pdf.getText();
const text = result.pages[0].text;  // raw text from first page
```

### Timesheet layout (0-indexed)

Data rows start at row 8 (0-indexed). The number of rows depends on the month (28–31 days). The last row with a date in column A marks the end of the data range. The filler auto-detects the layout by scanning column A. The formula row is one row below the last date row.

| Column | Purpose |
|--------|---------|
| A | Date (Excel serial number) |
| B | Check-in (Excel time fraction) |
| C | Check-out (Excel time fraction) |
| D | Total hours (Excel time fraction) |
| E | Status (`P` = present) |
| K | Activity/Remark (may contain pre-filled holidays) |

### Month validation

The filler validates that the PDF month matches the template month. If they differ (e.g., March PDF with April template), the `/convert` endpoint returns a 422 error with an Indonesian message: `"Bulan tidak cocok: PDF bulan Maret 2026, template bulan April 2026"`.

### White fill

All rows in the month's date range receive a solid pattern fill on every column:
- `H` (hadir) and `TK` (tanpa keterangan) rows: white (`FFFFFFFF`)
- `LIB` (libur/holiday) rows: gray (`FFBFBFBF`)

This overrides any pre-existing cell colors in the template.

### Date matching

- PDF dates are Indonesian locale (`DD MMMM YYYY`, e.g. `"02 Maret 2026"`)
- Converted to Excel 1900 serial numbers with the leap-year-bug correction (if serial ≥ 60, add 1)
- Timesheet rows are matched by equality of serial number in column A
- The number of data rows is auto-detected — no longer hardcoded to 31
- Times are written as **Excel time fractions** (numbers), not strings — critical for Excel to display them correctly

### Filling logic

- Days with data (`H` status): fill B (check-in), C (check-out), D (total), E (`P`). Preserve K (remark). Leave F–Z untouched.
- Days without data (`LIB`/`TK`): clear columns B–K, keep column A (date) intact.
- The COUNTIF formula (`COUNTIF(E{start}:E{end},"P")`) is written to column E in the row immediately after the last data row.

### Error messages

All user-facing error messages returned by the server are in Indonesian (`bahasa Indonesia`).
