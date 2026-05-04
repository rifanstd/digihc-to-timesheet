# Timesheet Form & Filler Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-row fields (Project Name, Project ID, Aplikasi Terdampak, AIP Fitur), signature/approval fill, remove deprecated metadata pre-fill and column R.

**Architecture:** Three-file change — `public/index.html` (form UI + data collection), `lib/filler.js` (Excel writing), `server.js` (new field parsing). Frontend extends the activity table with 4 new columns and adds two metadata inputs. Backend deletes column R, fills columns L-O per H row, writes signature cells, and stops writing unit/miiId headers.

**Tech Stack:** Express, multer, ExcelJS, vanilla JS/DOM

**Note:** No build, test, or lint commands exist. Verification is manual via `npm start` and uploading `sample-digihc.pdf` + `sample-timesheet-final.xlsx`.

---

## File Map

| File | Role |
|------|------|
| `public/index.html` | UI: per-row input columns, metadata inputs, data collection |
| `lib/filler.js` | Excel fill: delete col R, fill L-O, signatures, skip unit/miiId |
| `server.js` | Route: accept new fields in `/convert` |

No new files created.

---

### Task 1: Add per-row input columns to activity table

**Files:**
- Modify: `public/index.html` (HTML header row, `renderTable()`, download handler, CSS)

- [ ] **Step 1: Add 4 column headers to `<thead>`**

After the "Aktivitas" `<th>`, add:

```html
<th>Project Name</th>
<th>Project ID</th>
<th>Aplikasi Terdampak</th>
<th>AIP Fitur</th>
```

In `public/index.html`, find the `<thead>` block (around line 199):

```html
<th>Aktivitas</th>
```

Replace with:

```html
<th>Aktivitas</th>
<th>Project Name</th>
<th>Project ID</th>
<th>Aplikasi Terdampak</th>
<th>AIP Fitur</th>
```

- [ ] **Step 2: Add input fields in `renderTable()` for H-status rows**

In `renderTable()`, after the Activity `<td>` block (the `if (row.status === "H")` block for the activity input), add 4 new `<td>` elements. For H rows, create `<input>` fields; for non-H rows, show `—`.

Insert after the closing `tdAct.appendChild(input);` and after the `} else { ... }` block for non-H rows, before `tr.appendChild(tdAct);`:

```js
          // Project Name
          const tdProjName = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.dataset.serial = row.serial;
            input.dataset.field = "projectName";
            input.placeholder = "Project Name...";
            tdProjName.appendChild(input);
          } else {
            tdProjName.textContent = "\u2014";
          }

          // Project ID
          const tdProjId = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.dataset.serial = row.serial;
            input.dataset.field = "projectId";
            input.placeholder = "Project ID...";
            tdProjId.appendChild(input);
          } else {
            tdProjId.textContent = "\u2014";
          }

          // Aplikasi Terdampak
          const tdAffected = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.dataset.serial = row.serial;
            input.dataset.field = "affectedApp";
            input.placeholder = "Aplikasi Terdampak...";
            tdAffected.appendChild(input);
          } else {
            tdAffected.textContent = "\u2014";
          }

          // AIP Fitur
          const tdAip = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.dataset.serial = row.serial;
            input.dataset.field = "aipFeature";
            input.placeholder = "AIP Fitur...";
            tdAip.appendChild(input);
          } else {
            tdAip.textContent = "\u2014";
          }
```

Then append all new `<td>` elements to the row (after the existing appends):

```js
          tr.appendChild(tdDate);
          tr.appendChild(tdIn);
          tr.appendChild(tdOut);
          tr.appendChild(tdStatus);
          tr.appendChild(tdAct);
          tr.appendChild(tdProjName);
          tr.appendChild(tdProjId);
          tr.appendChild(tdAffected);
          tr.appendChild(tdAip);
```

- [ ] **Step 3: Update download handler to collect new per-row fields**

In the download button click handler, modify the `activities` collection loop. Currently it collects only `activity` inputs (`.activity-input`). Replace the loop that builds the `activities` array (currently iterating `.activity-input`):

```js
        const activities = [];
        document.querySelectorAll(".activity-input").forEach((input) => {
          if (input.value.trim()) {
            activities.push({
              serial: parseInt(input.dataset.serial),
              activity: input.value.trim(),
            });
          }
        });
```

Replace with a Map-based approach that merges fields per serial:

```js
        const activitiesMap = new Map();
        document.querySelectorAll(".activity-input").forEach((input) => {
          const serial = parseInt(input.dataset.serial);
          if (!activitiesMap.has(serial)) {
            activitiesMap.set(serial, { serial });
          }
          const entry = activitiesMap.get(serial);
          const field = input.dataset.field || "activity";
          if (input.value.trim()) {
            entry[field] = input.value.trim();
          }
        });
```

Still append 'Sakit' for S-status rows:

```js
        previewData.rows.forEach((row) => {
          if (row.status === "S") {
            if (!activitiesMap.has(row.serial)) {
              activitiesMap.set(row.serial, { serial: row.serial });
            }
            activitiesMap.get(row.serial).activity = "Sakit";
          }
        });
```

Convert Map to array:

```js
        const activities = Array.from(activitiesMap.values()).filter(
          (a) => a.activity || a.projectName || a.projectId || a.affectedApp || a.aipFeature
        );
```

- [ ] **Step 4: Add responsive CSS for new columns**

In the `<style>` block, update the media query to also hide new columns on mobile. Replace the existing media query:

```css
@media (max-width: 600px) {
  th:nth-child(2),
  td:nth-child(2),
  th:nth-child(3),
  td:nth-child(3) {
    display: none;
  }
}
```

With:

```css
@media (max-width: 600px) {
  th:nth-child(2), td:nth-child(2),
  th:nth-child(3), td:nth-child(3),
  th:nth-child(6), td:nth-child(6),
  th:nth-child(7), td:nth-child(7),
  th:nth-child(8), td:nth-child(8),
  th:nth-child(9), td:nth-child(9) {
    display: none;
  }
}
```

- [ ] **Step 5: Verify — Start server and test UI**

```bash
npm start
```

Open `http://localhost:3000`, select `sample-digihc.pdf` and `sample-timesheet-final.xlsx`, click Preview. Confirm:
- Activity table shows 6+4 = 9 columns total
- New "Project Name", "Project ID", "Aplikasi Terdampak", "AIP Fitur" headers visible
- Input fields appear on Hadir rows, `—` on non-H rows

---

### Task 2: Update metadata form — remove pre-fill, add manager/dept head inputs

**Files:**
- Modify: `public/index.html` (metadata form HTML, `renderTable()`, download handler)

- [ ] **Step 1: Remove PDF pre-fill for unit and MII ID**

In `renderTable()`, remove the lines that populate unit and MII ID from metadata:

Currently (around line 272-274):
```js
        document.getElementById('inputUnit').value = data.metadata?.unit || '';
        document.getElementById('inputName').value = data.metadata?.name || '';
        document.getElementById('inputMiiId').value = data.metadata?.miiId || '';
```

Change to:
```js
        document.getElementById('inputName').value = data.metadata?.name || '';
```

(The unit and miiId lines are removed — fields stay but remain empty.)

Keep the unit and MII ID inputs in the HTML form (they still exist, just not pre-filled).

- [ ] **Step 2: Add Manager Name and Department Head Name inputs to the form**

After the MII ID input in the `#metadataForm` div, add two new rows:

```html
        <label for="inputMiiId">MII ID</label>
        <input type="text" id="inputMiiId" />
```

After that `</input>`, add:

```html

        <label for="inputManagerName">Nama Manager (Diperiksa Oleh)</label>
        <input type="text" id="inputManagerName" />

        <label for="inputDeptHeadName">Nama Kepala Departemen (Disetujui Oleh)</label>
        <input type="text" id="inputDeptHeadName" />
```

- [ ] **Step 3: Send new fields in download handler**

In the download button click handler, update `headerFields` to include the new fields:

```js
        const headerFields = {
          projectName: document.getElementById('inputProjectName').value.trim(),
          site: document.getElementById('inputSite').value.trim(),
          unit: document.getElementById('inputUnit').value.trim(),
          name: document.getElementById('inputName').value.trim(),
          miiId: document.getElementById('inputMiiId').value.trim(),
          managerName: document.getElementById('inputManagerName').value.trim(),
          deptHeadName: document.getElementById('inputDeptHeadName').value.trim()
        };
```

- [ ] **Step 4: Verify — Start server and test**

```bash
npm start
```

Upload files, click Preview. Confirm:
- Unit and MII ID fields are empty (not pre-filled from PDF)
- Nama is still pre-filled from PDF
- Manager Name and Dept Head Name inputs appear below MII ID

---

### Task 3: Backend — delete column R in filler

**Files:**
- Modify: `lib/filler.js` (line 74-76: after workbook load, before header fill; line 187: LAST_COL)

- [ ] **Step 1: Add column deletion after workbook load**

In `fillTimesheet()`, after `const ws = wb.getWorksheet(1);` (line 76), add:

```js
  ws.spliceColumns(18, 1);
```

This deletes column R entirely. All subsequent references to column indices ≥ 18 are no longer valid.

- [ ] **Step 2: Update LAST_COL constant**

Change line 187 from:

```js
  const LAST_COL = 18;
```

To:

```js
  const LAST_COL = 17;
```

- [ ] **Step 3: Verify — Run server and test download**

```bash
npm start
```

Upload `sample-digihc.pdf` + `sample-timesheet-final.xlsx`, fill in some activities, click Download. Open the downloaded XLSX and confirm:
- Column R ("Sub Departement") is gone
- Column Q (Departement) is now the rightmost column that gets the white fill
- No errors in server log

---

### Task 4: Backend — fill signature cells, remove unit/miiId from header fill

**Files:**
- Modify: `lib/filler.js` (header fill section ~lines 78-94, and new signature code)

- [ ] **Step 1: Remove unit (row 2) and MII ID (row 4) from header fill**

Replace the `HEADER_ROWS` object and the header fill loop. Current code (lines 78-94):

```js
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
```

Replace with:

```js
  if (headerFields) {
    const HEADER_ROWS = {
      projectName: 1,
      name: 3,
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
```

- [ ] **Step 2: Add signature/approval cell fill**

After the header fill loop (after the closing `}` of the `if (headerFields)` block, before `const layout = detectLayout(ws);`), add:

```js
    if (headerFields.name) {
      ws.getCell(42, 1).value = '( ' + headerFields.name + ' )';
    }
    if (headerFields.managerName) {
      ws.getCell(42, 4).value = '( ' + headerFields.managerName + ' )';
    }
    if (headerFields.deptHeadName) {
      ws.getCell(42, 7).value = '( ' + headerFields.deptHeadName + ' )';
    }
```

- [ ] **Step 3: Verify — Test signatures**

```bash
npm start
```

Upload files, fill in name, manager name, and dept head name. Download. Open XLSX:
- Scroll to row 42 — A42 should show `( Nama )`, D42 `( Manager )`, G42 `( Dept Head )`
- Rows 2 and 4 (UNIT/DIVISION and MII ID) should NOT have values filled

---

### Task 5: Backend — accept new fields in /convert endpoint + update filler reader

**Files:**
- Modify: `server.js` (headerFields parsing ~lines 103-121, activities parsing ~lines 88-101)
- Modify: `lib/filler.js` (activity writing block ~lines 161-171)

- [ ] **Step 1: Accept managerName and deptHeadName in headerFields**

In `server.js`, update the `headerFields` default and parsing block. Current code (lines 103-121):

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

Replace with:

```js
    let headerFields = {
      projectName: 'PT Bank Negara Indonesia (Persero) Tbk',
      site: 'BNI',
      unit: '',
      name: '',
      miiId: '',
      managerName: '',
      deptHeadName: ''
    };
    if (req.body.headerFields) {
      try {
        const parsed = JSON.parse(req.body.headerFields);
        if (parsed.projectName) headerFields.projectName = parsed.projectName;
        if (parsed.site) headerFields.site = parsed.site;
        if (parsed.unit) headerFields.unit = parsed.unit;
        if (parsed.name) headerFields.name = parsed.name;
        if (parsed.miiId) headerFields.miiId = parsed.miiId;
        if (parsed.managerName) headerFields.managerName = parsed.managerName;
        if (parsed.deptHeadName) headerFields.deptHeadName = parsed.deptHeadName;
      } catch {
        return res.status(400).json({ error: 'Format data header tidak valid' });
      }
    }
```

- [ ] **Step 2: Accept per-row fields in activities**

Update the activities parsing to include the new fields. Current code (lines 88-101):

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

Replace with:

```js
    let activitiesMap = null;
    if (req.body.activities) {
      try {
        const activities = JSON.parse(req.body.activities);
        activitiesMap = new Map();
        for (const a of activities) {
          if (a.serial != null) {
            activitiesMap.set(a.serial, {
              activity: a.activity || null,
              projectName: a.projectName || null,
              projectId: a.projectId || null,
              affectedApp: a.affectedApp || null,
              aipFeature: a.aipFeature || null
            });
          }
        }
      } catch {
        return res.status(400).json({ error: 'Format data aktivitas tidak valid' });
      }
    }
```

**Important:** Step 2 changes `activitiesMap` value type from `string` to `object`. The existing filler code at lines 161-170 does `activityCell.value = activitiesMap.get(rowSerial)` which expects a string. Step 3 fixes this.

- [ ] **Step 3: Update filler to read object from activitiesMap + fill L-O**

In `lib/filler.js`, replace the entire activity-writing block (lines 161-171) with a merged version that reads `ext.activity` for column K and also writes the 4 new per-row fields to columns L-O:

```js
      if (activitiesMap && activitiesMap.has(rowSerial)) {
        const ext = activitiesMap.get(rowSerial);
        if (ext.activity) {
          const activityCell = ws.getCell(row, 11);
          activityCell.value = ext.activity;
          const existingFont = activityCell.font || {};
          activityCell.font = { ...existingFont, bold: true };
        }
        if (ext.projectName) ws.getCell(row, 12).value = ext.projectName;
        if (ext.projectId) ws.getCell(row, 13).value = ext.projectId;
        if (ext.affectedApp) ws.getCell(row, 14).value = ext.affectedApp;
        if (ext.aipFeature) ws.getCell(row, 15).value = ext.aipFeature;
      } else {
        const remarkCell = ws.getCell(row, 11);
        if (!remarkCell.value || remarkCell.value === '') {
          remarkCell.value = null;
        }
      }
```

- [ ] **Step 4: Verify full flow end-to-end**

```bash
npm start
```

1. Upload `sample-digihc.pdf` + `sample-timesheet-final.xlsx`
2. Click Preview
3. Fill in some activity text, project name, project ID, aplikasi terdampak, AIP fitur for a few H days
4. Fill in Name, Manager Name, Dept Head Name
5. Click Download
6. Open XLSX — verify:
   - Column R is gone
   - Columns L-O have entered values on H rows
   - Row 42 has `( Name )`, `( Manager )`, `( Dept Head )`
   - UNIT/DIVISION (row 2) and MII ID (row 4) are empty
   - Activities appear in column K with bold font
   - PDF month mismatch error still works
   - COUNTIF formula in total row still works
```

---

## Self-Review

1. **Spec coverage:** Every spec requirement maps to a task:
   - Per-row columns L-O → Task 1 (UI) + Task 5 Step 3 (filler write)
   - Remove PDF pre-fill for unit/miiId → Task 2 Step 1
   - Add manager/dept head inputs → Task 2 Step 2-3
   - Delete column R → Task 3
   - Fill L-O per H row → Task 5 Step 3
   - Signature fill → Task 4 Step 2
   - Remove unit/miiId from header fill → Task 4 Step 1
   - Accept new fields in /convert → Task 5 Steps 1-2

2. **Placeholder scan:** No TBDs, TODOs, or vague steps. Every step has concrete code.

3. **Type consistency:** `activitiesMap` value type changes from `string` to `{activity, projectName, projectId, affectedApp, aipFeature}`. This is consistent across server.js parsing (Task 5 Step 2) and filler.js reading (Task 5 Step 3).

4. **Column deletion ordering:** `spliceColumns(18, 1)` in Task 3 Step 1 runs before any column-indexed writes. Since the filler writes to columns 1-17 (all < 18), no index adjustment is needed for existing column writes.
