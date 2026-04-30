# LIB Status Gray Fill — Design Spec

**Date:** 2026-04-30
**Status:** Draft
**Depends on:** 2026-04-30-dynamic-template-layout-design.md

## Problem

Rows with `LIB` (Libur/holiday) status are currently filled white like all other rows. The user wants `LIB` rows to be visually distinct with a gray (`#BFBFBF`) background.

## Design

### parser.js — add status field to records

Currently each record has: `{ excelSerial, date, checkIn, checkOut, hasData }`. Add a `status` field extracted from the PDF line.

Status codes appear in the PDF line as a standalone token: `H`, `LIB`, or `TK`, preceded by a space and followed by a tab or end of line.

Extract with: `line.match(/ (H|LIB|TK)(\t|$)/)` — capture group 1 is the status.

```js
const statusMatch = line.match(/ (H|LIB|TK)(\t|$)/);
// ... in record push:
records.push({
  // ...existing fields...
  status: statusMatch ? statusMatch[1] : null
});
```

### filler.js — conditional fill color

Replace the hardcoded `FFFFFFFF` white fill with a status-dependent color:

```js
for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
  const dateCell = ws.getCell(r, 1);
  const dateVal = dateCell.value;
  let rowSerial;
  if (dateVal instanceof Date) {
    rowSerial = dateToExcelSerial(dateVal);
  } else if (typeof dateVal === 'number') {
    rowSerial = dateVal;
  } else {
    continue;
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

### AGENTS.md

Update the "White fill" section to mention the LIB exception.

## Files changed

| File | Change |
|------|--------|
| `lib/parser.js` | Extract `status` field from PDF lines |
| `lib/filler.js` | Use `FFBFBFBF` fill for `LIB` rows |
| `AGENTS.md` | Document the `LIB` gray fill behavior |
