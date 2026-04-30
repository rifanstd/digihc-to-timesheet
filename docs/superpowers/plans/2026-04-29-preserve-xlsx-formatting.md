# Preserve XLSX Template Formatting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `xlsx` with `exceljs` so the template XLSX retains all formatting, styles, images, and structure after filling.

**Architecture:** Swap the XLSX read/write layer from `xlsx` (community edition, strips formatting) to `exceljs` (preserves full fidelity). The filling logic stays the same — only the API calls change. `fillTimesheet` becomes async.

**Tech Stack:** Node.js, exceljs@^4.4.0, Express, multer, pdf-parse@^2.4.5

---

### Task 1: Remove xlsx dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove xlsx from package.json**

Replace the dependencies section. The current file has both `exceljs` and `xlsx` — remove `xlsx`:

```json
{
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "exceljs": "^4.4.0",
    "express": "^5.1.0",
    "multer": "^2.0.2",
    "pdf-parse": "^2.4.5"
  }
}
```

- [ ] **Step 2: Run npm install to clean up**

```bash
npm install
```
Expected: No errors. `xlsx` removed from `node_modules`.

---

### Task 2: Rewrite lib/filler.js with exceljs

**Files:**
- Modify: `lib/filler.js` (entire file)

- [ ] **Step 1: Replace the entire file**

The `xlsx` API uses 0-indexed rows/cols. `exceljs` uses 1-indexed. Date cells from `exceljs` are Date objects — we convert them to serial numbers with the existing `dateToExcelSerial` from `parser.js`.

Write the following to `lib/filler.js`:

```js
const ExcelJS = require('exceljs');
const { dateToExcelSerial, timeToExcelFraction } = require('./parser');

// exceljs uses 1-indexed rows and columns
const DATA_START_ROW = 9;
const DATA_END_ROW = 39;
const DATE_COL = 1;
const CHECKIN_COL = 2;
const CHECKOUT_COL = 3;
const TOTAL_COL = 4;
const STATUS_COL = 5;
const REMARK_COL = 11;
const TOTAL_ROW = 40;

async function fillTimesheet(templateBuffer, records) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const ws = wb.getWorksheet(1);

  const recordMap = {};
  for (const r of records) {
    recordMap[r.excelSerial] = r;
  }

  let presentCount = 0;

  for (let row = DATA_START_ROW; row <= DATA_END_ROW; row++) {
    const dateCell = ws.getCell(row, DATE_COL);
    const dateVal = dateCell.value;

    // exceljs returns Date objects for date-formatted cells;
    // convert to Excel serial number for matching
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

      ws.getCell(row, CHECKIN_COL).value = checkInFrac;
      ws.getCell(row, CHECKOUT_COL).value = checkOutFrac;
      ws.getCell(row, TOTAL_COL).value = checkOutFrac - checkInFrac;
      ws.getCell(row, STATUS_COL).value = 'P';

      // Preserve remark if it has content; clear if empty
      const remarkCell = ws.getCell(row, REMARK_COL);
      if (!remarkCell.value || remarkCell.value === '') {
        remarkCell.value = null;
      }

      presentCount++;
    } else {
      // Clear columns B–K but leave column A intact
      for (let c = CHECKIN_COL; c <= REMARK_COL; c++) {
        ws.getCell(row, c).value = null;
      }
    }
  }

  // Row 40, column E: COUNTIF formula
  const totalCell = ws.getCell(TOTAL_ROW, STATUS_COL);
  totalCell.value = {
    formula: `COUNTIF(E${DATA_START_ROW}:E${DATA_END_ROW},"P")`,
    result: presentCount
  };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { fillTimesheet };
```

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
node -e "require('./lib/filler')" && echo "OK"
```
Expected: `OK` (no errors).

---

### Task 3: Update server.js to await fillTimesheet

**Files:**
- Modify: `server.js:31`

- [ ] **Step 1: Add await to the fillTimesheet call**

`fillTimesheet` is now async. Change line 31 from:

```js
const outputBuffer = fillTimesheet(templateFile.buffer, records);
```

to:

```js
const outputBuffer = await fillTimesheet(templateFile.buffer, records);
```

---

### Task 4: Verify end-to-end with sample files

- [ ] **Step 1: Start the server**

```bash
npm start &
sleep 2
```
Expected: `Server running at http://localhost:3000`

- [ ] **Step 2: Upload sample files and check the output**

```bash
curl -s -o /tmp/timesheet-filled.xlsx \
  -F "pdf=@sample-digihc.pdf" \
  -F "template=@sample-timesheet.xlsx" \
  http://localhost:3000/convert
```
Expected: HTTP 200, no error in response. Output file is a valid XLSX.

- [ ] **Step 3: Verify output preserves formatting and structure**

```bash
python3 -c "
import zipfile, os
os.chdir('/mnt/d/projects/digihc-to-timesheet')

original = set()
filled = set()

with zipfile.ZipFile('sample-timesheet.xlsx') as z:
    for info in z.infolist():
        original.add(info.filename)

with zipfile.ZipFile('/tmp/timesheet-filled.xlsx') as z:
    for info in z.infolist():
        filled.add(info.filename)

missing = original - filled
extra = filled - original

if missing:
    print('MISSING from output:', missing)
if extra:
    print('EXTRA in output:', extra)

# Critical structural files
critical = [
    'xl/styles.xml',
    'xl/media/image1.png',
    'xl/drawings/drawing1.xml',
    'xl/sharedStrings.xml',
    'xl/theme/theme1.xml',
    'xl/worksheets/_rels/sheet1.xml.rels',
    'xl/drawings/_rels/drawing1.xml.rels',
]
for f in critical:
    if f in filled:
        print(f, '— PRESERVED')
    else:
        print(f, '— MISSING!')
"
```
Expected output:
- All critical files show `PRESERVED`
- No `MISSING` entries

- [ ] **Step 4: Verify cell values are correct**

```bash
'/mnt/c/Program Files/nodejs/node.exe' -e "
const ExcelJS = require('exceljs');
const fs = require('fs');

(async () => {
  const buf = fs.readFileSync('/tmp/timesheet-filled.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet(1);

  console.log('A9 (date):', ws.getCell(9, 1).value);
  console.log('B9 (check-in):', ws.getCell(9, 2).value);
  console.log('C9 (check-out):', ws.getCell(9, 3).value);
  console.log('D9 (total):', ws.getCell(9, 4).value);
  console.log('E9 (status):', ws.getCell(9, 5).value);

  // Verify at least one row has data
  const hasData = ws.getCell(9, 5).value === 'P';
  console.log('Row 9 has P status:', hasData);

  // Verify row 40 has a formula
  const totalCell = ws.getCell(40, 5);
  console.log('Row 40 value:', JSON.stringify(totalCell.value));
  const hasFormula = typeof totalCell.value === 'object' && totalCell.value.formula;
  console.log('Row 40 has formula:', hasFormula);

  // Check a day without data (e.g., a weekend row) has been cleared
  let foundCleared = false;
  for (let r = 9; r <= 39; r++) {
    const status = ws.getCell(r, 5).value;
    if (status === null || status === undefined) {
      const date = ws.getCell(r, 1).value;
      if (date) {
        foundCleared = true;
        console.log('Cleared row:', r, 'date:', date);
        break;
      }
    }
  }

  if (!hasData || !hasFormula) process.exit(1);
  console.log('ALL CHECKS PASSED');
})();
"
```
Expected: `ALL CHECKS PASSED`

- [ ] **Step 5: Stop the server**

```bash
kill %1 2>/dev/null || true
```
