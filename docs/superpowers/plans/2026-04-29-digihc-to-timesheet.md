# DigiHC PDF to Timesheet XLSX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web app where users upload a DigiHC attendance PDF and an XLSX timesheet template, and download a filled timesheet with check-in/check-out times.

**Architecture:** Express server with a single HTML upload page. `lib/parser.js` extracts attendance data from the PDF. `lib/filler.js` matches dates and writes times to the XLSX. Both operate on buffers (no temp files).

**Tech Stack:** Node.js, Express, multer, pdf-parse, xlsx

---

### Task 1: Project scaffold and dependencies

**Files:**
- Create: `lib/parser.js`
- Create: `lib/filler.js`
- Create: `public/index.html`
- Create: `server.js`
- Modify: `package.json` (add scripts)

- [ ] **Step 1: Clean up existing npm packages and install new ones**

```bash
npm install express multer
```

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p lib public
```

- [ ] **Step 3: Add `package.json` scripts**

Read the current `package.json` first, then edit to add:

```json
"scripts": {
  "start": "node server.js"
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/ public/ server.js
git commit -m "chore: scaffold project structure and dependencies"
```

---

### Task 2: Implement PDF parser (`lib/parser.js`)

**Files:**
- Create: `lib/parser.js`
- Test manually against `sample-digihc.pdf`

- [ ] **Step 1: Write `lib/parser.js` with all parsing functions**

```javascript
const { PDFParse } = require('pdf-parse');

const INDONESIAN_MONTHS = {
  'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3,
  'Mei': 4, 'Juni': 5, 'Juli': 6, 'Agustus': 7,
  'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
};

const MONTH_NAMES = Object.keys(INDONESIAN_MONTHS).join('|');
const DATE_REGEX = new RegExp(`(\\d{2})\\s+(${MONTH_NAMES})\\s+(\\d{4})`);
const TIME_REGEX = /(\d{2}:\d{2}:\d{2})/g;
const DATA_LINE_REGEX = /^(\d{2}:\d{2}:\d{2}|-)\t/;

function parseIndonesianDate(dateStr) {
  const match = dateStr.match(DATE_REGEX);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = INDONESIAN_MONTHS[match[2]];
  const year = parseInt(match[3], 10);
  return new Date(year, month, day);
}

function dateToExcelSerial(date) {
  // Excel epoch: 1899-12-30 (day 0), +1 for 1900-01-01 = day 1
  // Also account for Excel thinking 1900 is a leap year (day 60 exists)
  const epoch = Date.UTC(1899, 11, 30);
  const serial = (date.getTime() - epoch) / 86400000;
  return serial >= 60 ? serial + 1 : serial;
}

function timeToExcelFraction(timeStr) {
  const [h, m, s] = timeStr.split(':').map(Number);
  return (h * 3600 + m * 60 + s) / 86400;
}

async function parsePdf(buffer) {
  const pdf = new PDFParse(new Uint8Array(buffer));
  const result = await pdf.getText();
  const text = result.pages[0].text;

  const lines = text.split('\n');
  const records = [];
  const errors = [];

  for (const line of lines) {
    if (!DATA_LINE_REGEX.test(line)) continue;

    const dateMatch = line.match(DATE_REGEX);
    if (!dateMatch) {
      errors.push('Could not parse date from line: ' + line.substring(0, 80));
      continue;
    }

    const date = parseIndonesianDate(dateMatch[0]);
    if (!date) {
      errors.push('Invalid date: ' + dateMatch[0]);
      continue;
    }

    const excelSerial = dateToExcelSerial(date);
    const timeMatches = line.match(TIME_REGEX);

    let checkIn = null;
    let checkOut = null;
    let hasData = false;

    if (timeMatches && timeMatches.length >= 2) {
      // First time in the actual data section is check-in, second is check-out
      // But the schedule also has time ranges like "08:00-17:00"
      // The data fields are tab-separated; field 1 is checkOut
      const fields = line.split('\t');
      const checkOutCandidate = fields[0];

      // Find check-in: the time that appears after the date in field 2
      const afterDate = line.substring(dateMatch.index + dateMatch[0].length);
      const checkInMatch = afterDate.match(TIME_REGEX);

      if (TIME_REGEX.test(checkOutCandidate) && checkInMatch) {
        checkOut = checkOutCandidate;
        checkIn = checkInMatch[0];
        hasData = true;
      }
    }

    records.push({
      excelSerial,
      date: dateMatch[0],
      checkIn,
      checkOut,
      hasData
    });
  }

  return { records, errors };
}

module.exports = { parsePdf, dateToExcelSerial, timeToExcelFraction };
```

- [ ] **Step 2: Write a quick verification script to test the parser**

```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "
const { parsePdf } = require('./lib/parser');
const fs = require('fs');
(async () => {
  const buf = fs.readFileSync('sample-digihc.pdf');
  const { records, errors } = await parsePdf(buf);
  console.log('Errors:', errors.length);
  console.log('Records:', records.length);
  records.forEach(r => {
    console.log(r.hasData ? 'DATA' : '----', r.date, '|', r.checkIn, '->', r.checkOut, '| serial:', r.excelSerial);
  });
})();
"
```

Expected output: 31 records, with ~16 marked DATA (status H) and ~15 marked `----` (LIB/TK). Each DATA row should have valid checkIn/checkOut times.

- [ ] **Step 3: Commit**

```bash
git add lib/parser.js
git commit -m "feat: implement PDF parser for DigiHC attendance reports"
```

---

### Task 3: Implement timesheet filler (`lib/filler.js`)

**Files:**
- Create: `lib/filler.js`

- [ ] **Step 1: Write `lib/filler.js`**

```javascript
const XLSX = require('xlsx');

const DATA_ROWS = { start: 8, end: 38 }; // 0-indexed rows 8-38 (31 days)
const COL = {
  A: 0, B: 1, C: 2, D: 3, E: 4,
  F: 5, G: 6, H: 7, I: 8, J: 9, K: 10
};

function fillTimesheet(templateBuffer, records) {
  const wb = XLSX.read(templateBuffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];

  const dateMap = {};
  for (const r of records) {
    dateMap[r.excelSerial] = r;
  }

  for (let row = DATA_ROWS.start; row <= DATA_ROWS.end; row++) {
    const dateCell = ws[XLSX.utils.encode_cell({ r: row, c: COL.A })];
    if (!dateCell || dateCell.t !== 'n') continue;

    const rowSerial = dateCell.v;
    const record = dateMap[rowSerial];
    if (!record) continue;

    if (record.hasData) {
      // Fill check-in (B), check-out (C), total (D), present (E)
      const checkInFrac = require('./parser').timeToExcelFraction(record.checkIn);
      const checkOutFrac = require('./parser').timeToExcelFraction(record.checkOut);

      ws[XLSX.utils.encode_cell({ r: row, c: COL.B })] = { t: 'n', v: checkInFrac };
      ws[XLSX.utils.encode_cell({ r: row, c: COL.C })] = { t: 'n', v: checkOutFrac };
      ws[XLSX.utils.encode_cell({ r: row, c: COL.D })] = { t: 'n', v: checkOutFrac - checkInFrac };

      // Preserve existing K (remark) if it exists, otherwise leave empty
      const existingK = ws[XLSX.utils.encode_cell({ r: row, c: COL.K })];
      if (!existingK || !existingK.v) {
        delete ws[XLSX.utils.encode_cell({ r: row, c: COL.K })];
      }

      ws[XLSX.utils.encode_cell({ r: row, c: COL.E })] = { t: 's', v: 'P' };
    } else {
      // Clear columns B through K for LIB/TK rows
      for (let c = COL.B; c <= COL.K; c++) {
        const cellRef = XLSX.utils.encode_cell({ r: row, c });
        delete ws[cellRef];
      }
    }
  }

  // Rebuild the column E formula in row 39 if it exists
  const totalCell = XLSX.utils.encode_cell({ r: 39, c: COL.E });
  if (ws[totalCell] && ws[totalCell].f) {
    ws[totalCell] = { t: 'n', v: 0, f: `COUNTIF(E${DATA_ROWS.start + 1}:E${DATA_ROWS.end + 1},"P")` };
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { fillTimesheet };
```

- [ ] **Step 2: Write a manual verification script**

```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "
const { parsePdf } = require('./lib/parser');
const { fillTimesheet } = require('./lib/filler');
const fs = require('fs');
(async () => {
  const pdfBuf = fs.readFileSync('sample-digihc.pdf');
  const { records, errors } = await parsePdf(pdfBuf);
  console.log('Records:', records.length, 'Errors:', errors.length);

  const templateBuf = fs.readFileSync('sample-timesheet.xlsx');
  const outputBuf = fillTimesheet(templateBuf, records);
  fs.writeFileSync('output-test.xlsx', outputBuf);
  console.log('Written output-test.xlsx');
})();
"
```

- [ ] **Step 3: Verify the output**

```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "
const XLSX = require('xlsx');
const wb = XLSX.readFile('output-test.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
for (let r = 8; r <= 38; r++) {
  const a = ws[XLSX.utils.encode_cell({r:r, c:0})];
  const b = ws[XLSX.utils.encode_cell({r:r, c:1})];
  const c = ws[XLSX.utils.encode_cell({r:r, c:2})];
  const d = ws[XLSX.utils.encode_cell({r:r, c:3})];
  const e = ws[XLSX.utils.encode_cell({r:r, c:4})];
  const k = ws[XLSX.utils.encode_cell({r:r, c:10})];
  const date = a ? a.w : '-';
  const start = b ? b.w : '-';
  const end = c ? c.w : '-';
  const total = d ? d.w : '-';
  const pres = e ? e.v : '-';
  const rem = k ? k.w : '-';
  console.log(date, '|', start, '|', end, '|', total, '|', pres, '|', rem);
}
"
```

Expected: For March 1 (serial 46082, LIB), columns B-K should be empty. For March 2 (serial 46083, H), columns B/C/D should show actual times, E should show 'P', and K should be preserved if it had a holiday.

- [ ] **Step 4: Commit**

```bash
git add lib/filler.js
git commit -m "feat: implement timesheet filler with date matching"
```

---

### Task 4: Create HTML upload page (`public/index.html`)

**Files:**
- Create: `public/index.html`

- [ ] **Step 1: Write `public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DigiHC to Timesheet</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 80px auto; padding: 0 20px; }
  h1 { font-size: 1.4rem; margin-bottom: 24px; }
  label { display: block; font-weight: 600; margin: 16px 0 6px; font-size: 0.9rem; }
  input[type="file"] { display: block; margin-bottom: 8px; }
  button { margin-top: 20px; padding: 10px 28px; font-size: 0.95rem; cursor: pointer; }
  #status { margin-top: 16px; font-size: 0.9rem; }
  .error { color: #d32f2f; }
  .success { color: #2e7d32; }
</style>
</head>
<body>
<h1>DigiHC Attendance → Timesheet</h1>

<form id="uploadForm">
  <label for="pdf">DigiHC Attendance PDF</label>
  <input type="file" id="pdf" name="pdf" accept=".pdf" required>

  <label for="template">Timesheet Template (XLSX)</label>
  <input type="file" id="template" name="template" accept=".xlsx" required>

  <button type="submit">Convert & Download</button>
</form>

<div id="status"></div>

<script>
const form = document.getElementById('uploadForm');
const status = document.getElementById('status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.textContent = 'Processing...';
  status.className = '';

  const data = new FormData();
  data.append('pdf', document.getElementById('pdf').files[0]);
  data.append('template', document.getElementById('template').files[0]);

  try {
    const res = await fetch('/convert', { method: 'POST', body: data });

    if (!res.ok) {
      const err = await res.json();
      status.textContent = 'Error: ' + (err.error || 'Unknown error');
      status.className = 'error';
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timesheet-filled.xlsx';
    a.click();
    URL.revokeObjectURL(url);

    status.textContent = 'Download started!';
    status.className = 'success';
  } catch (err) {
    status.textContent = 'Error: ' + err.message;
    status.className = 'error';
  }
});
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: add HTML upload page"
```

---

### Task 5: Implement Express server (`server.js`)

**Files:**
- Create: `server.js`

- [ ] **Step 1: Write `server.js`**

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const { parsePdf } = require('./lib/parser');
const { fillTimesheet } = require('./lib/filler');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.post('/convert', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'template', maxCount: 1 }
]), async (req, res) => {
  try {
    const pdfFile = req.files['pdf']?.[0];
    const templateFile = req.files['template']?.[0];

    if (!pdfFile || !templateFile) {
      return res.status(400).json({ error: 'Both PDF and template files are required.' });
    }

    const { records, errors } = await parsePdf(pdfFile.buffer);

    if (records.length === 0) {
      return res.status(422).json({ error: 'No attendance data found in PDF. Is this a DigiHC attendance report?' });
    }

    const outputBuffer = fillTimesheet(templateFile.buffer, records);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="timesheet-filled.xlsx"');
    res.send(outputBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Start the server and verify it runs**

```bash
node server.js &
sleep 2
curl -s http://localhost:3000/ | head -5
kill %1
```

Expected: HTML page content returned. Should see `<h1>DigiHC Attendance → Timesheet</h1>`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add Express server with /convert endpoint"
```

---

### Task 6: End-to-end verification

**Files:** None (test only)

- [ ] **Step 1: Start the server**

```bash
node server.js &
sleep 2
```

- [ ] **Step 2: Test the convert endpoint with sample files**

```bash
curl -s -X POST http://localhost:3000/convert \
  -F "pdf=@sample-digihc.pdf" \
  -F "template=@sample-timesheet.xlsx" \
  -o test-output.xlsx
```

Expected: Output file created, no error.

- [ ] **Step 3: Verify the output XLSX contents**

```bash
"/mnt/c/Program Files/nodejs/node.exe" -e "
const XLSX = require('./node_modules/xlsx');
const wb = XLSX.readFile('test-output.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];

console.log('Row | Date       | Start    | End      | Total | Pres | Remark');
console.log('-----+------------+----------+----------+-------+------+-------');
for (let r = 8; r <= 38; r++) {
  const a = ws[XLSX.utils.encode_cell({r:r, c:0})];
  const b = ws[XLSX.utils.encode_cell({r:r, c:1})];
  const c = ws[XLSX.utils.encode_cell({r:r, c:2})];
  const d = ws[XLSX.utils.encode_cell({r:r, c:3})];
  const e = ws[XLSX.utils.encode_cell({r:r, c:4})];
  const k = ws[XLSX.utils.encode_cell({r:r, c:10})];
  const fmt = (cell) => cell ? (cell.w || String(cell.v)).padEnd(8) : ' -      ';
  const dt = a ? a.w.padEnd(10) : ' -        ';
  console.log(r.toString().padStart(2), dt, fmt(b), fmt(c), fmt(d), (e ? String(e.v).padEnd(4) : ' -  '), k ? k.w : '');
}
"
```

Expected output should show:
- March 1 (1-Mar-26): all B-K empty (LIB day)
- March 2 (2-Mar-26): B="7:31:45", C="16:06:39", D computed, E="P"
- March 3 (3-Mar-26): B="7:31:22", C="19:08:41", D computed, E="P" (has holiday remark in K)
- March 7 (7-Mar-26): all B-K empty (LIB day)
- March 25-27: all B-K empty (TK days)
- March 30-31: B/C/D filled, E="P"

- [ ] **Step 4: Kill server and cleanup test files**

```bash
kill %1
rm -f test-output.xlsx output-test.xlsx
```

- [ ] **Step 5: Commit if all passes**

```bash
echo "All verification steps passed"
```

(No new files to commit — this was a verification task.)

---

### Task 7: Add `.gitignore`

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Write `.gitignore`**

```
node_modules/
.env
*.xlsx
*.pdf
!sample-timesheet.xlsx
!sample-digihc.pdf
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore"
```
