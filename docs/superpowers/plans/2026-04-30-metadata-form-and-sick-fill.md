# Metadata Form, Sick Column Fill, and Default Checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF metadata extraction, default 17:00 checkout for missing check-out times, sick column (F) fill, and editable metadata form to the DigiHC-to-Timesheet converter.

**Architecture:** Four files modified (`lib/parser.js`, `lib/filler.js`, `server.js`, `public/index.html`). Parser changes happen first (metadata + 17:00 default), then filler changes (sick column + header fill), then server endpoint changes (wire parser/filler to HTTP), then UI (form inputs). All operate on Buffers — no filesystem I/O.

**Tech Stack:** Node.js, Express 5, ExcelJS 4, pdf-parse 2, multer 2. No test framework exists — manual verification with `npm start`.

---

### Task 1: Parse metadata from DigiHC PDF header

**Files:**
- Modify: `lib/parser.js`

**What:** Add `parseMetadata()` function that extracts `{ name, unit, miiId }` from the PDF raw text. Call it inside `parsePdf()` and include `metadata` in the return value.

- [ ] **Step 1: Add `parseMetadata` function**

Add after the existing function definitions (after `serialToIndonesianDate`, before `parsePdf`):

```js
function parseMetadata(text) {
  const lines = text.split('\n');
  const topLines = lines.slice(0, 15);
  
  let name = null;
  let unit = null;
  let miiId = null;
  
  let labelBlockEnded = false;
  let pastTimeZone = false;
  
  for (let i = 0; i < topLines.length; i++) {
    const line = topLines[i].trim();
    
    if (!labelBlockEnded) {
      if (line.startsWith('NPP / Nama')) labelBlockEnded = true;
      continue;
    }
    
    // After label block, first non-empty line that isn't a header keyword is the name
    if (!name && line.length > 0 && line !== 'WIB' && !line.startsWith('Unit') && !line.startsWith('Time Zone')) {
      name = line;
      continue;
    }
    
    if (name && !pastTimeZone && line === 'WIB') {
      pastTimeZone = true;
      continue;
    }
    
    if (pastTimeZone && !unit && line.length > 0) {
      unit = line;
      continue;
    }
    
    // MII ID line starts with "/" after the headers
    if (unit && line.startsWith('/')) {
      miiId = line.replace('/', '').trim();
      break;
    }
  }
  
  return { name, unit, miiId };
}
```

- [ ] **Step 2: Call `parseMetadata` inside `parsePdf` and include in return**

In `parsePdf()`, after `const text = result.pages[0].text;`, call:

```js
const metadata = parseMetadata(text);
```

Change the return statements to include `metadata`:

```js
return { records, errors, metadata };
```

There are two return paths (one early return when no matches). Change both. Actually there's only one return — change it to:

```js
return { records, errors, metadata };
```

- [ ] **Step 3: Export `parseMetadata`**

Add to `module.exports`:

```js
module.exports = { parsePdf, parseMetadata, dateToExcelSerial, timeToExcelFraction, getRecordMonth, serialToIndonesianDate };
```

- [ ] **Step 4: Manual verification — run a quick script**

```bash
node -e "
const fs = require('fs');
const { parsePdf } = require('./lib/parser');
(async () => {
  const buf = fs.readFileSync('sample-digihc.pdf');
  const { records, metadata } = await parsePdf(buf);
  console.log('Records:', records.length);
  console.log('Metadata:', JSON.stringify(metadata, null, 2));
})();
"
```

Expected output: `Records: 31`, `Metadata: { "name": "RIFAN SETIADI", "unit": "Departemen Retail Channel Delivery", "miiId": "OM2502635" }`

---

### Task 2: Default check-out to 17:00 for check-in-only rows

**Files:**
- Modify: `lib/parser.js`

**What:** When `timeMatches.length === 1` (check-in found, no check-out), auto-set `checkOut = '17:00:00'` and `hasData = true`.

- [ ] **Step 1: Modify the time-matching logic in `parsePdf`**

In `parsePdf()`, locate the block starting around line 82 (`if (timeMatches && timeMatches.length >= 2)`). Replace that entire `if/else` block with:

```js
    if (timeMatches && timeMatches.length >= 1) {
      const fields = line.split('\t');
      const checkOutCandidate = fields[0];

      const afterDate = line.substring(dateMatch.index + dateMatch[0].length);
      const checkInMatch = afterDate.match(TIME_REGEX);

      if (checkInMatch) {
        checkIn = checkInMatch[0];
        hasData = true;

        // If check-out exists in the line, use it; otherwise default to 17:00
        if (TIME_REGEX.test(checkOutCandidate)) {
          checkOut = checkOutCandidate;
        } else {
          checkOut = '17:00:00';
        }
      }
    }
```

- [ ] **Step 2: Manual verification — check a known check-in-only row**

The March sample PDF has TK days (e.g., March 25-27) with no check-in or check-out. But the April sample likely has different content. Run:

```bash
node -e "
const fs = require('fs');
const { parsePdf } = require('./lib/parser');
(async () => {
  const buf = fs.readFileSync('sample-digihc.pdf');
  const { records } = await parsePdf(buf);
  // Show rows where checkIn exists but previous code had no hasData
  for (const r of records) {
    if (r.checkOut === '17:00:00') {
      console.log(r.date, 'checkIn:', r.checkIn, 'checkOut:', r.checkOut, 'hasData:', r.hasData);
    }
  }
  console.log('Total records:', records.length);
})();
"
```

If no rows show `17:00:00` in the March sample, that's normal — the feature handles an edge case. Just verify no errors.

- [ ] **Step 3: Verify `npm start` still works**

```bash
npm start &
sleep 2
curl -s http://localhost:3000 | head -5
kill %1
```

Should return the HTML page without errors.

---

### Task 3: Fill Sick column (F) with 'S' for S-status days

**Files:**
- Modify: `lib/filler.js`

**What:** In `fillTimesheet`, when a row has status `'S'` (non-hasData branch), write `'S'` to column 6 in addition to the existing `'Sakit'` in column 11.

- [ ] **Step 1: Add sick column fill in the non-hasData branch**

In `fillTimesheet`, find the block at lines 143-152:

```js
    } else {
      for (let c = 2; c <= 10; c++) {
        ws.getCell(row, c).value = null;
      }
      if (record.status === 'S') {
        ws.getCell(row, 11).value = 'Sakit';
      } else {
        ws.getCell(row, 11).value = null;
      }
    }
```

Replace with:

```js
    } else {
      for (let c = 2; c <= 10; c++) {
        ws.getCell(row, c).value = null;
      }
      if (record.status === 'S') {
        ws.getCell(row, 6).value = 'S';
        ws.getCell(row, 11).value = 'Sakit';
      } else {
        ws.getCell(row, 11).value = null;
      }
    }
```

- [ ] **Step 2: Manual verification — test with the April sample template**

Since the March sample has no S-status days, verify the code doesn't break existing functionality:

```bash
node -e "
const ExcelJS = require('exceljs');
const fs = require('fs');
const { parsePdf } = require('./lib/parser');
const { fillTimesheet } = require('./lib/filler');

(async () => {
  const pdfBuf = fs.readFileSync('sample-digihc.pdf');
  const tplBuf = fs.readFileSync('sample-timesheet.xlsx');
  const { records } = await parsePdf(pdfBuf);
  
  const outBuf = await fillTimesheet(tplBuf, records, null);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(outBuf);
  const ws = wb.getWorksheet(1);
  
  // Check all non-hasData rows
  let sickFilled = 0;
  for (let r = 9; r <= 39; r++) {
    const colF = ws.getCell(r, 6).value;
    const colK = ws.getCell(r, 11).value;
    if (colF === 'S') sickFilled++;
    if (colF === 'S' && colK !== 'Sakit') console.log('MISMATCH row', r);
  }
  console.log('Sick days with S in column F:', sickFilled);
  console.log('Test passed (March sample has 0 sick days, expected 0)');
})();
"
```

Expected: `Sick days with S in column F: 0`, `Test passed`.

---

### Task 4: Fill header cells with metadata values

**Files:**
- Modify: `lib/filler.js`

**What:** Add `headerFields` parameter to `fillTimesheet`. After opening the workbook, write values to the `":"` cells on rows 1–5.

- [ ] **Step 1: Update `fillTimesheet` signature and add header-fill logic**

Change the function signature from:
```js
async function fillTimesheet(templateBuffer, records, activitiesMap) {
```
to:
```js
async function fillTimesheet(templateBuffer, records, activitiesMap, headerFields = {}) {
```

After loading the workbook (`await wb.xlsx.load(templateBuffer)`) and getting the worksheet, add the header fill block before the `detectLayout` call:

```js
  const ws = wb.getWorksheet(1);

  // Fill header metadata cells (append values after ":" separator)
  if (headerFields) {
    const HEADER_ROWS = {
      projectName: 1,
      unit: 2,
      name: 3,
      miiId: 4,
      site: 5
    };

    for (const [key, rowNum] of Object.entries(HEADER_ROWS)) {
      const value = headerFields[key];
      if (value) {
        const cell = ws.getCell(rowNum, 3);
        cell.value = ': ' + value;
      }
    }
  }

  const layout = detectLayout(ws);
```

- [ ] **Step 2: Update `module.exports` if needed**

No change needed — `fillTimesheet` is already exported. The new parameter is optional (default `{}`), so existing callers work without changes.

- [ ] **Step 3: Manual verification — test header fill**

```bash
node -e "
const ExcelJS = require('exceljs');
const fs = require('fs');
const { parsePdf } = require('./lib/parser');
const { fillTimesheet } = require('./lib/filler');

(async () => {
  const pdfBuf = fs.readFileSync('sample-digihc.pdf');
  const tplBuf = fs.readFileSync('sample-timesheet-final.xlsx');
  const { records } = await parsePdf(pdfBuf);
  
  const headerFields = {
    projectName: 'PT Bank Negara Indonesia (Persero) Tbk',
    site: 'BNI',
    unit: 'Departemen Retail Channel Delivery',
    name: 'RIFAN SETIADI',
    miiId: 'OM2502635'
  };
  
  const outBuf = await fillTimesheet(tplBuf, records, null, headerFields);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(outBuf);
  const ws = wb.getWorksheet(1);
  
  console.log('Row 1, Col 3:', ws.getCell(1, 3).value);
  console.log('Row 2, Col 3:', ws.getCell(2, 3).value);
  console.log('Row 3, Col 3:', ws.getCell(3, 3).value);
  console.log('Row 4, Col 3:', ws.getCell(4, 3).value);
  console.log('Row 5, Col 3:', ws.getCell(5, 3).value);
  console.log('Row 1, Col 1 (label untouched):', ws.getCell(1, 1).value);
  console.log('Row 5, Col 1 (label untouched):', ws.getCell(5, 1).value);
})();
"
```

Expected: Row 1 C3 = `": PT Bank Negara Indonesia (Persero) Tbk"`, Row 5 C3 = `": BNI"`, labels in A1 and A5 unchanged.

---

### Task 5: `/preview` endpoint returns metadata

**Files:**
- Modify: `server.js`

**What:** Extract metadata from `parsePdf` result and include it + hardcoded defaults in the `/preview` JSON response.

- [ ] **Step 1: Update `/preview` to destructure metadata and return it**

In `server.js`, find the `/preview` handler (line 25). Change:

```js
    const { records, errors } = await parsePdf(pdfFile.buffer);
```

to:

```js
    const { records, errors, metadata } = await parsePdf(pdfFile.buffer);
```

In the response JSON (line 60), add `metadata` and `defaults`:

```js
    res.json({
      month: { month: layout.month, year: layout.year },
      rows,
      metadata,
      defaults: {
        projectName: 'PT Bank Negara Indonesia (Persero) Tbk',
        site: 'BNI'
      }
    });
```

- [ ] **Step 2: Manual verification — call `/preview` endpoint**

```bash
npm start &
sleep 2
# Create a temp directory for curl output
curl -s -X POST http://localhost:3000/preview \
  -F "pdf=@sample-digihc.pdf" \
  -F "template=@sample-timesheet-final.xlsx" \
  | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('metadata:',JSON.stringify(j.metadata));console.log('defaults:',JSON.stringify(j.defaults));console.log('rows:',j.rows.length)})"
kill %1
```

Expected: `metadata: {"name":"RIFAN SETIADI","unit":"Departemen Retail Channel Delivery","miiId":"OM2502635"}`, `defaults: {"projectName":"PT Bank Negara Indonesia (Persero) Tbk","site":"BNI"}`, `rows: 30`.

---

### Task 6: `/convert` endpoint accepts and passes `headerFields`

**Files:**
- Modify: `server.js`

**What:** Parse `req.body.headerFields` JSON, provide defaults, and pass to `fillTimesheet`.

- [ ] **Step 1: Add headerFields parsing in `/convert`**

In the `/convert` handler (line 68), after the `activitiesMap` parsing block (after line 93), add a `headerFields` parsing block:

```js
    let headerFields = {
      projectName: 'PT Bank Negara Indonesia (Persero) Tbk',
      site: 'BNI',
      unit: '',
      name: '',
      miiId: ''
    };
    if (req.body.headerFields) {
      try {
        const parsed = JSON.parse(req.body.headerFields);
        if (parsed.projectName) headerFields.projectName = parsed.projectName;
        if (parsed.site) headerFields.site = parsed.site;
        if (parsed.unit) headerFields.unit = parsed.unit;
        if (parsed.name) headerFields.name = parsed.name;
        if (parsed.miiId) headerFields.miiId = parsed.miiId;
      } catch {
        return res.status(400).json({ error: 'Format data header tidak valid' });
      }
    }
```

- [ ] **Step 2: Pass `headerFields` to `fillTimesheet`**

Change the `fillTimesheet` call (line 101) from:

```js
    const outputBuffer = await fillTimesheet(templateFile.buffer, records, activitiesMap);
```

to:

```js
    const outputBuffer = await fillTimesheet(templateFile.buffer, records, activitiesMap, headerFields);
```

- [ ] **Step 3: Manual verification — test full convert with headerFields**

```bash
npm start &
sleep 2
curl -s -X POST http://localhost:3000/convert \
  -F "pdf=@sample-digihc.pdf" \
  -F "template=@sample-timesheet-final.xlsx" \
  -F 'headerFields={"projectName":"PT Bank Negara Indonesia (Persero) Tbk","site":"BNI","unit":"Departemen Retail Channel Delivery","name":"RIFAN SETIADI","miiId":"OM2502635"}' \
  -o /tmp/test-output.xlsx
echo "Exit code: $?"
ls -la /tmp/test-output.xlsx
kill %1
```

Should produce a valid XLSX file. Then verify its contents:

```bash
node -e "
const ExcelJS = require('exceljs');
(async () => {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('/tmp/test-output.xlsx');
  const ws = wb.getWorksheet(1);
  console.log('Row 1 C3:', ws.getCell(1, 3).value);
  console.log('Row 2 C3:', ws.getCell(2, 3).value);
  console.log('Row 3 C3:', ws.getCell(3, 3).value);
  console.log('Row 4 C3:', ws.getCell(4, 3).value);
  console.log('Row 5 C3:', ws.getCell(5, 3).value);
})();
"
```

---

### Task 7: Add metadata form inputs to UI

**Files:**
- Modify: `public/index.html`

**What:** Add 5 labeled `<input>` fields inside `#activitySection` above the activity table. Populate on preview. Serialize on download.

- [ ] **Step 1: Add CSS styles for metadata form**

In the `<style>` block, after the existing styles (before `@media`), add:

```css
      #metadataForm {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 8px 12px;
        margin-bottom: 24px;
        padding: 16px;
        background: #fafafa;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
      }
      #metadataForm label {
        margin: 0;
        align-self: center;
        font-size: 0.85rem;
      }
      #metadataForm input {
        padding: 6px 10px;
        border: 1px solid #ccc;
        border-radius: 3px;
        font-size: 0.85rem;
        box-sizing: border-box;
      }
      #metadataForm input:focus {
        border-color: #1976d2;
        outline: none;
      }
```

- [ ] **Step 2: Add the metadata form HTML**

In the HTML body, inside `#activitySection`, add before the `<h2>` and table:

```html
      <div id="metadataForm">
        <label for="inputProjectName">Project Name</label>
        <input type="text" id="inputProjectName" />

        <label for="inputSite">SITE</label>
        <input type="text" id="inputSite" />

        <label for="inputUnit">Unit / Divisi</label>
        <input type="text" id="inputUnit" />

        <label for="inputName">Nama</label>
        <input type="text" id="inputName" />

        <label for="inputMiiId">MII ID</label>
        <input type="text" id="inputMiiId" />
      </div>
```

- [ ] **Step 3: Populate form in `renderTable()`**

After the existing `renderTable(data)` function, add at the beginning of the function (after clearing the table tbody):

```js
        // Populate metadata form
        document.getElementById('inputProjectName').value = data.defaults?.projectName || '';
        document.getElementById('inputSite').value = data.defaults?.site || '';
        document.getElementById('inputUnit').value = data.metadata?.unit || '';
        document.getElementById('inputName').value = data.metadata?.name || '';
        document.getElementById('inputMiiId').value = data.metadata?.miiId || '';
```

- [ ] **Step 4: Serialize form values in `downloadBtn` handler**

In the `downloadBtn` click handler, before the `setStatus("Mengunduh...")` line, add:

```js
        const headerFields = {
          projectName: document.getElementById('inputProjectName').value.trim(),
          site: document.getElementById('inputSite').value.trim(),
          unit: document.getElementById('inputUnit').value.trim(),
          name: document.getElementById('inputName').value.trim(),
          miiId: document.getElementById('inputMiiId').value.trim()
        };
        data.append('headerFields', JSON.stringify(headerFields));
```

- [ ] **Step 5: Manual verification — full UI flow**

```bash
npm start &
sleep 2
echo "Open http://localhost:3000 in a browser and test:"
echo "1. Upload sample-digihc.pdf + sample-timesheet-final.xlsx"
echo "2. Click Preview"
echo "3. Verify 5 metadata form fields are pre-populated"
echo "4. Edit any field (e.g., change Name)"
echo "5. Click Download"
echo "6. Open the downloaded XLSX, verify header cells reflect form values"
kill %1
```
