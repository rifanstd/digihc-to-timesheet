# Preview UI Polish

**Date**: 2026-05-04  
**Scope**: `public/preview.html` only (CSS + JS changes, no backend)

## 1. Activity table input background color

**Problem**: `.activity-input` uses `var(--surface)` (#161b22), identical to even row backgrounds, making inputs invisible on even rows.

**Fix**: Add `--input-bg: #1c2128` to `:root` and change `.activity-input { background: var(--input-bg); }`. This color is distinct from both odd (`#0d1117`) and even (`#161b22`) row backgrounds while staying visually cohesive with the dark theme.

## 2. Empty table cells: `---` center-aligned

**Problem**: Cells with no data show em dash (`\u2014`) left-aligned. User wants three hyphens (`---`) with center alignment instead.

**Fix** (UI only — does not affect XLSX output):
- Replace all `\u2014` placeholders in `renderTable()` with `"---"`
- Set `style.textAlign = "center"` on placeholder `<td>` elements only
- Cells with actual content retain left alignment

Affected columns: Check-in, Check-out, Status, Aktivitas, Project Name, Project ID, Aplikasi Terdampak, AIP Fitur.

## 3. All metadata fields mandatory

**Problem**: The 10 metadata/row/signature fields can be left empty before download.

**Fix**:
- **CSS**: Add `.invalid { border-color: var(--error) !important; }` style
- **JS**: At the top of the download button click handler, validate all 10 fields are non-empty after `.trim()`:
  - Metadata: `inputProjectName`, `inputUnit`, `inputSite`, `inputName`, `inputMiiId`, `inputManagerName`, `inputDeptHeadName`
  - Row: `inputDivisi`, `inputDepartement`
  - `inputSignDate`
- If any field is empty: add `.invalid` class, show error `"Harap isi semua field yang wajib."`, block download
- On subsequent attempts, remove `.invalid` class from fields that are now filled

**Note**: No `required` HTML attribute or asterisks — the existing placeholder text and label convention is sufficient.

## File changes

| File | Change |
|------|--------|
| `public/preview.html` | CSS: add `--input-bg`, update `.activity-input`, add `.invalid` |
| `public/preview.html` | JS `renderTable()`: `\u2014` → `"---"`, center alignment on placeholders |
| `public/preview.html` | JS download handler: add validation before FormData construction |
