# Formatting and UX Enhancements — Design Spec

**Date**: 2026-05-04
**Status**: Draft

## Overview

Six targeted enhancements across filler.js, preview.html, and server.js:

1. Restrict text wrapping to data rows only (not header rows 1-6)
2. Set entire document font to Calibri
3. Remove MII ID auto-fill from the preview form
4. Auto cell height on data rows
5. Allow user to rename the downloaded file
6. Add signature date picker, written into the Excel "DATE:" row

## Changes

### 1. `lib/filler.js` — New `applyFormatting` function

Replace the inline formatting loop (lines 240-247) with a dedicated `applyFormatting` function.

**Signature**:
```js
function applyFormatting(ws, layout, recordMap, signatureDate)
```

**Behaviors**:

- **Font**: Set `{ name: 'Calibri', size: 9 }` on all cells from row 1 to `formulaRow`, columns 1 to `LAST_COL` (17). Merge with any existing font properties (e.g., bold from divisi/departement).

- **wrapText**: Split into two loops:
  - Rows 1 to `dataStart - 1` (header rows): font only, NO wrapText.
  - Rows `dataStart` to `formulaRow`: font + wrapText on columns 1 to `LAST_COL`.

- **Auto-height**: For rows `dataStart` to `dataEnd`, set `ws.getRow(r).height = undefined` so Excel auto-fits row height based on content.

- **Signature date**: Scan rows 1-50 in column A for a cell whose string value contains `"DATE"`. When found, set column C of that row to `"DATE: " + signatureDate` (e.g., `"DATE: 2 Januari 2026"`) with bold font. If `signatureDate` is empty/null, skip this step.

**Call site**: Near the end of `fillTimesheet`, after the data-fill loop and white/gray fill loop, before the COUNTIF formula write.

**`fillTimesheet` signature change**: Add `signatureDate` parameter:
```js
async function fillTimesheet(templateBuffer, records, activitiesMap, headerFields = {}, rowFields = {}, signatureDate = '')
```

### 2. `server.js` — Pass signatureDate to fillTimesheet

In the `/convert/:id` route handler, extract `signatureDate` from `req.body` and pass it:

```js
const signatureDate = req.body.signatureDate || '';
const outputBuffer = await fillTimesheet(
  session.templateBuffer, session.records, activitiesMap,
  headerFields, rowFields, signatureDate
);
```

### 3. `public/preview.html` — UI additions and MII ID removal

**a) Remove MII ID pre-fill**

Delete this line from `renderTable()`:
```js
document.getElementById('inputMiiId').value = data.metadata?.miiId || '';
```

The MII ID input remains on the page but starts empty; the user fills it manually.

**b) Rename file input**

New input above the Download button:
```html
<label for="inputFilename">Nama File</label>
<input type="text" id="inputFilename" />
```

Default value JS logic:
```js
const name = document.getElementById('inputName').value.trim();
if (name) {
  const mo = PREVIEW.month.month; // 0-indexed
  const year = PREVIEW.month.year;
  const months = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
  document.getElementById('inputFilename').value = `${name}-${months[mo]}-${year}-Timesheet.xlsx`;
} else {
  document.getElementById('inputFilename').value = 'timesheet-filled.xlsx';
}
```

The download handler uses this value for `a.download` instead of the hardcoded `"timesheet-filled.xlsx"`.

**c) Signature date picker**

New date input above the Download button (below filename input):
```html
<label for="inputSignDate">Tanggal Penandatanganan</label>
<input type="date" id="inputSignDate" />
```

Download handler converts the `YYYY-MM-DD` value to Indonesian format before sending:
```js
if (signDateEl.value) {
  const [y, m, d] = signDateEl.value.split('-');
  const months = ['Januari','Februari','Maret','April','Mei','Juni',
                  'Juli','Agustus','September','Oktober','November','Desember'];
  data.append('signatureDate', `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`);
}
```

**Layout**: Both new inputs appear above the Download button, filename first then signature date.

## Data Flow

```
preview.html                          server.js                    filler.js
───────────                          ─────────                    ─────────
inputSignDate (date picker) ──┐
inputFilename (text) ─────────┤
Download click ──► POST /convert/:id │
                        req.body.signatureDate ──────────► applyFormatting()
                        req.body.filename ──► Content-Disposition header
                                                          writes "DATE: <date>" to marker row
```

## Error Handling

- If signature date is empty, no DATE cell is written (graceful skip).
- If the "DATE" marker row is not found in the template, skip silently.
- If filename input is empty at download time, fall back to `"timesheet-filled.xlsx"`.
- Existing error handling for month mismatch, missing files, and session expiry is unchanged.

## Testing

Manual verification using `sample-timesheet.xlsx` and `sample-digihc.pdf`:
1. Open preview page, verify MII ID is empty.
2. Verify filename input is pre-populated with correct format.
3. Select a signature date in the date picker.
4. Download the file, verify:
   - Excel font is Calibri size 9 throughout.
   - Header rows (1-6) have NO text wrapping.
   - Data rows (7+) have text wrapping.
   - Data row heights auto-adjust to content.
   - The "DATE:" cell shows the selected date in Indonesian format.
   - Downloaded filename matches the input (or default fallback).
