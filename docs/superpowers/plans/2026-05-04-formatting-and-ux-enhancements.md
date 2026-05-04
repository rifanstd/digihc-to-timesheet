# Formatting and UX Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add font/wrapText/auto-height formatting controls, file rename, signature date, and remove MII ID pre-fill.

**Architecture:** Extract formatting into a dedicated `applyFormatting()` function in filler.js. Add two new inputs to preview.html (filename, signature date) and pass signatureDate through server.js.

**Tech Stack:** Express, ExcelJS, vanilla JS

---

### Task 1: Remove MII ID auto-fill from preview.html

**Files:**
- Modify: `public/preview.html`

- [ ] **Step 1: Delete the MII ID pre-fill line**

Find and delete this line in `renderTable()` (currently line 393):

```js
document.getElementById('inputMiiId').value = data.metadata?.miiId || '';
```

Keep the MII ID input in the HTML form — only remove the auto-population.

- [ ] **Step 2: Verify manual**

Start the server (`npm start`), upload sample files, navigate to preview page. Confirm the MII ID input is empty.

- [ ] **Step 3: Commit**

```bash
git add public/preview.html
git commit -m "fix: remove MII ID auto-fill from preview form"
```

---

### Task 2: Add filename input to preview.html

**Files:**
- Modify: `public/preview.html`

- [ ] **Step 1: Add filename input HTML**

Insert above the Download button (before `<button id="downloadBtn">`):

```html
<label for="inputFilename">Nama File</label>
<input type="text" id="inputFilename" />
```

- [ ] **Step 2: Add CSS for the new input**

Add after the `#divDepRow input:focus` block:

```css
#inputFilename {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0 12px;
  height: 40px;
  color: var(--text);
  font-size: 0.85rem;
  width: 100%;
  margin-bottom: 16px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

#inputFilename:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
}

#inputFilename::placeholder {
  color: var(--text-hint);
}
```

- [ ] **Step 3: Populate default filename in renderTable()**

Insert at the end of `renderTable()`, after all the `document.getElementById(...).value` assignments:

```js
const nameVal = document.getElementById('inputName').value.trim();
const mo = data.month.month;
const year = data.month.year;
const indoMonths = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];
if (nameVal) {
  document.getElementById('inputFilename').value = nameVal + '-' + indoMonths[mo] + '-' + year + '-Timesheet.xlsx';
} else {
  document.getElementById('inputFilename').value = 'timesheet-filled.xlsx';
}
```

- [ ] **Step 4: Update download handler to use custom filename**

In the download click handler, replace:

```js
a.download = "timesheet-filled.xlsx";
```

with:

```js
const filename = document.getElementById('inputFilename').value.trim() || 'timesheet-filled.xlsx';
a.download = filename;
```

- [ ] **Step 5: Verify manual**

Start server, upload sample files, check preview page:
- Filename input is visible above Download button
- Pre-populated with correct format (e.g. `Rifan Setiadi-Maret-2026-Timesheet.xlsx` if name is filled)
- Falls back to `timesheet-filled.xlsx` if name is empty
- Downloaded file uses the custom name

- [ ] **Step 6: Commit**

```bash
git add public/preview.html
git commit -m "feat: add file rename input before download"
```

---

### Task 3: Add signature date picker to preview.html

**Files:**
- Modify: `public/preview.html`

- [ ] **Step 1: Add signature date input HTML**

Insert between the filename input and the Download button:

```html
<label for="inputSignDate">Tanggal Penandatanganan</label>
<input type="date" id="inputSignDate" />
```

- [ ] **Step 2: Add CSS for the date input**

Add after the `#inputFilename:focus` block:

```css
#inputSignDate {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0 12px;
  height: 40px;
  color: var(--text);
  font-size: 0.85rem;
  width: 100%;
  margin-bottom: 16px;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

#inputSignDate:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
}

#inputSignDate::placeholder {
  color: var(--text-hint);
}
```

- [ ] **Step 3: Update download handler to send signature date**

In the download click handler, before the `fetch` call, add:

```js
const signDateEl = document.getElementById('inputSignDate');
if (signDateEl && signDateEl.value) {
  const [y, m, d] = signDateEl.value.split('-');
  const indoMonths = ['Januari','Februari','Maret','April','Mei','Juni',
                      'Juli','Agustus','September','Oktober','November','Desember'];
  const indoDate = parseInt(d, 10) + ' ' + indoMonths[parseInt(m, 10) - 1] + ' ' + y;
  data.append('signatureDate', indoDate);
}
```

- [ ] **Step 4: Verify manual**

Start server, upload sample files. Verify:
- Date picker is visible above Download button
- Selecting a date and downloading sends the value

- [ ] **Step 5: Commit**

```bash
git add public/preview.html
git commit -m "feat: add signature date picker to preview page"
```

---

### Task 4: Pass signatureDate through server.js

**Files:**
- Modify: `server.js:181`

- [ ] **Step 1: Extract signatureDate from request body**

In the `/convert/:id` route, after the `rowFields` parsing block (before `fillTimesheet` call), add:

```js
const signatureDate = req.body.signatureDate || '';
```

- [ ] **Step 2: Pass signatureDate to fillTimesheet**

Change the `fillTimesheet` call from:

```js
const outputBuffer = await fillTimesheet(session.templateBuffer, session.records, activitiesMap, headerFields, rowFields);
```

to:

```js
const outputBuffer = await fillTimesheet(session.templateBuffer, session.records, activitiesMap, headerFields, rowFields, signatureDate);
```

- [ ] **Step 3: Verify no crash**

Start server, upload files, download without selecting a signature date. Should still work (empty string passed). Then select a date and download — should still work (even though filler.js hasn't been updated yet to use it).

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: pass signatureDate from request to fillTimesheet"
```

---

### Task 5: Extract applyFormatting in filler.js

**Files:**
- Modify: `lib/filler.js`

- [ ] **Step 1: Update fillTimesheet function signature**

Change the function signature from:

```js
async function fillTimesheet(templateBuffer, records, activitiesMap, headerFields = {}, rowFields = {}) {
```

to:

```js
async function fillTimesheet(templateBuffer, records, activitiesMap, headerFields = {}, rowFields = {}, signatureDate = '') {
```

- [ ] **Step 2: Remove the old inline formatting loop**

Delete lines 240-247 (the loop that applies `size: 9` and `wrapText: true`):

```js
  for (let r = 1; r <= layout.formulaRow; r++) {
    for (let c = 1; c <= LAST_COL; c++) {
      const cell = ws.getCell(r, c);
      const existingFont = cell.font || {};
      cell.font = { ...existingFont, size: 9 };
      const existingAlign = cell.alignment || {};
      cell.alignment = { ...existingAlign, wrapText: true };
    }
  }
```

- [ ] **Step 3: Add applyFormatting call**

In `fillTimesheet`, after the white/gray fill loop (after `for (let r = layout.dataStart; r <= layout.dataEnd; r++) { ... }` for fills), and before the COUNTIF formula write, add:

```js
applyFormatting(ws, layout, recordMap, signatureDate);
```

- [ ] **Step 4: Write the applyFormatting function**

Add this function before `module.exports` at the bottom of the file (after `fillTimesheet` completes):

```js
function applyFormatting(ws, layout, recordMap, signatureDate) {
  const LAST_COL = 17;

  for (let r = 1; r < layout.dataStart; r++) {
    for (let c = 1; c <= LAST_COL; c++) {
      const cell = ws.getCell(r, c);
      const existingFont = cell.font || {};
      cell.font = { ...existingFont, name: 'Calibri', size: 9 };
    }
  }

  for (let r = layout.dataStart; r <= layout.formulaRow; r++) {
    for (let c = 1; c <= LAST_COL; c++) {
      const cell = ws.getCell(r, c);
      const existingFont = cell.font || {};
      cell.font = { ...existingFont, name: 'Calibri', size: 9 };
      const existingAlign = cell.alignment || {};
      cell.alignment = { ...existingAlign, wrapText: true };
    }
  }

  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    const row = ws.getRow(r);
    row.height = undefined;
  }

  if (signatureDate) {
    for (let r = 1; r <= 50; r++) {
      const cellA = ws.getCell(r, 1);
      const val = cellA.value;
      if (val && typeof val === 'string' && val.toUpperCase().includes('DATE')) {
        const cellC = ws.getCell(r, 3);
        cellC.value = 'DATE: ' + signatureDate;
        const existingFont = cellC.font || {};
        cellC.font = { ...existingFont, name: 'Calibri', size: 9, bold: true };
        break;
      }
    }
  }
}
```

- [ ] **Step 5: Verify manual**

Start server, upload `sample-digihc.pdf` and `sample-timesheet.xlsx`, fill in name "Rifan Setiadi", select a signature date (e.g. 2026-01-02), download. Open the Excel file and verify:
- All cells use Calibri font
- Header rows (1-6) do NOT have text wrapping
- Data rows (7/8+) have text wrapping
- Data rows auto-adjust height
- The row with "DATE" in column A now shows "DATE: 2 Januari 2026" in column C, bold

- [ ] **Step 6: Commit**

```bash
git add lib/filler.js
git commit -m "feat: extract applyFormatting with Calibri font, selective wrapText, auto-height, signature date"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full flow test**

```bash
npm start
```

1. Open http://localhost:3000
2. Upload `sample-digihc.pdf` and `sample-timesheet.xlsx`
3. On preview page:
   - MII ID field is empty
   - Fill in name "Rifan Setiadi" — filename should auto-populate with "Rifan Setiadi-Maret-2026-Timesheet.xlsx"
   - Select a signature date (e.g. 2026-03-15)
   - Click Download
4. Open downloaded Excel:
   - Font is Calibri throughout
   - Header rows have no text wrapping
   - Data rows have text wrapping
   - Row heights auto-fit content
   - "DATE:" cell shows "DATE: 15 Maret 2026" in bold
   - Downloaded filename matches input

- [ ] **Step 2: Edge case — no signature date**

Repeat flow without selecting a signature date. The DATE cell in Excel should remain unchanged from the template.

- [ ] **Step 3: Edge case — no name**

Repeat flow without filling in name. Filename should default to `timesheet-filled.xlsx`.

- [ ] **Step 4: Edge case — custom filename**

Type a custom filename like "test.xlsx" in the filename input. Downloaded file should be named `test.xlsx`.

- [ ] **Step 5: Commit if any fixes were needed**

Only commit if the verification step revealed bugs that required code changes.
