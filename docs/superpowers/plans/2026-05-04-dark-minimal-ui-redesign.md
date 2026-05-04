# Dark Minimal UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline CSS in `public/index.html` with a comprehensive dark theme, rounded soft interactive elements, and a two-step reveal layout — no HTML structural changes, no JS changes, no new dependencies.

**Architecture:** Single-file CSS overhaul. All styles live in the `<style>` block. Inline `style` attributes on HTML elements are updated to dark-theme equivalents. File inputs styled via `::file-selector-button`. Two-step flow achieved via existing JS-driven `display` toggle on `#activitySection`, with body flex layout providing natural vertical positioning.

**Tech Stack:** Vanilla CSS (custom properties, `::file-selector-button`, media queries), no frameworks.

---

### Task 1: CSS custom properties and base reset

**Files:**
- Modify: `public/index.html` — replace `<style>` block lines 7-148

- [ ] **Step 1: Replace the entire `<style>` block with the new root + base styles**

Replace lines 7-13 (everything from `<style>` through `body { font-family...`) with:

```css
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
    --btn-success: #238636;
    --btn-success-hover: #2ea043;
    --btn-success-active: #196c2e;
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

  h2 {
    font-size: 1rem;
    color: var(--text);
    margin: 0 0 12px;
    font-weight: 600;
  }
```

Now the old CSS from lines 14-148 is replaced. The remaining old CSS (`.error`, `.success`, `.info`, `#activitySection`, `#activitySection h2`, `table`, `th/td`, `.activity-input`, status badges, `#downloadBtn`, `#metadataForm`, `@media`) still exists but will be replaced in subsequent steps.

- [ ] **Step 2: Verify the page loads with the new base styles**

Run: `npm start` and open `http://localhost:3000`. Confirm dark background, body text in `#e6edf3`, heading styled.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add CSS custom properties and base dark reset"
```

---

### Task 2: Upload section styles

**Files:**
- Modify: `public/index.html` — replace remaining upload-related CSS selectors in `<style>` block

- [ ] **Step 1: Replace old upload/label/input/button/status CSS**

The old CSS covers selectors `h1`, `label`, `input[type="file"]`, `button`, `#status`, `.error`, `.success`, `.info`. Remove those rules and insert the following after the `h2` rule from Task 1:

```css
  /* === Upload Section === */
  #uploadSection {
    max-width: 420px;
    width: 100%;
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 32px 28px;
  }

  /* Section labels (non-file-input labels) */
  #uploadSection > label {
    display: block;
    color: var(--text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 6px;
  }

  #uploadSection > label + label {
    margin-top: 16px;
  }

  /* File inputs — style the native ::file-selector-button */
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

  /* Preview button */
  #previewBtn {
    display: block;
    width: 100%;
    height: 48px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--btn-primary);
    color: #ffffff;
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

  #previewBtn:disabled {
    background: var(--btn-disabled-bg);
    color: var(--btn-disabled-text);
    cursor: not-allowed;
    opacity: 1;
  }

  /* Status messages */
  #status {
    margin-top: 14px;
    font-size: 0.85rem;
    color: var(--text);
    min-height: 20px;
    text-align: center;
  }

  #status.error {
    color: var(--error);
  }

  #status.success {
    color: var(--success);
  }

  #status.info {
    color: var(--info);
  }
```

- [ ] **Step 2: Remove old conflicting selectors**

Ensure no old CSS rules for `label`, `input[type="file"]`, `button`, `#status`, `.error`, `.success`, `.info` remain in the file (lines that were between the `h1` rule and the `#activitySection` rules in the original file).

- [ ] **Step 3: Verify upload section in browser**

Run `npm start`, navigate to `http://localhost:3000`. Confirm:
- Dark card centered at top with proper padding
- File inputs show dark-styled select button
- Preview button is a blue pill, 48px height
- Hover states work on button and file selector

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: apply dark theme to upload section"
```

---

### Task 3: Editor view styles (metadata, table, download)

**Files:**
- Modify: `public/index.html` — replace remaining old CSS in `<style>` block

- [ ] **Step 1: Replace old activity-section, metadata, table, and download CSS**

Remove all old selectors from `#activitySection` through the end of the `@media` block (old lines 49-148). Insert the following after the status message rules from Task 2:

```css
  /* === Activity Section === */
  #activitySection {
    max-width: 720px;
    width: 100%;
    margin-top: 36px;
  }

  #activitySection h2 {
    font-size: 1rem;
    color: var(--text);
    margin: 0 0 14px;
    font-weight: 600;
  }

  /* Metadata form card */
  #metadataForm {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 20px 24px;
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 14px 16px;
    margin-bottom: 20px;
    align-items: center;
  }

  #metadataForm label {
    color: var(--text-secondary);
    font-size: 0.82rem;
    margin: 0;
    font-weight: 400;
    align-self: center;
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

  .activity-input::placeholder {
    color: var(--text-hint);
  }

  /* Download button */
  #downloadBtn {
    display: block;
    width: 100%;
    height: 48px;
    border: none;
    border-radius: var(--radius-pill);
    background: var(--btn-success);
    color: #ffffff;
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

  #downloadBtn:disabled {
    background: var(--btn-disabled-bg);
    color: var(--btn-disabled-text);
    cursor: not-allowed;
    opacity: 1;
  }
```

- [ ] **Step 2: Append responsive media query**

Append after the `#downloadBtn:disabled` block, still inside `<style>` but before `</style>`:

```css
  /* === Responsive === */
  @media (max-width: 600px) {
    body {
      padding: 20px 16px;
    }

    h1 {
      font-size: 1.1rem;
      margin-bottom: 24px;
    }

    #uploadSection {
      padding: 24px 18px;
    }

    #metadataForm {
      grid-template-columns: 1fr;
      gap: 6px;
      padding: 16px;
    }

    /* Hide extra table columns on mobile */
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
```

- [ ] **Step 3: Verify editor view in browser**

On `http://localhost:3000`, upload sample PDF and XLSX, then click Preview Data. Confirm:
- Metadata card has dark surface, 2-column grid, styled inputs
- Table has alternating row colors, sticky header, compact padding
- Status badges in correct colors
- Download button is green pill, 48px
- Mobile (resize to <600px): metadata stacks single-column, table hides extra columns

- [ ] **Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: apply dark theme to editor view and table"
```

---

### Task 4: Inline style cleanup on HTML elements

**Files:**
- Modify: `public/index.html` — update inline `style` attributes on HTML elements that have light-theme colors

- [ ] **Step 1: Update inline styles on the hint paragraph**

Change line 195 (the `<p>` after `#metadataForm`):

Old: `<p style="margin: 16px 0 4px; font-size: 0.85rem; color: #555;">`

New: `<p style="margin: 0 0 4px; font-size: 0.82rem; color: var(--text-hint);">`

- [ ] **Step 2: Update inline styles on the Divisi/Departement grid container**

Change the `<div>` on line 196:

Old: `<div style="display: grid; grid-template-columns: 120px 1fr; gap: 8px 12px; margin-bottom: 16px;">`

New: `<div style="display: grid; grid-template-columns: 160px 1fr; gap: 14px 16px; margin-bottom: 20px; padding: 0 0 0 0; background: transparent; border: none;">`

- [ ] **Step 3: Update inline styles on Divisi/Departement labels**

On lines 197 and 200, change the label `style` attributes:

Old: `style="margin: 0; align-self: center; font-size: 0.85rem;"`

New: `style="margin: 0; align-self: center; font-size: 0.82rem; color: var(--text-secondary);"`

- [ ] **Step 4: Update inline styles on Divisi/Departement inputs**

On lines 198 and 201, change the input `style` attributes:

Old: `style="padding: 6px 10px; border: 1px solid #ccc; border-radius: 3px; font-size: 0.85rem; box-sizing: border-box;"`

New: `style="padding: 0 12px; border: 1px solid var(--border); border-radius: var(--radius-md); font-size: 0.85rem; box-sizing: border-box; height: 40px; background: var(--bg); color: var(--text);"`

- [ ] **Step 5: Verify no light-theme colors remain**

Run a grep to check for hardcoded light colors:
```bash
grep -nE '#ccc|#e0e0e0|#f5f5f5|#fafafa|#555|#d32f2f|#2e7d32|#1976d2|#888|#aaa' public/index.html
```
Only matches inside `<script>` or user-entered data are acceptable (script uses these for JS class manipulation which is referenced by CSS selectors, but the inline color values in CSS are already replaced).

- [ ] **Step 6: Commit**

```bash
git add public/index.html
git commit -m "fix: update inline styles to dark theme colors"
```

---

### Task 5: Manual end-to-end verification

**Files:**
- Manual: `sample-digihc.pdf`, `sample-timesheet.xlsx`

- [ ] **Step 1: Full flow — upload, preview, edit, download**

Run: `npm start`

1. Open `http://localhost:3000`
2. Upload `sample-digihc.pdf` and `sample-timesheet.xlsx`
3. Click **Preview Data** — confirm editor view appears below
4. Fill in some activity fields, project name, project ID, etc.
5. Click **Download Timesheet** — confirm XLSX downloads
6. Resize browser to <600px wide — confirm responsive layout works

- [ ] **Step 2: Error states**

1. Click **Preview Data** without files — confirm error message in red (`var(--error)`)
2. Upload PDF only (no template) — confirm error message visible

- [ ] **Step 3: Disabled states**

During a preview loading, the Preview button should show disabled state (muted gray).

- [ ] **Step 4: Confirm no visual regressions**

Compare against the current `main` version to ensure all functionality still works identically — only visual styling changed.

---

## Plan Completion

After all tasks pass verification, the UI is fully dark-themed with rounded soft interactive elements and a two-step card-based flow. All changes are limited to `public/index.html` CSS block and inline style attributes — zero changes to HTML structure, JavaScript, or server code.

---

# Rencana Implementasi Redesain UI Minimal Gelap (Versi Bahasa Indonesia)

> **Untuk pekerja agentic:** SUB-SKILL WAJIB: Gunakan superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengimplementasikan rencana ini tugas demi tugas. Langkah-langkah menggunakan sintaks checkbox (`- [ ]`) untuk pelacakan.

**Tujuan:** Mengganti semua CSS sejajar di `public/index.html` dengan tema gelap komprehensif, elemen interaktif bulat lembut, dan tata letak pengungkapan dua langkah — tanpa perubahan struktural HTML, tanpa perubahan JS, tanpa dependensi baru.

**Arsitektur:** Perombakan CSS file tunggal. Semua gaya berada di blok `<style>`. Atribut `style` sejajar pada elemen HTML diperbarui ke ekuivalen tema gelap. Input file diberi gaya via `::file-selector-button`. Alur dua langkah dicapai melalui toggle `display` pada `#activitySection` yang digerakkan JS yang sudah ada, dengan tata letak flex body memberikan posisi vertikal alami.

**Tech Stack:** CSS vanilla (custom properties, `::file-selector-button`, media queries), tanpa framework.

---

### Tugas 1: CSS custom properties dan reset dasar

**File:**
- Modifikasi: `public/index.html` — ganti blok `<style>` baris 7-148

- [ ] **Langkah 1: Ganti seluruh blok `<style>` dengan root baru + gaya dasar**

Ganti baris 7-13 dengan kode CSS yang sama seperti di versi Inggris (lihat Task 1 Step 1 di atas).

- [ ] **Langkah 2: Verifikasi halaman dimuat dengan gaya dasar baru**

Jalankan: `npm start` dan buka `http://localhost:3000`. Konfirmasi latar gelap, teks body `#e6edf3`, judul bergaya.

- [ ] **Langkah 3: Commit**

```bash
git add public/index.html
git commit -m "feat: tambahkan CSS custom properties dan reset dasar gelap"
```

---

### Tugas 2: Gaya bagian unggah

**File:**
- Modifikasi: `public/index.html` — ganti selector CSS terkait unggah yang tersisa

(Langkah-langkah sama seperti versi Inggris di atas — lihat Task 2.)

---

### Tugas 3: Gaya tampilan editor (metadata, tabel, unduh)

**File:**
- Modifikasi: `public/index.html` — ganti CSS lama yang tersisa di blok `<style>`

(Langkah-langkah sama seperti versi Inggris di atas — lihat Task 3.)

---

### Tugas 4: Pembersihan gaya sejajar pada elemen HTML

**File:**
- Modifikasi: `public/index.html` — perbarui atribut `style` sejajar pada elemen HTML yang memiliki warna tema terang

(Langkah-langkah sama seperti versi Inggris di atas — lihat Task 4.)

---

### Tugas 5: Verifikasi manual end-to-end

**File:**
- Manual: `sample-digihc.pdf`, `sample-timesheet.xlsx`

(Langkah-langkah sama seperti versi Inggris di atas — lihat Task 5.)

---

## Penyelesaian Rencana

Setelah semua tugas lulus verifikasi, UI sepenuhnya bertema gelap dengan elemen interaktif bulat lembut dan alur berbasis kartu dua langkah. Semua perubahan terbatas pada blok CSS `public/index.html` dan atribut gaya sejajar — nol perubahan pada struktur HTML, JavaScript, atau kode server.
