# S Status → "Sakit" Auto-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-fill "Sakit" in column K for DigiHC PDF rows with status "S" (Sakit/sick).

**Architecture:** Add 'S' to parser status regex → filler writes "Sakit" to column K for S rows → frontend shows read-only "Sakit" label and auto-sends it on download.

**Tech Stack:** Node.js, Express, ExcelJS, pdf-parse v2

**Testing:** Manual only — start server (`npm start`), upload `sample-digihc.pdf` + `sample-timesheet.xlsx`, verify preview and download. Note: `sample-digihc.pdf` has no 'S' rows, so manual verification checks code correctness, not end-to-end with real 'S' data.

---

### Task 1: Add 'S' to parser status regex

**Files:**
- Modify: `lib/parser.js:100`

- [ ] **Step 1: Edit the status regex**

```js
const statusMatch = line.match(/ (H|LIB|TK|S)(\t|$)/);
```

- [ ] **Step 2: Verify — parse sample PDF to confirm no regression**

```bash
node -e "
const { parsePdf } = require('./lib/parser');
const fs = require('fs');
parsePdf(fs.readFileSync('sample-digihc.pdf')).then(r => {
  console.log('Records:', r.records.length);
  const statuses = [...new Set(r.records.map(x => x.status))];
  console.log('Statuses:', statuses); // Should be ['LIB','H','TK'] (no 'S' in sample)
});
"
```

---

### Task 2: Handle 'S' rows in filler

**Files:**
- Modify: `lib/filler.js:143-147`

- [ ] **Step 1: Replace the else branch in fillTimesheet**

Replace the existing `else` block (currently clearing B–K for non-hasData rows):

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

Previously: `for (let c = 2; c <= 11; c++)` — cleared K too. Now: clear B–J only (2–10). For 'S' rows, set K to 'Sakit'. For LIB/TK, clear K.

- [ ] **Step 2: No change needed for white fill** — the existing white fill loop at line 152-183 already covers all rows except LIB (which get gray). 'S' rows fall into the white fill path.

- [ ] **Step 3: Verify — run server and convert sample**

Start server: `npm start`
Then POST to `/convert` with `sample-digihc.pdf` + `sample-timesheet.xlsx` — the download should still work (no 'S' rows in sample, so output identical to before).

---

### Task 3: Update frontend to show and send 'Sakit'

**Files:**
- Modify: `public/index.html:126, 142, 153-161, 181-189`

- [ ] **Step 1: Add 'S' to statusLabels (line 126)**

```js
const statusLabels = { H: 'Hadir', LIB: 'Libur', TK: 'Tanpa Keterangan', S: 'Sakit' };
```

- [ ] **Step 2: Add CSS class for S status**

Add after line 32 (existing `.status-TK` rule):

```css
.status-S { color: #d32f2f; font-weight: 600; }
```

- [ ] **Step 3: Handle 'S' in renderTable — show read-only "Sakit" label**

In the `else` branch at line 153, add a case for 'S' before TK:

```js
} else if (row.status === 'S') {
  tdAct.textContent = 'Sakit';
} else if (row.status === 'LIB' && row.activity) {
```

Full updated else branch becomes:

```js
} else {
  if (row.status === 'S') {
    tdAct.textContent = 'Sakit';
  } else if (row.status === 'LIB' && row.activity) {
    tdAct.textContent = row.activity;
  } else if (row.status === 'TK') {
    tdAct.textContent = 'Tanpa Keterangan';
  } else {
    tdAct.textContent = '\u2014';
  }
}
```

- [ ] **Step 4: Auto-send 'Sakit' in download handler**

After the existing `.querySelectorAll('.activity-input')` loop (line 182-189), add a loop for 'S' rows:

```js
document.querySelectorAll('.activity-input').forEach(input => {
  if (input.value.trim()) {
    activities.push({
      serial: parseInt(input.dataset.serial),
      activity: input.value.trim()
    });
  }
});

// Auto-append 'Sakit' for every S-status row
previewData.rows.forEach(row => {
  if (row.status === 'S') {
    activities.push({ serial: row.serial, activity: 'Sakit' });
  }
});
```

- [ ] **Step 5: Verify — start server, open browser**

Run `npm start`, open `http://localhost:3000`, upload sample files. Preview table should show no 'S' rows (sample doesn't have them). Existing H/LIB/TK rows should display unchanged. Download should produce a valid XLSX.

---

### Task 4: Manual verification checklist

- [ ] Start server: `npm start`
- [ ] Open `http://localhost:3000`, upload `sample-digihc.pdf` + `sample-timesheet.xlsx`
- [ ] Preview shows 31 rows with correct statuses (H=Hadir, LIB=Libur, TK=Tanpa Keterangan)
- [ ] LIB rows show holiday activities in column K
- [ ] TK rows show "Tanpa Keterangan" in column K
- [ ] H rows have editable activity inputs
- [ ] Download produces a valid `.xlsx` file
- [ ] No regressions compared to current behavior
