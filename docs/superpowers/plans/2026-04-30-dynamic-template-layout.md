# Dynamic Template Layout & Month Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-detect template layout instead of hardcoding row ranges, validate PDF and template months match, apply white fill to month rows, use Indonesian error messages.

**Architecture:** `lib/filler.js` gains `detectLayout(ws)` to scan column A for date rows and a formula row. `fillTimesheet` uses detected bounds and validates month match before filling. `lib/parser.js` gains `getRecordMonth()` to extract month/year from parsed records. `server.js` error messages converted to Indonesian.

**Tech Stack:** Node.js, exceljs@^4.4.0, Express, multer, pdf-parse@^2.4.5

---

### Task 1: Add `getRecordMonth` to PDF parser

**Files:**
- Modify: `lib/parser.js`

- [ ] **Step 1: Add `getRecordMonth` function**

Add the following function to `lib/parser.js`, after `parsePdf`:

```js
function getRecordMonth(records) {
  if (!records || records.length === 0) return null;
  const date = new Date(records[0].date.split(' ').reverse().map((p, i) => {
    const n = parseInt(p, 10);
    if (isNaN(n)) return INDONESIAN_MONTHS[p];
    return i === 0 ? n : n;
  }).reduce((a, b) => {
    if (typeof b === 'number') {
      a.push(b);
    }
    return a;
  }, []));
  
  // Simpler approach: parse date directly
  const match = records[0].date.match(DATE_REGEX);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = INDONESIAN_MONTHS[match[2]];
  const year = parseInt(match[3], 10);
  return { month, year };
}
```

Actually, use the already-defined `parseIndonesianDate` helper. Write this instead:

```js
function getRecordMonth(records) {
  if (!records || records.length === 0) return null;
  const date = parseIndonesianDate(records[0].date);
  if (!date) return null;
  return { month: date.getMonth(), year: date.getFullYear() };
}
```

- [ ] **Step 2: Export the new function**

Update the `module.exports` line:

```js
module.exports = { parsePdf, dateToExcelSerial, timeToExcelFraction, getRecordMonth };
```

- [ ] **Step 3: Verify no syntax errors**

Run:
```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "require('./lib/parser')" && echo "OK"
```
Expected: `OK`

- [ ] **Step 4: Test with sample PDF**

Run:
```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "
const { parsePdf, getRecordMonth } = require('./lib/parser');
const fs = require('fs');
(async () => {
  const buf = fs.readFileSync('sample-digihc.pdf');
  const { records } = await parsePdf(buf);
  const m = getRecordMonth(records);
  console.log('Month:', m.month, '(2=March)', 'Year:', m.year);
})();
"
```
Expected: `Month: 2 (2=March) Year: 2026`

- [ ] **Step 5: Commit**

```bash
git add lib/parser.js
git commit -m "feat: add getRecordMonth to parser"
```

---

### Task 2: Add `detectLayout` and update `fillTimesheet`

**Files:**
- Modify: `lib/filler.js`

- [ ] **Step 1: Write the `detectLayout` function**

Add the following function before `fillTimesheet` in `lib/filler.js`:

```js
const { dateToExcelSerial, timeToExcelFraction, getRecordMonth } = require('./parser');

function detectLayout(ws) {
  const dates = [];

  for (let row = 9; row <= ws.rowCount; row++) {
    const val = ws.getCell(row, 1).value;
    if (val === null || val === undefined) break;

    if (val instanceof Date) {
      dates.push({ row, month: val.getMonth(), year: val.getFullYear() });
    } else if (typeof val === 'number') {
      // Convert Excel serial to a JS Date via dateToExcelSerial
      // Excel serial >= 60 has the leap year bug correction
      let serial = val;
      if (serial > 60) serial -= 1;
      const epoch = Date.UTC(1899, 11, 30);
      const ms = serial * 86400000 + epoch;
      const jsDate = new Date(ms);
      dates.push({ row, month: jsDate.getUTCMonth(), year: jsDate.getUTCFullYear() });
    } else {
      break;
    }
  }

  if (dates.length === 0) {
    const err = new Error('Tidak ada baris tanggal yang terdeteksi di template');
    err.statusCode = 422;
    throw err;
  }

  return {
    month: dates[0].month,
    year: dates[0].year,
    dataStart: dates[0].row,
    dataEnd: dates[dates.length - 1].row,
    formulaRow: dates[dates.length - 1].row + 1,
    dayCount: dates.length
  };
}
```

- [ ] **Step 2: Rewrite the `fillTimesheet` function**

Replace the entire `fillTimesheet` function with:

```js
async function fillTimesheet(templateBuffer, records) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const ws = wb.getWorksheet(1);

  const layout = detectLayout(ws);

  const pdfMonth = getRecordMonth(records);
  if (!pdfMonth) {
    const err = new Error('Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?');
    err.statusCode = 422;
    throw err;
  }

  if (pdfMonth.month !== layout.month || pdfMonth.year !== layout.year) {
    const INDONESIAN_MONTHS_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const err = new Error(
      `Bulan tidak cocok: PDF bulan ${INDONESIAN_MONTHS_NAMES[pdfMonth.month]} ${pdfMonth.year}, ` +
      `template bulan ${INDONESIAN_MONTHS_NAMES[layout.month]} ${layout.year}`
    );
    err.statusCode = 422;
    throw err;
  }

  const recordMap = {};
  for (const r of records) {
    recordMap[r.excelSerial] = r;
  }

  let presentCount = 0;

  for (let row = layout.dataStart; row <= layout.dataEnd; row++) {
    const dateCell = ws.getCell(row, 1);
    const dateVal = dateCell.value;

    let rowSerial;
    if (dateVal instanceof Date) {
      rowSerial = dateToExcelSerial(dateVal);
    } else if (typeof dateVal === 'number') {
      rowSerial = dateVal;
    } else {
      continue;
    }

    const record = recordMap[rowSerial];
    if (!record) continue;

    if (record.hasData) {
      const checkInFrac = timeToExcelFraction(record.checkIn);
      const checkOutFrac = timeToExcelFraction(record.checkOut);

      ws.getCell(row, 2).value = checkInFrac;
      ws.getCell(row, 3).value = checkOutFrac;
      ws.getCell(row, 4).value = checkOutFrac - checkInFrac;
      ws.getCell(row, 5).value = 'P';

      const remarkCell = ws.getCell(row, 11);
      if (!remarkCell.value || remarkCell.value === '') {
        remarkCell.value = null;
      }

      presentCount++;
    } else {
      for (let c = 2; c <= 11; c++) {
        ws.getCell(row, c).value = null;
      }
    }
  }

  // White fill on all month rows, all columns
  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    for (let c = 1; c <= ws.columnCount; c++) {
      ws.getCell(r, c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
      };
    }
  }

  // COUNTIF formula
  const totalCell = ws.getCell(layout.formulaRow, 5);
  totalCell.value = {
    formula: `COUNTIF(E${layout.dataStart}:E${layout.dataEnd},"P")`,
    result: presentCount
  };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
```

- [ ] **Step 3: Update the import line and exports**

The top of `lib/filler.js` currently reads:
```js
const ExcelJS = require('exceljs');
const { dateToExcelSerial, timeToExcelFraction } = require('./parser');
```

Replace with:
```js
const ExcelJS = require('exceljs');
const { dateToExcelSerial, timeToExcelFraction, getRecordMonth } = require('./parser');
```

Remove the old column constant definitions and the old `DATA_START_ROW`, `DATA_END_ROW`, `TOTAL_ROW` constants since they're no longer used.

The final file should be:

```js
const ExcelJS = require('exceljs');
const { dateToExcelSerial, timeToExcelFraction, getRecordMonth } = require('./parser');

function detectLayout(ws) {
  const dates = [];

  for (let row = 9; row <= ws.rowCount; row++) {
    const val = ws.getCell(row, 1).value;
    if (val === null || val === undefined) break;

    if (val instanceof Date) {
      dates.push({ row, month: val.getMonth(), year: val.getFullYear() });
    } else if (typeof val === 'number') {
      let serial = val;
      if (serial > 60) serial -= 1;
      const epoch = Date.UTC(1899, 11, 30);
      const ms = serial * 86400000 + epoch;
      const jsDate = new Date(ms);
      dates.push({ row, month: jsDate.getUTCMonth(), year: jsDate.getUTCFullYear() });
    } else {
      break;
    }
  }

  if (dates.length === 0) {
    const err = new Error('Tidak ada baris tanggal yang terdeteksi di template');
    err.statusCode = 422;
    throw err;
  }

  return {
    month: dates[0].month,
    year: dates[0].year,
    dataStart: dates[0].row,
    dataEnd: dates[dates.length - 1].row,
    formulaRow: dates[dates.length - 1].row + 1,
    dayCount: dates.length
  };
}

async function fillTimesheet(templateBuffer, records) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const ws = wb.getWorksheet(1);

  const layout = detectLayout(ws);

  const pdfMonth = getRecordMonth(records);
  if (!pdfMonth) {
    const err = new Error('Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?');
    err.statusCode = 422;
    throw err;
  }

  if (pdfMonth.month !== layout.month || pdfMonth.year !== layout.year) {
    const INDONESIAN_MONTHS_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const err = new Error(
      `Bulan tidak cocok: PDF bulan ${INDONESIAN_MONTHS_NAMES[pdfMonth.month]} ${pdfMonth.year}, ` +
      `template bulan ${INDONESIAN_MONTHS_NAMES[layout.month]} ${layout.year}`
    );
    err.statusCode = 422;
    throw err;
  }

  const recordMap = {};
  for (const r of records) {
    recordMap[r.excelSerial] = r;
  }

  let presentCount = 0;

  for (let row = layout.dataStart; row <= layout.dataEnd; row++) {
    const dateCell = ws.getCell(row, 1);
    const dateVal = dateCell.value;

    let rowSerial;
    if (dateVal instanceof Date) {
      rowSerial = dateToExcelSerial(dateVal);
    } else if (typeof dateVal === 'number') {
      rowSerial = dateVal;
    } else {
      continue;
    }

    const record = recordMap[rowSerial];
    if (!record) continue;

    if (record.hasData) {
      const checkInFrac = timeToExcelFraction(record.checkIn);
      const checkOutFrac = timeToExcelFraction(record.checkOut);

      ws.getCell(row, 2).value = checkInFrac;
      ws.getCell(row, 3).value = checkOutFrac;
      ws.getCell(row, 4).value = checkOutFrac - checkInFrac;
      ws.getCell(row, 5).value = 'P';

      const remarkCell = ws.getCell(row, 11);
      if (!remarkCell.value || remarkCell.value === '') {
        remarkCell.value = null;
      }

      presentCount++;
    } else {
      for (let c = 2; c <= 11; c++) {
        ws.getCell(row, c).value = null;
      }
    }
  }

  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    for (let c = 1; c <= ws.columnCount; c++) {
      ws.getCell(r, c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
      };
    }
  }

  const totalCell = ws.getCell(layout.formulaRow, 5);
  totalCell.value = {
    formula: `COUNTIF(E${layout.dataStart}:E${layout.dataEnd},"P")`,
    result: presentCount
  };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { fillTimesheet };
```

- [ ] **Step 4: Verify no syntax errors**

Run:
```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "require('./lib/filler')" && echo "OK"
```
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add lib/filler.js
git commit -m "feat: auto-detect template layout, add month validation and white fill"
```

---

### Task 3: Update server.js error messages to Indonesian

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Convert error messages**

Read `server.js`, then update the error messages:

```js
// Line 22 - old
return res.status(400).json({ error: 'Both PDF and template files are required.' });
// new
return res.status(400).json({ error: 'File PDF dan template harus diunggah.' });

// Line 28 - old
return res.status(422).json({ error: 'No attendance data found in PDF. Is this a DigiHC attendance report?' });
// new
return res.status(422).json({ error: 'Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?' });

// Line 38 - old (catch-all), keep err.message as-is
// But add a default Indonesian message for unknown errors
```

For the catch-all handler at line 38:

```js
res.status(500).json({ error: err.message || 'Terjadi kesalahan internal server' });
```

Also update the 422 handler to check for `err.statusCode` from filler.js errors:

```js
// In the catch block, before the general 500:
} catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Terjadi kesalahan internal server' });
}
```

- [ ] **Step 2: Verify no syntax errors**

Run:
```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "require('./server')" 2>&1 | head -1
```
Expected: `Server running at http://localhost:3000` (it will start listening — kill it)

```bash
kill %1 2>/dev/null; true
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: use Indonesian language for all error messages"
```

---

### Task 4: Update .gitignore for new sample file

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add exception for the new sample**

Add `!sample-timesheet-final.xlsx` to `.gitignore`:

```
node_modules/
.env
*.xlsx
*.pdf
!sample-timesheet.xlsx
!sample-timesheet-final.xlsx
!sample-digihc.pdf
```

- [ ] **Step 2: Stage the new sample file**

```bash
git add -f sample-timesheet-final.xlsx .gitignore
git commit -m "chore: add April 2026 timesheet sample to git"
```

Note: `git add -f` is needed because `.gitignore` blocks `*.xlsx`.

---

### Task 5: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the timesheet layout section**

Replace the "Timesheet layout (0-indexed)" section:

```markdown
### Timesheet layout (0-indexed)

- Data rows start at row 8 (0-indexed). The number of rows depends on the month (28–31 days). The last row with a date in column A marks the end of the data range.
- The filler auto-detects the layout by scanning column A. The formula row is one row below the last date row.
- Columns: A = date (Excel serial), B = check-in, C = check-out, D = total hours, E = status (`P`), K = remark
```

- [ ] **Step 2: Replace the date matching section**

Remove the hardcoded "31 rows (0-indexed rows 8–38)" reference and update the matching section to note auto-detection.

- [ ] **Step 3: Add new sections**

Add these after the "Timesheet layout" section:

```markdown
### Month validation

The filler validates that the PDF month and template month match. If they differ (e.g., March PDF with April template), the `/convert` endpoint returns a 422 error with an Indonesian message: `"Bulan tidak cocok: PDF bulan Maret 2026, template bulan April 2026"`.

### White fill

All rows in the month's date range receive a white (`FFFFFFFF`) solid pattern fill on every column. This overrides any pre-existing cell colors (e.g., colored weekends/holidays) in the template.

### Error messages

All user-facing error messages returned by the server are in Indonesian (`bahasa Indonesia`).
```

- [ ] **Step 4: Update the filling logic section**

Remove the hardcoded row references:

```markdown
### Filling logic

- Days with data (`H` status): fill B (check-in), C (check-out), D (total), E (`P`). Preserve K (remark). Leave F–Z untouched.
- Days without data (`LIB`/`TK`): clear columns B–K, keep column A (date) intact.
- The COUNTIF formula in column E is written to the row immediately after the last data row.
```

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md for dynamic layout and month validation"
```

---

### Task 6: End-to-end verification

**Files:** None (test only)

- [ ] **Step 1: Start the server**

```bash
"/mnt/c/Program Files/nodejs/node.exe" server.js &
sleep 3
```
Expected: `Server running at http://localhost:3000`

- [ ] **Step 2: Test with March PDF + March template (should succeed)**

```bash
curl -s -o /tmp/timesheet-march.xlsx \
  -F "pdf=@sample-digihc.pdf" \
  -F "template=@sample-timesheet.xlsx" \
  http://localhost:3000/convert
```
Expected: Downloads an XLSX file. Verify it's valid:

```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "
const ExcelJS = require('exceljs');
const fs = require('fs');
(async () => {
  const buf = fs.readFileSync('/tmp/timesheet-march.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(1);
  // Check row 10 (March 2, has data)
  console.log('R10 B (check-in):', ws.getCell(10, 2).value);
  console.log('R10 C (check-out):', ws.getCell(10, 3).value);
  console.log('R10 E (status):', ws.getCell(10, 5).value);
  // Check row 11 (March 3, has holiday remark)
  console.log('R11 K (remark):', ws.getCell(11, 11).value);
  // Check row 9 (March 1, LIB - should be cleared)
  console.log('R9 B (cleared):', ws.getCell(9, 2).value);
  // Check formula row 40
  const f40 = ws.getCell(40, 5).value;
  console.log('R40 formula:', f40 ? f40.formula || f40 : null);
  // Check white fill on a data row
  console.log('R10 fill:', JSON.stringify(ws.getCell(10, 1).fill));
})();
"
```
Expected:
- R10 B = a number ~0.31 (time fraction)
- R10 C = a number ~0.67 (time fraction)
- R10 E = "P"
- R11 K = "Wafat Yesus Kristus" (preserved)
- R9 B = null (LIB row cleared)
- R40 formula = `COUNTIF(E9:E39,"P")`
- R10 fill = solid, fgColor.argb = "FFFFFFFF"

- [ ] **Step 3: Test with March PDF + April template (should fail with 422)**

```bash
curl -s -o /tmp/timesheet-fail.xlsx \
  -F "pdf=@sample-digihc.pdf" \
  -F "template=@sample-timesheet-final.xlsx" \
  http://localhost:3000/convert
```
Expected: JSON error response with `"Bulan tidak cocok: PDF bulan Maret 2026, template bulan April 2026"`

- [ ] **Step 4: Test with April template alone (no data) — verify layout detection**

```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "
const ExcelJS = require('exceljs');
const fs = require('fs');
const { fillTimesheet } = require('./lib/filler');
(async () => {
  // Use the March PDF to test detection (we don't have an April PDF)
  const { parsePdf, getRecordMonth } = require('./lib/parser');
  const pdfBuf = fs.readFileSync('sample-digihc.pdf');
  const { records } = await parsePdf(pdfBuf);
  console.log('PDF month:', getRecordMonth(records));
  
  const xlBuf = fs.readFileSync('sample-timesheet-final.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlBuf);
  const ws = wb.getWorksheet(1);
  // Just verify the layout detection part
  let dates = [];
  for (let r = 9; r <= 55; r++) {
    const v = ws.getCell(r, 1).value;
    if (!v) { console.log('End of dates at row', r); break; }
    dates.push(r);
  }
  console.log('Date rows:', dates.length, 'first:', dates[0], 'last:', dates[dates.length-1]);
  console.log('Formula row would be:', dates[dates.length-1]+1);
})();
"
```
Expected: `End of dates at row 39`, `Date rows: 30 first: 9 last: 38`, `Formula row would be: 39`

- [ ] **Step 5: Verify ZIP structure preserved for April template fill**

Note: since we don't have an April PDF, test with March PDF against the March template for ZIP integrity:

```bash
python3 -c "
import zipfile, os
os.chdir('/mnt/d/projects/digihc-to-timesheet')

original = set()
filled = set()

with zipfile.ZipFile('sample-timesheet.xlsx') as z:
    for info in z.infolist():
        original.add(info.filename)

with zipfile.ZipFile('/tmp/timesheet-march.xlsx') as z:
    for info in z.infolist():
        filled.add(info.filename)

missing = original - filled
extra = filled - original

if missing:
    print('MISSING from output:', missing)
if extra:
    print('EXTRA in output:', extra)

critical = [
    'xl/styles.xml',
    'xl/media/image1.png',
    'xl/drawings/drawing1.xml',
    'xl/sharedStrings.xml',
]
for f in critical:
    status = 'PRESERVED' if f in filled else 'MISSING!'
    print(f, '—', status)

print('ZIP check complete')
"
```
Expected: All critical files PRESERVED, no MISSING entries.

- [ ] **Step 6: Stop the server and clean up**

```bash
kill %1 2>/dev/null || true
rm -f /tmp/timesheet-march.xlsx /tmp/timesheet-fail.xlsx
```

---

### Task 7: Final commit

**Files:** None (verification only)

- [ ] **Step 1: Verify all changes are committed**

```bash
git status
```
Expected: `nothing to commit, working tree clean`

If there are uncommitted changes from verification, commit or discard them.
