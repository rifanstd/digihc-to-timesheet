# Preview UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the preview page UI with distinct input colors, centered `---` placeholders, and mandatory metadata validation.

**Architecture:** Three independent CSS/JS changes to `public/preview.html` — no backend or library-file modifications. All changes are visual (CSS colors, text alignment) or form validation (JS guard before POST).

**Tech Stack:** Vanilla HTML/CSS/JS, no dependencies.

**Verification:** `npm start`, open http://localhost:3000, upload sample PDF + template, inspect preview page manually.

---

### Task 1: CSS — New input background color and `.invalid` class

**Files:**
- Modify: `public/preview.html` (CSS section)

- [ ] **Step 1: Add `--input-bg` to `:root`**

At line 14 (after `--btn-primary-active: #1158c7;`), add the new variable:

```css
--input-bg: #1c2128;
```

Insert after line 19:
```
    --btn-primary-active: #1158c7;
    --input-bg: #1c2128;
    --btn-primary-text: #ffffff;
```

- [ ] **Step 2: Update `.activity-input` background**

Change line 274-275 from:
```css
  .activity-input {
    width: 100%;
    background: var(--surface);
```
to:
```css
  .activity-input {
    width: 100%;
    background: var(--input-bg);
```

- [ ] **Step 3: Add `.invalid` CSS class**

After the `.activity-input:focus` block (around line 289), add:
```css
  .invalid {
    border-color: var(--error) !important;
    box-shadow: 0 0 0 2px rgba(248, 81, 73, 0.3) !important;
  }
```

- [ ] **Step 4: Commit**

```bash
git add public/preview.html
git commit -m "feat: add input-bg variable and invalid class CSS"
```

---

### Task 2: JS renderTable() — Replace `\u2014` with `"---"` and center-align placeholders

**Files:**
- Modify: `public/preview.html` (JS `renderTable()` function)

- [ ] **Step 1: Replace em dash placeholders and center-align them**

In `renderTable()`, change every `\u2014` to `"---"` and add `style.textAlign = "center"` on placeholder cells. The affected lines are:

**Line 478** — Check-in cell:
```js
// Before:
tdIn.textContent = row.checkIn ? row.checkIn.substring(0, 5) : "\u2014";
// After:
if (row.checkIn) {
  tdIn.textContent = row.checkIn.substring(0, 5);
} else {
  tdIn.textContent = "---";
  tdIn.style.textAlign = "center";
}
```

**Line 482** — Check-out cell:
```js
// Before:
tdOut.textContent = row.checkOut ? row.checkOut.substring(0, 5) : "\u2014";
// After:
if (row.checkOut) {
  tdOut.textContent = row.checkOut.substring(0, 5);
} else {
  tdOut.textContent = "---";
  tdOut.style.textAlign = "center";
}
```

**Line 485** — Status cell:
```js
// Before:
tdStatus.textContent = statusLabels[row.status] || "\u2014";
// After:
if (statusLabels[row.status]) {
  tdStatus.textContent = statusLabels[row.status];
} else {
  tdStatus.textContent = "---";
  tdStatus.style.textAlign = "center";
}
```

**Lines 497-504** — Aktivitas cell (non-H branches):
```js
// Before:
if (row.status === "S") {
  tdAct.textContent = "Sakit";
} else if (row.status === "LIB" && row.activity) {
  tdAct.textContent = row.activity;
} else if (row.status === "TK") {
  tdAct.textContent = "Tanpa Keterangan";
} else {
  tdAct.textContent = "\u2014";
}
// After:
if (row.status === "S") {
  tdAct.textContent = "Sakit";
} else if (row.status === "LIB" && row.activity) {
  tdAct.textContent = row.activity;
} else if (row.status === "TK") {
  tdAct.textContent = "Tanpa Keterangan";
} else {
  tdAct.textContent = "---";
  tdAct.style.textAlign = "center";
}
```

**Line 516** — Project Name placeholder:
```js
// Before:
tdProjName.textContent = "\u2014";
// After:
tdProjName.textContent = "---";
tdProjName.style.textAlign = "center";
```

**Line 529** — Project ID placeholder:
```js
// Before:
tdProjId.textContent = "\u2014";
// After:
tdProjId.textContent = "---";
tdProjId.style.textAlign = "center";
```

**Line 541** — Aplikasi Terdampak placeholder:
```js
// Before:
tdAffected.textContent = "\u2014";
// After:
tdAffected.textContent = "---";
tdAffected.style.textAlign = "center";
```

**Line 553** — AIP Fitur placeholder:
```js
// Before:
tdAip.textContent = "\u2014";
// After:
tdAip.textContent = "---";
tdAip.style.textAlign = "center";
```

- [ ] **Step 2: Commit**

```bash
git add public/preview.html
git commit -m "feat: replace em dash with centered --- in preview table"
```

---

### Task 3: JS download handler — Mandatory field validation

**Files:**
- Modify: `public/preview.html` (JS download button click handler)

- [ ] **Step 1: Add validation at the top of the download click handler**

In the `downloadBtn.addEventListener("click", async () => {` block (line 568), insert the validation block before `const activitiesMap = new Map();` (current line 569):

```js
        const requiredFields = [
          { id: 'inputProjectName', label: 'Project Name' },
          { id: 'inputUnit', label: 'Unit / Divisi' },
          { id: 'inputSite', label: 'SITE' },
          { id: 'inputName', label: 'Nama' },
          { id: 'inputMiiId', label: 'MII ID' },
          { id: 'inputManagerName', label: 'Nama Manager' },
          { id: 'inputDeptHeadName', label: 'Nama Kepala Departemen' },
          { id: 'inputDivisi', label: 'Divisi' },
          { id: 'inputDepartement', label: 'Departement' },
          { id: 'inputSignDate', label: 'Tanggal Penandatanganan' }
        ];

        let hasEmpty = false;
        for (const field of requiredFields) {
          const el = document.getElementById(field.id);
          if (el && !el.value.trim()) {
            el.classList.add('invalid');
            hasEmpty = true;
          } else if (el) {
            el.classList.remove('invalid');
          }
        }

        if (hasEmpty) {
          setStatus("Harap isi semua field yang wajib.", "error");
          return;
        }
```

This goes immediately after `downloadBtn.addEventListener("click", async () => {` and before `const activitiesMap = new Map();`.

- [ ] **Step 2: Commit**

```bash
git add public/preview.html
git commit -m "feat: add mandatory field validation before download"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start the server**

```bash
npm start
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000 and:
1. Upload `sample-digihc.pdf` and `sample-timesheet.xlsx`
2. Click "Preview Data"

**Verify input colors**: Open the activity table — input fields should have `#1c2128` background, visibly distinct from row backgrounds on both odd and even rows.

**Verify `---` placeholders**: Non-H days (LIB/TK) should show `---` centered in Check-in, Check-out, Aktivitas, Project Name, Project ID, Aplikasi Terdampak, and AIP Fitur columns.

**Verify mandatory validation**: Leave all metadata fields empty, click "Download Timesheet". All 10 fields should get red borders, and status should show "Harap isi semua field yang wajib." Fill in one field, click again — that field's red border should disappear, others remain.

**Verify download still works**: Fill all 10 fields, click Download — should receive the XLSX file.

- [ ] **Step 3: Stop server**

```bash
# Ctrl+C
```
