# LIB Status Gray Fill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `LIB`/`H`/`TK` status from PDF records and apply gray fill to holiday rows.

**Architecture:** `parser.js` adds a `status` field to each record. `filler.js` uses the status to choose fill color — `FFBFBFBF` for LIB, `FFFFFFFF` for H/TK. `AGENTS.md` updated.

**Tech Stack:** Node.js, exceljs, pdf-parse

---

### Task 1: Add status field to PDF parser

**Files:**
- Modify: `lib/parser.js`

- [ ] **Step 1: Extract status from each PDF line and add to record**

In `lib/parser.js`, inside the `for (const line of lines)` loop in `parsePdf`, add status extraction. Find the section where records are pushed:

```js
    records.push({
      excelSerial,
      date: dateMatch[0],
      checkIn,
      checkOut,
      hasData
    });
```

Replace with:

```js
    const statusMatch = line.match(/ (H|LIB|TK)(\t|$)/);
    records.push({
      excelSerial,
      date: dateMatch[0],
      checkIn,
      checkOut,
      hasData,
      status: statusMatch ? statusMatch[1] : null
    });
```

---

### Task 2: Apply gray fill for LIB rows in filler.js

**Files:**
- Modify: `lib/filler.js`

- [ ] **Step 1: Replace the white fill loop with conditional color**

In `lib/filler.js`, find the fill loop:

```js
  // White fill on all month rows, all columns
  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    for (let c = 1; c <= ws.columnCount; c++) {
      ws.getCell(r, c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFFFF' }
      };
    }
  }
```

Replace with:

```js
  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    const dateCell = ws.getCell(r, 1);
    const dateVal = dateCell.value;
    let rowSerial;
    if (dateVal instanceof Date) {
      rowSerial = dateToExcelSerial(dateVal);
    } else if (typeof dateVal === 'number') {
      rowSerial = dateVal;
    }
    const record = recordMap[rowSerial];
    const fillColor = (record && record.status === 'LIB') ? 'FFBFBFBF' : 'FFFFFFFF';

    for (let c = 1; c <= ws.columnCount; c++) {
      ws.getCell(r, c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: fillColor }
      };
    }
  }
```

---

### Task 3: Update AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the White fill section**

Replace the existing White fill section:

```
### White fill

All rows in the month's date range receive a white (`FFFFFFFF`) solid pattern fill on every column. This overrides any pre-existing cell colors in the template.
```

With:

```
### White fill

All rows in the month's date range receive a solid pattern fill on every column:
- `H` (hadir) and `TK` (tanpa keterangan) rows: white (`FFFFFFFF`)
- `LIB` (libur/holiday) rows: gray (`FFBFBFBF`)

This overrides any pre-existing cell colors in the template.
```
