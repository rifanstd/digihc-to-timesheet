# DigiHC PDF to Timesheet XLSX — Design Spec

**Date:** 2026-04-29
**Status:** Draft

## Problem

Every month, attendance data recorded in the DigiHC app is downloaded as a PDF ("Laporan Kehadiran Karyawan"). This data (check-in, check-out times) must be manually copied into an Excel timesheet template. This process is repetitive and error-prone.

## Goal

A simple local web application. User opens a browser, uploads a DigiHC attendance PDF and a timesheet XLSX template, clicks a button, and downloads the filled timesheet XLSX. For days with attendance data, it fills check-in/check-out times. For days without attendance data (LIB/TK), it clears the row content (except the date).

## Input

### DigiHC PDF

Indonesian-language attendance report. One page. Contains:

- Header: employee name (NPP/Nama), unit, time zone
- Data table with columns: No, Tanggal (date in `DD MMMM YYYY` format, Indonesian month names), Jam Check In (HH:MM:SS), Jam Check Out (HH:MM:SS), Total Jam Kerja, Ket (status code), Tipe Work Time
- Status codes: `H` (Hadir/Present), `LIB` (Libur/Day Off), `TK` (Tanpa Keterangan/No Info)
- Days with `H` have check-in and check-out times; days with `LIB`/`TK` have `-`

### Timesheet XLSX Template

Single sheet with 31 day rows (rows 8–38, 0-indexed). Key columns:
- **A:** Date (Excel serial number, e.g. 46082 = 2026-03-01)
- **B:** Work Start (Excel time fraction)
- **C:** Work End (Excel time fraction)
- **D:** Total Hours (Excel time fraction)
- **E:** Present status (text, 'P' for present)
- **F–J:** Other attendance statuses (Sick, Business Trip, Permit, Vacation, Not Working)
- **K:** Activity/Remark (may contain pre-filled holidays)
- **L–Z:** Project metadata (preserved as-is)

## Scope

For each date present in the DigiHC PDF:

**Days with check-in and check-out data (status `H`):**
1. Fill **column B** with check-in time (as Excel time fraction)
2. Fill **column C** with check-out time (as Excel time fraction)
3. Compute and fill **column D** = check-out − check-in (as Excel time fraction)
4. Fill **column E** with `P`
5. Preserve all other columns (F–Z) as-is, including pre-filled holiday remarks in K

**Days without check-in/check-out (status `LIB`, `TK`, or `-`):**
1. Clear data in columns B through K for that row
2. Preserve column A (date) unchanged

**Days not mentioned in the PDF** (e.g. outside the report period) are left untouched.

## Architecture

**Server:** Lightweight Node.js HTTP server (Express or built-in `http` module) running locally.

**Client:** Single HTML page served by the server at `http://localhost:3000/` with a file upload form and download button.

### User Flow

1. User runs `node server.js` (or `npm start`)
2. Opens `http://localhost:3000` in browser
3. Uploads DigiHC PDF and timesheet template XLSX via the form
4. Clicks "Convert"
5. Server processes and returns the filled XLSX as a download

### Server Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serve the HTML upload page |
| POST | `/convert` | Accept multipart form with `pdf` and `template` files, return the filled XLSX |

### Processing Pipeline (server-side, in `POST /convert`)

```
Uploaded PDF  ──► PDF Parser ──► Attendance Records ──┐
                                                       ├──► Timesheet Filler ──► Response (XLSX download)
Uploaded XLSX ──► Template Reader ──► Row Map ────────┘
```

### Files

- **`server.js`** — Express server, serves the HTML page and handles `POST /convert`
- **`lib/parser.js`** — PDF parsing logic, extracts attendance records
- **`lib/filler.js`** — Timesheet filling logic, modifies XLSX in memory
- **`public/index.html`** — Upload form UI
- **`public/style.css`** — Minimal styling (optional)

### Core Modules

**lib/parser.js**
1. **parsePdf(buffer)** → `{records: [{date: Date, checkIn: string, checkOut: string, hasData: boolean}], errors: string[]}`
   - Extracts text from PDF buffer using `pdf-parse`
   - Finds data rows by pattern matching (whitespace-delimited values with time fields)
   - Parses Indonesian date strings (e.g. "02 Maret 2026") into JS Date objects
   - Returns all rows: those with check-in/check-out (`hasData: true`) and those without (`hasData: false`, LIB/TK)

2. **dateToExcelSerial(date)** → `number`
   - Converts JS Date to Excel 1900 date serial number

3. **timeToExcelFraction(hhmmss)** → `number`
   - Converts "HH:MM:SS" string to fraction of 24-hour day (e.g. "07:30:00" → 0.3125)

**lib/filler.js**
4. **fillTimesheet(templateBuffer, records)** → `Buffer`
   - Opens template XLSX from buffer using `xlsx`
   - Reads column A of each data row to get Excel date serial
   - For rows with `hasData: true`: writes B (check-in), C (check-out), D (total), E (`P` text)
   - For rows with `hasData: false`: clears columns B–K
   - Preserves all other columns (F–Z) for data rows, including pre-filled holiday remarks in K
   - Returns the modified workbook as an XLSX buffer

**server.js**
5. Express app with `multer` for file uploads, routes as described above

### Date Matching

The timesheet has Excel serial numbers in column A. The PDF has Indonesian date strings. Convert PDF dates to Excel serials, then match by equality. If a PDF date has no corresponding row in the template, warn and skip it.

### Data Format Notes

- Excel times are stored as **numbers** (fractions of a day), not strings. The xlsx library must write numbers, not strings, to B/C/D for the times to display correctly in Excel.
- Column E is the string `P`, not a number.
- The template may have merged cells, formulas, and styles — `xlsx` with default options should preserve these.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Missing PDF or template file in upload | 400 response with error message |
| PDF unreadable or not DigiHC format | 422 response with error message |
| Template unreadable or wrong format | 422 response with error message |
| No data rows found in PDF | 422 response with warning (still generate output) |
| PDF date not found in timesheet | Warn in response, skip the unmatched date |
| Ambiguous/duplicate date match | Warn, use first match |
| Missing check-in or check-out (LIB/TK) | Clear columns B–K for that row |

## Testing

Manual verification:
1. Start server, open browser at `http://localhost:3000`
2. Upload `sample-digihc.pdf` + `sample-timesheet.xlsx`, click Convert
3. Download and verify output XLSX has correct check-in/check-out times for each present day
4. Verify LIB/TK rows have only the date column preserved (B–K empty)
5. Verify holidays in column K are preserved for days with data (`H` status)
6. Verify columns F–Z are unchanged for days with data

## Dependencies

- `pdf-parse` (v2.4.5, already installed)
- `xlsx` (already installed)
- `express` — web server
- `multer` — multipart file upload handling
- Node.js ≥ 20

## Out of Scope

- Authentication / multi-user
- Deployment beyond localhost
- Config file / column mapping customization
- Status codes beyond `P` for Present
- Multiple months / batch processing
- Non-Indonesian month name support
