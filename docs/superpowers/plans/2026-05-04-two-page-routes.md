# Two-Page Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single-page UI into two separate routes (upload + preview), add in-memory server cache to avoid file re-upload, make activity table full-width, and remove placeholder hints.

**Architecture:** Two HTML files (`index.html` for upload, `preview.html` for editor), in-memory `Map` cache with UUID keys and 15-min TTL, Express routes with real navigation. No changes to parser or filler.

**Tech Stack:** Express, vanilla HTML/CSS/JS, `crypto.randomUUID()`

---

### Task 1: Strip `public/index.html` to upload-only page

**Files:**
- Modify: `public/index.html` — remove editor section, keep only upload form

- [ ] **Step 1: Replace `public/index.html` with upload-only version**

Remove all editor-related HTML (everything after `</div>` closing `#uploadSection`) and keep only the upload form with its CSS. The new file should be:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DigiHC to Timesheet</title>
    <style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --text-secondary: #c9d1d9;
    --text-hint: #8b949e;
    --accent: #58a6ff;
    --btn-primary: #1f6feb;
    --btn-primary-hover: #388bfd;
    --btn-primary-active: #1158c7;
    --btn-primary-text: #ffffff;
    --btn-success: #238636;
    --btn-success-hover: #2ea043;
    --btn-success-active: #196c2e;
    --btn-success-text: #ffffff;
    --btn-disabled-bg: #21262d;
    --btn-disabled-text: #666e79;
    --error: #f85149;
    --info: #d29922;
    --success: #3fb950;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-pill: 24px;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: var(--bg);
    color: var(--text);
    margin: 0;
    padding: 40px 24px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    line-height: 1.4;
  }

  h1 {
    font-size: 1.25rem;
    color: var(--text);
    margin: 0 0 36px;
    font-weight: 600;
    text-align: center;
  }

  #uploadSection {
    max-width: 420px;
    width: 100%;
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 32px 28px;
  }

  #uploadSection > label {
    display: block;
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 6px;
  }

  #uploadSection input[type="file"] {
    display: block;
    width: 100%;
    color: var(--text);
    font-size: 0.85rem;
    margin-bottom: 24px;
  }

  #uploadSection input[type="file"]::file-selector-button {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 8px 14px;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.82rem;
    font-weight: 500;
    margin-right: 12px;
    transition: border-color 150ms ease, color 150ms ease;
  }

  #uploadSection input[type="file"]::file-selector-button:hover {
    border-color: var(--accent);
    color: var(--text);
  }

  #previewBtn {
    display: block;
    width: 100%;
    height: 48px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--btn-primary);
    color: var(--btn-primary-text);
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 150ms ease;
    appearance: none;
  }

  #previewBtn:hover {
    background: var(--btn-primary-hover);
  }

  #previewBtn:active {
    background: var(--btn-primary-active);
  }

  #previewBtn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  #previewBtn:disabled {
    background: var(--btn-disabled-bg);
    color: var(--btn-disabled-text);
    cursor: not-allowed;
    opacity: 1;
  }

  #status {
    margin-top: 14px;
    font-size: 0.85rem;
    color: var(--text);
    min-height: 20px;
    text-align: center;
  }

  #status.error { color: var(--error); }
  #status.success { color: var(--success); }
  #status.info { color: var(--info); }

  @media (max-width: 600px) {
    body { padding: 20px 16px; }
    h1 { font-size: 1.1rem; margin-bottom: 24px; }
    #uploadSection { padding: 24px 18px; }
  }
    </style>
  </head>
  <body>
    <h1>DigiHC Attendance → Timesheet</h1>

    <div id="uploadSection">
      <label for="pdf">DigiHC Attendance PDF</label>
      <input type="file" id="pdf" name="pdf" accept=".pdf" required />

      <label for="template">Timesheet Template (XLSX)</label>
      <input type="file" id="template" name="template" accept=".xlsx" required />

      <button id="previewBtn">Preview Data</button>
      <div id="status"></div>
    </div>

    <script>
      const statusEl = document.getElementById("status");
      const previewBtn = document.getElementById("previewBtn");

      function setStatus(msg, cls) {
        statusEl.textContent = msg;
        statusEl.className = cls || "";
      }

      previewBtn.addEventListener("click", async () => {
        const pdfFile = document.getElementById("pdf").files[0];
        const templateFile = document.getElementById("template").files[0];

        if (!pdfFile || !templateFile) {
          setStatus("Pilih file PDF dan template terlebih dahulu.", "error");
          return;
        }

        setStatus("Memproses...", "info");
        previewBtn.disabled = true;

        try {
          const data = new FormData();
          data.append("pdf", pdfFile);
          data.append("template", templateFile);

          const res = await fetch("/preview", { method: "POST", body: data });

          if (res.redirected) {
            window.location.href = res.url;
            return;
          }

          const err = await res.json();
          setStatus("Error: " + (err.error || "Unknown error"), "error");
        } catch (err) {
          setStatus("Error: " + err.message, "error");
        } finally {
          previewBtn.disabled = false;
        }
      });
    </script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/index.html
git commit -m "refactor: strip index.html to upload-only page"
```

---

### Task 2: Add server cache and new routes

**Files:**
- Modify: `server.js` — add cache, modify POST /preview, add GET /preview/:id, change POST /convert

- [ ] **Step 1: Replace `server.js` with new version**

```js
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { parsePdf, getRecordMonth, serialToIndonesianDate } = require('./lib/parser');
const { fillTimesheet, previewTemplate } = require('./lib/filler');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

const sessions = new Map();
const SESSION_TTL = 15 * 60 * 1000;

function setTimer(id) {
  const session = sessions.get(id);
  if (!session) return;
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    sessions.delete(id);
  }, SESSION_TTL);
}

app.use(express.static(path.join(__dirname, 'public')));

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

    const { records, errors, metadata } = await parsePdf(pdfFile.buffer);

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

    const previewData = {
      month: { month: layout.month, year: layout.year },
      rows,
      metadata,
      defaults: {
        projectName: 'PT Bank Negara Indonesia (Persero) Tbk',
        site: 'BNI'
      }
    };

    const id = crypto.randomUUID();
    sessions.set(id, {
      pdfBuffer: pdfFile.buffer,
      templateBuffer: templateFile.buffer,
      records,
      previewData
    });

    setTimer(id);
    res.redirect('/preview/' + id);
  } catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Terjadi kesalahan internal server' });
  }
});

app.get('/preview/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(410).send('<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>Sesi telah berakhir</h2><p>Silakan <a href="/">unggah ulang</a> file PDF dan template.</p></body></html>');
  }
  setTimer(req.params.id);
  res.sendFile(path.join(__dirname, 'public', 'preview.html'));
});

app.post('/convert/:id', upload.none(), async (req, res) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(410).json({ error: 'Sesi telah berakhir, silakan unggah ulang.' });
    }

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

    let rowFields = {
      divisi: '',
      departement: ''
    };
    if (req.body.rowFields) {
      try {
        const parsed = JSON.parse(req.body.rowFields);
        if (parsed.divisi) rowFields.divisi = parsed.divisi;
        if (parsed.departement) rowFields.departement = parsed.departement;
      } catch {
        return res.status(400).json({ error: 'Format data rowFields tidak valid' });
      }
    }

    const outputBuffer = await fillTimesheet(session.templateBuffer, session.records, activitiesMap, headerFields, rowFields);

    if (session.timer) clearTimeout(session.timer);
    sessions.delete(req.params.id);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="timesheet-filled.xlsx"');
    res.send(outputBuffer);
  } catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Terjadi kesalahan internal server' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: add session cache and two-page routes"
```

---

### Task 3: Create `public/preview.html` — preview/editor page

**Files:**
- Create: `public/preview.html`

- [ ] **Step 1: Create `public/preview.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DigiHC to Timesheet — Preview</title>
    <style>
  :root {
    --bg: #0d1117;
    --surface: #161b22;
    --border: #30363d;
    --text: #e6edf3;
    --text-secondary: #c9d1d9;
    --text-hint: #8b949e;
    --accent: #58a6ff;
    --btn-primary: #1f6feb;
    --btn-primary-hover: #388bfd;
    --btn-primary-active: #1158c7;
    --btn-primary-text: #ffffff;
    --btn-success: #238636;
    --btn-success-hover: #2ea043;
    --btn-success-active: #196c2e;
    --btn-success-text: #ffffff;
    --btn-disabled-bg: #21262d;
    --btn-disabled-text: #666e79;
    --error: #f85149;
    --info: #d29922;
    --success: #3fb950;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-pill: 24px;
  }

  *, *::before, *::after {
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: var(--bg);
    color: var(--text);
    margin: 0;
    padding: 24px;
    font-size: 15px;
    line-height: 1.4;
  }

  #backLink {
    display: inline-block;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.85rem;
    margin-bottom: 24px;
    transition: color 150ms ease;
  }

  #backLink:hover {
    color: var(--accent);
  }

  h1 {
    font-size: 1.15rem;
    color: var(--text);
    margin: 0 0 24px;
    font-weight: 600;
  }

  /* Metadata form card */
  #metadataForm {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px 24px;
    display: grid;
    grid-template-columns: 180px 1fr 140px 1fr;
    gap: 14px 16px;
    margin-bottom: 16px;
    align-items: center;
  }

  #metadataForm label {
    color: var(--text-secondary);
    font-size: 0.82rem;
    margin: 0;
  }

  #metadataForm input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0 12px;
    height: 40px;
    color: var(--text);
    font-size: 0.85rem;
    width: 100%;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  #metadataForm input:focus {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
  }

  #metadataForm input::placeholder {
    color: var(--text-hint);
  }

  /* Hint paragraph */
  #hintP {
    color: var(--text-hint);
    font-size: 0.82rem;
    margin: 0 0 8px;
  }

  /* Divisi/Departement row */
  #divDepRow {
    display: grid;
    grid-template-columns: 100px 1fr 120px 1fr;
    gap: 14px 16px;
    margin-bottom: 24px;
    align-items: center;
  }

  #divDepRow label {
    color: var(--text-secondary);
    font-size: 0.82rem;
    margin: 0;
  }

  #divDepRow input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0 12px;
    height: 40px;
    color: var(--text);
    font-size: 0.85rem;
    width: 100%;
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }

  #divDepRow input:focus {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
  }

  /* Activity table */
  #activityTable {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  #activityTable thead {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  #activityTable th {
    background: var(--surface);
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 10px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  #activityTable td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text);
    vertical-align: middle;
  }

  #activityTable tbody tr:nth-child(odd) td {
    background: var(--bg);
  }

  #activityTable tbody tr:nth-child(even) td {
    background: var(--surface);
  }

  /* Status badges */
  .status-H {
    color: var(--success) !important;
    font-weight: 600;
  }

  .status-LIB {
    color: var(--text-hint) !important;
  }

  .status-TK {
    color: var(--error) !important;
    font-weight: 600;
  }

  .status-S {
    color: var(--error) !important;
    font-weight: 600;
  }

  .status-none {
    color: var(--text-hint) !important;
  }

  /* Inline table inputs */
  .activity-input {
    width: 100%;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0 8px;
    height: 36px;
    color: var(--text);
    font-size: 0.85rem;
    transition: border-color 150ms ease;
    box-sizing: border-box;
  }

  .activity-input:focus {
    border-color: var(--accent);
    outline: none;
    box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
  }

  /* Download button */
  #downloadBtn {
    display: block;
    width: 100%;
    height: 48px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--btn-success);
    color: var(--btn-success-text);
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 24px;
    transition: background-color 150ms ease;
    appearance: none;
  }

  #downloadBtn:hover {
    background: var(--btn-success-hover);
  }

  #downloadBtn:active {
    background: var(--btn-success-active);
  }

  #downloadBtn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  #downloadBtn:disabled {
    background: var(--btn-disabled-bg);
    color: var(--btn-disabled-text);
    cursor: not-allowed;
    opacity: 1;
  }

  #status {
    margin-top: 14px;
    font-size: 0.85rem;
    color: var(--text);
    min-height: 20px;
    text-align: center;
  }

  #status.error { color: var(--error); }
  #status.success { color: var(--success); }
  #status.info { color: var(--info); }

  /* Responsive */
  @media (max-width: 600px) {
    body { padding: 16px; }

    #metadataForm {
      grid-template-columns: 1fr;
      gap: 6px;
      padding: 16px;
    }

    #divDepRow {
      grid-template-columns: 1fr;
      gap: 6px;
    }

    #activityTable th:nth-child(2),
    #activityTable td:nth-child(2),
    #activityTable th:nth-child(3),
    #activityTable td:nth-child(3),
    #activityTable th:nth-child(6),
    #activityTable td:nth-child(6),
    #activityTable th:nth-child(7),
    #activityTable td:nth-child(7),
    #activityTable th:nth-child(8),
    #activityTable td:nth-child(8),
    #activityTable th:nth-child(9),
    #activityTable td:nth-child(9) {
      display: none;
    }
  }
    </style>
  </head>
  <body>
    <a id="backLink" href="/">← Back to Home</a>
    <h1>DigiHC Attendance → Timesheet</h1>

    <div id="metadataForm">
      <label for="inputProjectName">Project Name</label>
      <input type="text" id="inputProjectName" />

      <label for="inputUnit">Unit / Divisi</label>
      <input type="text" id="inputUnit" />

      <label for="inputSite">SITE</label>
      <input type="text" id="inputSite" />

      <label for="inputName">Nama</label>
      <input type="text" id="inputName" />

      <label for="inputMiiId">MII ID</label>
      <input type="text" id="inputMiiId" />

      <label for="inputManagerName">Nama Manager (Diperiksa Oleh)</label>
      <input type="text" id="inputManagerName" />

      <label for="inputDeptHeadName">Nama Kepala Departemen (Disetujui Oleh)</label>
      <input type="text" id="inputDeptHeadName" />
      <span></span><span></span>
    </div>

    <p id="hintP">Isi Divisi dan Departement untuk mengisi kolom terkait di setiap baris timesheet.</p>
    <div id="divDepRow">
      <label for="inputDivisi">Divisi</label>
      <input type="text" id="inputDivisi" />

      <label for="inputDepartement">Departement</label>
      <input type="text" id="inputDepartement" />
    </div>

    <h2 style="font-size: 1rem; color: var(--text); margin: 0 0 14px; font-weight: 600;">Aktivitas Harian</h2>
    <table id="activityTable">
      <thead>
        <tr>
          <th>Tanggal</th>
          <th>Check-in</th>
          <th>Check-out</th>
          <th>Status</th>
          <th>Aktivitas</th>
          <th>Project Name</th>
          <th>Project ID</th>
          <th>Aplikasi Terdampak</th>
          <th>AIP Fitur</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
    <button id="downloadBtn">Download Timesheet</button>
    <div id="status"></div>

    <script>
      const CACHE_ID = window.location.pathname.split('/').pop();
      const PREVIEW = window.__PREVIEW_DATA__;

      const statusEl = document.getElementById("status");
      const downloadBtn = document.getElementById("downloadBtn");

      function setStatus(msg, cls) {
        statusEl.textContent = msg;
        statusEl.className = cls || "";
      }

      function renderTable(data) {
        const tbody = document.querySelector("#activityTable tbody");
        tbody.innerHTML = "";

        document.getElementById('inputProjectName').value = data.defaults?.projectName || '';
        document.getElementById('inputSite').value = data.defaults?.site || '';
        document.getElementById('inputName').value = data.metadata?.name || '';
        document.getElementById('inputUnit').value = data.metadata?.unit || '';
        document.getElementById('inputMiiId').value = data.metadata?.miiId || '';

        const statusLabels = {
          H: "Hadir",
          LIB: "Libur",
          TK: "Tanpa Keterangan",
          S: "Sakit",
        };

        for (const row of data.rows) {
          const tr = document.createElement("tr");

          const tdDate = document.createElement("td");
          tdDate.textContent = row.date;

          const tdIn = document.createElement("td");
          tdIn.textContent = row.checkIn ? row.checkIn.substring(0, 5) : "\u2014";

          const tdOut = document.createElement("td");
          tdOut.textContent = row.checkOut ? row.checkOut.substring(0, 5) : "\u2014";

          const tdStatus = document.createElement("td");
          tdStatus.textContent = statusLabels[row.status] || "\u2014";
          tdStatus.className = "status-" + (row.status || "none");

          const tdAct = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.value = row.activity || "";
            input.dataset.serial = row.serial;
            tdAct.appendChild(input);
          } else {
            if (row.status === "S") {
              tdAct.textContent = "Sakit";
            } else if (row.status === "LIB" && row.activity) {
              tdAct.textContent = row.activity;
            } else if (row.status === "TK") {
              tdAct.textContent = "Tanpa Keterangan";
            } else {
              tdAct.textContent = "\u2014";
            }
          }

          const tdProjName = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.dataset.serial = row.serial;
            input.dataset.field = "projectName";
            tdProjName.appendChild(input);
          } else {
            tdProjName.textContent = "\u2014";
          }

          const tdProjId = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.dataset.serial = row.serial;
            input.dataset.field = "projectId";
            tdProjId.appendChild(input);
          } else {
            tdProjId.textContent = "\u2014";
          }

          const tdAffected = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.dataset.serial = row.serial;
            input.dataset.field = "affectedApp";
            tdAffected.appendChild(input);
          } else {
            tdAffected.textContent = "\u2014";
          }

          const tdAip = document.createElement("td");
          if (row.status === "H") {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "activity-input";
            input.dataset.serial = row.serial;
            input.dataset.field = "aipFeature";
            tdAip.appendChild(input);
          } else {
            tdAip.textContent = "\u2014";
          }

          tr.appendChild(tdDate);
          tr.appendChild(tdIn);
          tr.appendChild(tdOut);
          tr.appendChild(tdStatus);
          tr.appendChild(tdAct);
          tr.appendChild(tdProjName);
          tr.appendChild(tdProjId);
          tr.appendChild(tdAffected);
          tr.appendChild(tdAip);
          tbody.appendChild(tr);
        }
      }

      downloadBtn.addEventListener("click", async () => {
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

        PREVIEW.rows.forEach((row) => {
          if (row.status === "S") {
            if (!activitiesMap.has(row.serial)) {
              activitiesMap.set(row.serial, { serial: row.serial });
            }
            activitiesMap.get(row.serial).activity = "Sakit";
          }
        });

        const activities = Array.from(activitiesMap.values()).filter(
          (a) => a.activity || a.projectName || a.projectId || a.affectedApp || a.aipFeature
        );

        const headerFields = {
          projectName: document.getElementById('inputProjectName').value.trim(),
          site: document.getElementById('inputSite').value.trim(),
          unit: document.getElementById('inputUnit').value.trim(),
          name: document.getElementById('inputName').value.trim(),
          miiId: document.getElementById('inputMiiId').value.trim(),
          managerName: document.getElementById('inputManagerName').value.trim(),
          deptHeadName: document.getElementById('inputDeptHeadName').value.trim()
        };

        const rowFields = {
          divisi: document.getElementById('inputDivisi').value.trim(),
          departement: document.getElementById('inputDepartement').value.trim()
        };

        setStatus("Mengunduh...", "info");
        downloadBtn.disabled = true;

        try {
          const data = new FormData();
          data.append("activities", JSON.stringify(activities));
          data.append('headerFields', JSON.stringify(headerFields));
          data.append('rowFields', JSON.stringify(rowFields));

          const res = await fetch("/convert/" + CACHE_ID, { method: "POST", body: data });

          if (!res.ok) {
            const err = await res.json();
            setStatus("Error: " + (err.error || "Unknown error"), "error");
            return;
          }

          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "timesheet-filled.xlsx";
          a.click();
          URL.revokeObjectURL(url);

          setStatus("Download dimulai!", "success");
        } catch (err) {
          setStatus("Error: " + err.message, "error");
        } finally {
          downloadBtn.disabled = false;
        }
      });

      if (PREVIEW) {
        renderTable(PREVIEW);
      } else {
        setStatus("Data tidak tersedia. Silakan unggah ulang.", "error");
      }
    </script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/preview.html
git commit -m "feat: add preview page with full-width table and no placeholders"
```

---

### Task 4: Serve preview data as embedded JSON

**Files:**
- Modify: `server.js` — inject `window.__PREVIEW_DATA__` before sending preview.html

- [ ] **Step 1: Modify `GET /preview/:id` to inject data**

Replace the current `GET /preview/:id` sendFile line with HTML injection:

Read the file, replace `</head>` with a `<script>` data injection before it. Change this line in server.js:

```js
  res.sendFile(path.join(__dirname, 'public', 'preview.html'));
```

To:

```js
  const fs = require('fs');
  let html = fs.readFileSync(path.join(__dirname, 'public', 'preview.html'), 'utf8');
  const injected = html.replace('</head>',
    '<script>window.__PREVIEW_DATA__ = ' +
    JSON.stringify(session.previewData) +
    ';</script></head>');
  res.send(injected);
```

Note: Move `const fs = require('fs');` to the top of `server.js` with the other requires.

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: inject preview data as embedded JSON in preview page"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Full flow test**

1. Run `npm start`
2. Open `http://localhost:3000` — confirm upload card centered on page
3. Upload `sample-digihc.pdf` and `sample-timesheet.xlsx`
4. Click Preview Data — confirm redirect to `/preview/<uuid>`
5. Confirm preview page shows: metadata form, activity table, back link
6. Confirm table is full-width (no max-width boundaries)
7. Confirm activity inputs have no placeholder text
8. Fill some fields, click Download — confirm XLSX downloads
9. Click "← Back to Home" — confirm returns to upload page
10. Visit a stale `/preview/<uuid>` URL — confirm 410 error page

- [ ] **Step 2: Verify placeholder removal**

Open browser dev tools, inspect any activity input field in the table. Confirm there is no `placeholder` attribute on any `.activity-input` element.

---

# Rencana Implementasi Dua Halaman dengan Cache Server

...

(Langkah-langkah sama seperti versi Inggris di atas — lihat Task 1-4 untuk kode lengkapnya.)

---

## Penyelesaian Rencana

Setelah semua tugas selesai, aplikasi memiliki:
- Dua halaman terpisah dengan navigasi browser nyata
- Cache server dalam memori (15 menit TTL)
- Tabel aktivitas lebar penuh tanpa petunjuk placeholder
- Tombol kembali ke beranda
- Tidak perlu unggah ulang file
