# Metadata Form, Sick Column Fill, and Default Checkout

## Summary

Four enhancements to the DigiHC-to-Timesheet converter:

1. **S status → Sick column (F)**: Write `"S"` to column F (Sick) for sick days, alongside the existing `"Sakit"` text in column K.
2. **Check-in without check-out → default 17:00**: When DigiHC has a check-in time but no check-out, treat the day as fully present: auto-set check-out to `17:00:00`, calculate total hours, and mark status `P`.
3. **Metadata form**: Extract Name, Unit, and MII ID from the DigiHC PDF header. Add editable form inputs in the UI for Unit, Name, MII ID, Project Name, and SITE. Pre-fill defaults from PDF (where available) and hardcoded values.
4. **Header cell fill**: Write the metadata values (Project Name, SITE, Unit, Name, MII ID) to the appropriate cells in the output timesheet, appending after the existing `":"` separators without modifying the label text.

## Changes

### 1. `lib/parser.js` — Extract PDF metadata

Add function `parseMetadata(text)` that scans the first ~15 lines of the PDF raw text. The DigiHC PDF header has this multiline structure (values appear on separate lines after their labels):

```
Laporan Kehadiran Karyawan
NPP / Nama :          ← label line
Unit :                ← label line
Time Zone :           ← label line
RIFAN SETIADI         ← name value (line after labels block)
WIB
Departemen Retail Channel Delivery   ← unit value
/	OM2502635          ← MII ID (prefixed with "/")
```

Extract:
- **Name**: text line immediately after label block (first non-label, non-"Time Zone", non-"WIB" line)
- **Unit**: text line after Name and WIB
- **MII ID**: line starting with `/` followed by alphanumeric code

Return `{ name, unit, miiId }`. Any field not found is `null`. Export from module.

Modify `parsePdf()` to return `{ records, errors, metadata }` — call `parseMetadata()` internally on the raw text before returning.

**Default 17:00 checkout**: In `parsePdf()`, when `timeMatches.length === 1` (check-in found, no check-out), set `checkOut = '17:00:00'` and `hasData = true`. The existing logic already handles check-in assignment correctly in this case.

### 2. `lib/filler.js` — Filler changes

**2a. Sick column F**: In the `!record.hasData` branch (line 143), when `record.status === 'S'`:

```js
ws.getCell(row, 6).value = 'S';    // NEW: Sick column
ws.getCell(row, 11).value = 'Sakit'; // existing
```

Columns 2–10 are still cleared first. The `'S'` assignment to column 6 overrides the clear for that single column.

**2b. Header cell fill**: New function parameter `fillTimesheet(buffer, records, activitiesMap, headerFields)` where `headerFields = { projectName, site, unit, name, miiId }`.

After loading the workbook, write values to the cells containing `":"` on rows 1–5:

| Row | Target cell(s) | Value format |
|-----|---------------|--------------|
| 1 | C1 (C1:G1 merged) | `: <projectName>` |
| 2 | C2 (C2:E2 merged) | `: <unit>` |
| 3 | C3 (C3:F3 merged) | `: <name>` |
| 4 | C4 (unmerged) | `: <miiId>` |
| 5 | C5 (unmerged) | `: <site>` |

The existing label text in columns A:B (e.g., "NAME of PROJECT", "SITE") is never touched.

Implementation approach: for each row, read cell in column C, find the `":"` text, and write `": <value>"` as replacement. If any field is null/empty, skip that row.

### 3. `server.js` — Endpoint changes

**3a. `/preview` endpoint**: Return metadata in the JSON response:

```json
{
  "month": { ... },
  "rows": [ ... ],
  "metadata": { "name": "RIFAN SETIADI", "unit": "...", "miiId": "OM2502635" },
  "defaults": { "projectName": "PT Bank Negara Indonesia (Persero) Tbk", "site": "BNI" }
}
```

Metadata comes directly from `parsePdf()` return value (`records, errors, metadata`). The `defaults` object provides the hardcoded fallback values for the UI form.

**3b. `/convert` endpoint**: Parse `req.body.headerFields` (JSON), validate it, and pass to `fillTimesheet()`. Provide defaults if fields are missing:

```js
const headerFields = {
  projectName: 'PT Bank Negara Indonesia (Persero) Tbk',
  site: 'BNI',
  unit: '',
  name: '',
  miiId: ''
};
// override from req.body.headerFields if provided
```

### 4. `public/index.html` — UI changes

**4a. Metadata form section**: Add a `<div id="metadataSection">` inside `#activitySection`, above the activity table. Contains 5 labeled `<input>` fields:

```
Project Name: [________________]  default: "PT Bank Negara Indonesia (Persero) Tbk"
SITE:         [________________]  default: "BNI"
Unit:         [________________]  default: from PDF metadata
Name:         [________________]  default: from PDF metadata
MII ID:       [________________]  default: from PDF metadata
```

**4b. `renderTable` update**: After rendering the activity table, populate the metadata form inputs with values from `previewData.metadata` and `previewData.defaults`.

**4c. `downloadBtn` handler update**: Collect values from metadata form inputs, serialize as JSON, and append to `FormData` as `headerFields`:

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

### 5. Column F fill color for S rows

S rows get white fill (`FFFFFFFF`) — same as H and TK rows (not gray like LIB). This is already the current behavior and requires no change.

## Verification

Manual test with `sample-digihc.pdf` + `sample-timesheet-final.xlsx`:

1. Upload PDF and template, click Preview
2. Verify metadata form fields are pre-populated (Name, Unit, MII ID from PDF; Project Name and SITE from defaults)
3. Edit fields if desired
4. Click Download
5. Open the downloaded xlsx and verify:
   - Row 1, col C shows `: PT Bank Negara Indonesia (Persero) Tbk`
   - Row 2, col C shows `: <unit value>`
   - Row 3, col C shows `: <name value>`
   - Row 4, col C shows `: <miiId value>`
   - Row 5, col C shows `: BNI`
   - Sick days (if any) have `S` in column F and `Sakit` in column K
   - Days with check-in only (if any) have `17:00` checkout, calculated hours, and `P` status
