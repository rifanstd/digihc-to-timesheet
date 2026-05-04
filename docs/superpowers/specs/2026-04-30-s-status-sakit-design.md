# S Status → "Sakit" Auto-Fill

## Summary

When a DigiHC PDF row has status `S` (Sakit/sick), automatically write `"Sakit"` in the Activities column (K) of the timesheet. `S` rows have no check-in/check-out times (same as LIB/TK).

## Changes

### 1. `lib/parser.js:100`

Add `S` to the status capture regex:

```
/ (H|LIB|TK|S)(\t|$)/
```

Before: `S` rows had `status: null`. After: `status: "S"`.

### 2. `lib/filler.js` — `fillTimesheet` (line ~143)

In the `hasData === false` branch, treat `S` differently:

- Clear columns B–J (2–10) as before
- Column K (11): write `"Sakit"` instead of clearing
- Fill color: white (`FFFFFFFF`), same as H/TK (not gray like LIB)
- No change to COUNTIF formula — `S` does not count as hadir

### 3. `public/index.html`

- `statusLabels`: add `S: 'Sakit'`
- `renderTable`: for `S` rows, show `"Sakit"` as a read-only text label in the activity column (pattern: same as TK shows `"Tanpa Keterangan"`)
- `downloadBtn` click handler: auto-append `{ serial, activity: 'Sakit' }` to the `activities` array for every row with `status === 'S'`

## Rationale

- Activity is deterministic (`S` always means `"Sakit"`) → no user input needed
- Read-only in preview to prevent accidental override
- Server-side auto-fill in filler ensures correctness regardless of frontend behavior
