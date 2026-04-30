# Preserve XLSX Template Formatting

## Problem

The `xlsx` community edition strips nearly everything on read/write:

| What | Lost |
|------|------|
| Cell formatting (fonts, borders, fills, alignment) | styles.xml shrinks 91% |
| Number formats | Not read from cells |
| Images (company logo) | image1.png dropped |
| Drawings | drawing1.xml dropped |
| Shared strings | Pre-filled header text gone |
| Calc chain | Formula dependencies gone |

Mutating cells instead of replacing them cannot fix this — the library itself discards formatting during the read/write cycle.

## Design

**Replace `xlsx` with `exceljs`**, which preserves full XLSX fidelity including styles, images, formatting, and rich structure across read/write.

### Dependency changes

| Change | Detail |
|--------|--------|
| Remove | `xlsx` from `package.json` |
| Add | `exceljs` to `package.json` |

### API mapping (xlsx → exceljs)

| Operation | xlsx (0-indexed) | exceljs (1-indexed) |
|-----------|------------------|---------------------|
| Load workbook | `XLSX.read(buf, { type: 'buffer' })` | `await wb.xlsx.load(buf)` |
| Get sheet | `wb.Sheets[wb.SheetNames[0]]` | `wb.getWorksheet(1)` |
| Read cell | `ws['A9'].v` | `ws.getCell(9, 1).value` |
| Write cell | `ws['B9'] = { t: 'n', v: 0.3 }` | `ws.getCell(9, 2).value = 0.3` |
| Write formula | `{ t: 'n', v: 0, f: '=...' }` | `{ formula: '=...', result: 0 }` |
| Write buffer | `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })` | `await wb.xlsx.writeBuffer()` |

### Row/column mapping

| Range | xlsx (0-indexed) | exceljs (1-indexed) |
|-------|------------------|---------------------|
| Date column | col A = 0 | col 1 |
| Check-in | col B = 1 | col 2 |
| Check-out | col C = 2 | col 3 |
| Total hours | col D = 3 | col 4 |
| Status | col E = 4 | col 5 |
| Remark | col K = 10 | col 11 |
| Day rows | 8–38 | 9–39 |
| Total row | 39 | 40 |

### Filling logic (same logic, exceljs API)

1. **Days WITH data:** Set `cell.value` for check-in (col 2), check-out (col 3), total (col 4 as `checkOut - checkIn`), status (col 5 = `'P'`). Preserve col 11 (remark) if it has content; clear it if empty by setting value to `null`.
2. **Days WITHOUT data:** Set col 2–11 values to `null` (clears cell but preserves formatting). Leave col 1 (date) intact.
3. **Row 40 formula:** Set `cell.value = { formula: '=COUNTIF(E9:E39,"P")', result: countOfPresent }` — actually compute the count instead of 0.

### What is preserved

- All cell formatting — fonts, borders, fills, alignment, number formats
- Images and drawings (company logo)
- Shared strings (pre-filled headers and labels)
- Calc chain and formula dependencies
- Sheet-level properties — merged cells, column widths, row heights, print areas
- Workbook-level metadata and defined names

### Functions affected

- `lib/filler.js` — `fillTimesheet()` becomes `async`
- `server.js` — `POST /convert` handler must `await fillTimesheet()`

### Error handling

- `exceljs` throws on invalid XLSX input — already caught by existing 422 handler in `server.js`
- If template has no date column or unexpected layout, behavior matches current code (skip rows with missing/unexpected date values)
