# Activity Input Form — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-step flow where users preview parsed attendance data, input activities per day, then download the filled timesheet.

**Architecture:** New `POST /preview` endpoint (parses PDF + reads template K values, returns merged JSON). Existing `POST /convert` extended to accept an optional `activities` JSON field. Frontend rewritten as a single page with upload area, preview table with activity inputs on H rows, and download button.

**Tech Stack:** Express, multer, pdf-parse v2, ExcelJS, vanilla JS/HTML/CSS

---

### Task 1: Add `serialToIndonesianDate` helper to parser.js

**Files:**
- Modify: `lib/parser.js`

- [ ] **Step 1: Add `serialToIndonesianDate` function to `lib/parser.js`**

After the `timeToExcelFraction` function (line 37), add:

```js
function serialToIndonesianDate(serial) {
  let s = serial;
  if (s > 60) s -= 1;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = s * 86400000 + epoch;
  const jsDate = new Date(ms);
  const day = String(jsDate.getUTCDate()).padStart(2, '0');
  const monthName = Object.keys(INDONESIAN_MONTHS)[jsDate.getUTCMonth()];
  const year = jsDate.getUTCFullYear();
  return `${day} ${monthName} ${year}`;
}
```

- [ ] **Step 2: Export the new function**

Update `module.exports` at line 109:

```js
module.exports = { parsePdf, dateToExcelSerial, timeToExcelFraction, getRecordMonth, serialToIndonesianDate };
```

- [ ] **Step 3: Commit**

```bash
git add lib/parser.js
git commit -m "feat: add serialToIndonesianDate helper to parser"
```

---

### Task 2: Add `previewTemplate` and extend `fillTimesheet` in filler.js

**Files:**
- Modify: `lib/filler.js`

- [ ] **Step 1: Add `previewTemplate` function**

Add after the `detectLayout` function (after line 39):

```js
async function previewTemplate(templateBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const ws = wb.getWorksheet(1);

  const layout = detectLayout(ws);

  const rows = [];
  for (let row = layout.dataStart; row <= layout.dataEnd; row++) {
    const dateCell = ws.getCell(row, 1);
    const dateVal = dateCell.value;

    let serial;
    if (dateVal instanceof Date) {
      serial = dateToExcelSerial(dateVal);
    } else if (typeof dateVal === 'number') {
      serial = dateVal;
    } else {
      continue;
    }

    const kCell = ws.getCell(row, 11);
    const activity = (kCell.value && typeof kCell.value === 'string' && kCell.value.trim() !== '')
      ? kCell.value
      : null;

    rows.push({ serial, activity });
  }

  return { month: layout.month, year: layout.year, rows };
}
```

- [ ] **Step 2: Add optional `activitiesMap` parameter to `fillTimesheet`**

Change the function signature at line 41:

```js
async function fillTimesheet(templateBuffer, records, activitiesMap) {
```

- [ ] **Step 3: Wire activitiesMap into the H-row filling logic**

Replace lines 98-101 (the remarkCell logic inside the `if (record.hasData)` block):

```js
      if (activitiesMap && activitiesMap.has(rowSerial)) {
        ws.getCell(row, 11).value = activitiesMap.get(rowSerial);
      } else {
        const remarkCell = ws.getCell(row, 11);
        if (!remarkCell.value || remarkCell.value === '') {
          remarkCell.value = null;
        }
      }
```

- [ ] **Step 4: Export `previewTemplate`**

Update `module.exports` at line 156:

```js
module.exports = { fillTimesheet, previewTemplate };
```

- [ ] **Step 5: Commit**

```bash
git add lib/filler.js
git commit -m "feat: add previewTemplate and activitiesMap support to filler"
```

---

### Task 3: Add `POST /preview` endpoint to server.js

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Update imports**

Replace line 5 with:

```js
const { parsePdf, getRecordMonth, serialToIndonesianDate } = require('./lib/parser');
const { fillTimesheet, previewTemplate } = require('./lib/filler');
```

- [ ] **Step 2: Add `POST /preview` endpoint**

Add after the static middleware line (after line 11):

```js
app.post('/preview', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'template', maxCount: 1 }
]), async (req, res) => {
  try {
    const pdfFile = req.files['pdf']?.[0];
    const templateFile = req.files['template']?.[0];

    if (!pdfFile || !templateFile) {
      return res.status(400).json({ error: 'File PDF dan template harus diunggah.' });
    }

    const { records, errors } = await parsePdf(pdfFile.buffer);

    if (records.length === 0) {
      return res.status(422).json({ error: 'Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?' });
    }

    const layout = await previewTemplate(templateFile.buffer);

    const pdfMonth = getRecordMonth(records);
    if (pdfMonth && (pdfMonth.month !== layout.month || pdfMonth.year !== layout.year)) {
      const INDONESIAN_MONTHS_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return res.status(422).json({
        error: `Bulan tidak cocok: PDF bulan ${INDONESIAN_MONTHS_NAMES[pdfMonth.month]} ${pdfMonth.year}, ` +
               `template bulan ${INDONESIAN_MONTHS_NAMES[layout.month]} ${layout.year}`
      });
    }

    const recordMap = {};
    for (const r of records) {
      recordMap[r.excelSerial] = r;
    }

    const rows = layout.rows.map(lr => {
      const rec = recordMap[lr.serial];
      return {
        serial: lr.serial,
        date: rec ? rec.date : serialToIndonesianDate(lr.serial),
        checkIn: rec && rec.hasData ? rec.checkIn : null,
        checkOut: rec && rec.hasData ? rec.checkOut : null,
        status: rec ? rec.status : null,
        activity: lr.activity
      };
    });

    res.json({ month: { month: layout.month, year: layout.year }, rows });
  } catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Terjadi kesalahan internal server' });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add POST /preview endpoint"
```

---

### Task 4: Extend `POST /convert` to accept activities

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Parse `activities` field from request body**

In the existing `POST /convert` handler, after extracting `templateFile` (after line 20), add:

```js
    let activitiesMap = null;
    if (req.body.activities) {
      try {
        const activities = JSON.parse(req.body.activities);
        activitiesMap = new Map();
        for (const a of activities) {
          if (a.activity && a.serial != null) {
            activitiesMap.set(a.serial, a.activity);
          }
        }
      } catch {
        return res.status(400).json({ error: 'Format data aktivitas tidak valid' });
      }
    }
```

- [ ] **Step 2: Pass `activitiesMap` to `fillTimesheet`**

On line 31, change:

```js
    const outputBuffer = await fillTimesheet(templateFile.buffer, records);
```

to:

```js
    const outputBuffer = await fillTimesheet(templateFile.buffer, records, activitiesMap);
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: extend POST /convert to accept activities"
```

---

### Task 5: Rewrite `public/index.html` with two-step UI

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace entire file with new HTML, CSS, and JS**

Write the complete `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DigiHC to Timesheet</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; }
  h1 { font-size: 1.4rem; margin-bottom: 24px; }
  label { display: block; font-weight: 600; margin: 16px 0 6px; font-size: 0.9rem; }
  input[type="file"] { display: block; margin-bottom: 8px; font-size: 0.85rem; }
  button { padding: 10px 28px; font-size: 0.95rem; cursor: pointer; }
  #status { margin-top: 16px; font-size: 0.9rem; min-height: 22px; }
  .error { color: #d32f2f; }
  .success { color: #2e7d32; }
  .info { color: #555; }

  #activitySection { margin-top: 32px; }
  #activitySection h2 { font-size: 1.1rem; margin-bottom: 12px; }

  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e0e0e0; }
  th { background: #f5f5f5; font-weight: 600; white-space: nowrap; }
  td { vertical-align: middle; }

  .activity-input { width: 100%; padding: 6px 8px; border: 1px solid #ccc; border-radius: 3px; font-size: 0.85rem; box-sizing: border-box; }
  .activity-input:focus { border-color: #1976d2; outline: none; }

  .status-H { color: #2e7d32; font-weight: 600; }
  .status-LIB { color: #888; }
  .status-TK { color: #d32f2f; }
  .status-none { color: #aaa; }

  #downloadBtn { margin-top: 20px; }

  @media (max-width: 600px) {
    th:nth-child(2), td:nth-child(2),
    th:nth-child(3), td:nth-child(3) { display: none; }
  }
</style>
</head>
<body>
<h1>DigiHC Attendance → Timesheet</h1>

<div id="uploadSection">
  <label for="pdf">DigiHC Attendance PDF</label>
  <input type="file" id="pdf" name="pdf" accept=".pdf" required>

  <label for="template">Timesheet Template (XLSX)</label>
  <input type="file" id="template" name="template" accept=".xlsx" required>

  <button id="previewBtn">Preview Data</button>
  <div id="status"></div>
</div>

<div id="activitySection" style="display:none">
  <h2>Aktivitas Harian</h2>
  <table id="activityTable">
    <thead>
      <tr>
        <th>Tanggal</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Status</th>
        <th>Aktivitas</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
  <button id="downloadBtn">Download Timesheet</button>
</div>

<script>
const statusEl = document.getElementById('status');
const previewBtn = document.getElementById('previewBtn');
const downloadBtn = document.getElementById('downloadBtn');
const activitySection = document.getElementById('activitySection');

let previewData = null;

function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = cls || '';
}

previewBtn.addEventListener('click', async () => {
  const pdfFile = document.getElementById('pdf').files[0];
  const templateFile = document.getElementById('template').files[0];

  if (!pdfFile || !templateFile) {
    setStatus('Pilih file PDF dan template terlebih dahulu.', 'error');
    return;
  }

  setStatus('Memproses...', 'info');
  previewBtn.disabled = true;

  try {
    const data = new FormData();
    data.append('pdf', pdfFile);
    data.append('template', templateFile);

    const res = await fetch('/preview', { method: 'POST', body: data });

    if (!res.ok) {
      const err = await res.json();
      setStatus('Error: ' + (err.error || 'Unknown error'), 'error');
      return;
    }

    previewData = await res.json();
    renderTable(previewData);
    activitySection.style.display = 'block';
    setStatus(previewData.rows.length + ' hari ditemukan. Isi aktivitas lalu klik Download.', 'success');
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  } finally {
    previewBtn.disabled = false;
  }
});

function renderTable(data) {
  const tbody = document.querySelector('#activityTable tbody');
  tbody.innerHTML = '';

  const statusLabels = { H: 'Hadir', LIB: 'Libur', TK: 'Tanpa Keterangan' };

  for (const row of data.rows) {
    const tr = document.createElement('tr');

    const tdDate = document.createElement('td');
    tdDate.textContent = row.date;

    const tdIn = document.createElement('td');
    tdIn.textContent = row.checkIn ? row.checkIn.substring(0, 5) : '\u2014';

    const tdOut = document.createElement('td');
    tdOut.textContent = row.checkOut ? row.checkOut.substring(0, 5) : '\u2014';

    const tdStatus = document.createElement('td');
    tdStatus.textContent = statusLabels[row.status] || '\u2014';
    tdStatus.className = 'status-' + (row.status || 'none');

    const tdAct = document.createElement('td');
    if (row.status === 'H') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'activity-input';
      input.value = row.activity || '';
      input.dataset.serial = row.serial;
      input.placeholder = 'Masukkan aktivitas...';
      tdAct.appendChild(input);
    } else {
      if (row.status === 'LIB' && row.activity) {
        tdAct.textContent = row.activity;
      } else if (row.status === 'TK') {
        tdAct.textContent = 'Tanpa Keterangan';
      } else {
        tdAct.textContent = '\u2014';
      }
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdIn);
    tr.appendChild(tdOut);
    tr.appendChild(tdStatus);
    tr.appendChild(tdAct);
    tbody.appendChild(tr);
  }
}

downloadBtn.addEventListener('click', async () => {
  const pdfFile = document.getElementById('pdf').files[0];
  const templateFile = document.getElementById('template').files[0];

  if (!pdfFile || !templateFile) {
    setStatus('File PDF dan template harus dipilih.', 'error');
    return;
  }

  const activities = [];
  document.querySelectorAll('.activity-input').forEach(input => {
    if (input.value.trim()) {
      activities.push({
        serial: parseInt(input.dataset.serial),
        activity: input.value.trim()
      });
    }
  });

  setStatus('Mengunduh...', 'info');
  downloadBtn.disabled = true;

  try {
    const data = new FormData();
    data.append('pdf', pdfFile);
    data.append('template', templateFile);
    data.append('activities', JSON.stringify(activities));

    const res = await fetch('/convert', { method: 'POST', body: data });

    if (!res.ok) {
      const err = await res.json();
      setStatus('Error: ' + (err.error || 'Unknown error'), 'error');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'timesheet-filled.xlsx';
    a.click();
    URL.revokeObjectURL(url);

    setStatus('Download dimulai!', 'success');
  } catch (err) {
    setStatus('Error: ' + err.message, 'error');
  } finally {
    downloadBtn.disabled = false;
  }
});
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "feat: rewrite frontend with two-step activity input UI"
```

---

### Task 6: Manual verification

**Files:**
- None (manual testing)

- [ ] **Step 1: Start the server**

```bash
npm start
```

Expected: `Server running at http://localhost:3000`

- [ ] **Step 2: Test preview with valid files**

Open `http://localhost:3000`, upload `sample-digihc.pdf` and `sample-timesheet.xlsx`, click "Preview Data".

Expected:
- Table appears with 31 rows (March 2026)
- H rows have text inputs in the Activity column
- LIB/TK rows show read-only labels
- Status message shows "31 hari ditemukan"

- [ ] **Step 3: Test month mismatch**

Upload `sample-digihc.pdf` (March) with `sample-timesheet-final.xlsx` (April), click "Preview Data".

Expected:
- Error: "Bulan tidak cocok: PDF bulan Maret 2026, template bulan April 2026"

- [ ] **Step 4: Test download with activities**

Preview March PDF + March template. Type some activities on H rows. Click "Download Timesheet".

Expected:
- XLSX downloads successfully
- Open in Excel: column K contains the typed activities on corresponding rows

- [ ] **Step 5: Test download without activities (backward compatibility)**

Preview March PDF + March template. Click "Download Timesheet" without typing any activities.

Expected:
- XLSX downloads successfully
- Open in Excel: row fill is white, check-in/out times are filled, column K is as-is from template

- [ ] **Step 6: Test error on invalid activities JSON**

This is a server-level test. Use curl:

```bash
curl -X POST http://localhost:3000/convert \
  -F "pdf=@sample-digihc.pdf" \
  -F "template=@sample-timesheet.xlsx" \
  -F "activities=not-json"
```

Expected: `{"error":"Format data aktivitas tidak valid"}` (400)

- [ ] **Step 7: Commit (if no issues)**

If all steps pass, no further commits needed. If fixes were required, commit them.
