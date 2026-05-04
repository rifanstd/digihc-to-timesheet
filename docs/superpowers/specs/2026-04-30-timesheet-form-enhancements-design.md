# Timesheet Form & Filler Enhancements

## Overview

Extend the existing DigiHC-to-Timesheet converter with additional fields, remove deprecated
metadata/columns, and populate signature/approval sections.

## Template Layout Reference (1-indexed)

### Header section

| Row | Col A (label)        | Col C (value)       |
|-----|----------------------|---------------------|
| 1   | NAME of PROJECT      | `: Project Name`    |
| 2   | UNIT/DIVISION        | `: Unit`            |
| 3   | NAME                 | `: Name`            |
| 4   | MII ID               | `: MII ID`          |
| 5   | SITE                 | `: Site`            |

### Data columns

| Column | Letter | Purpose              |
|--------|--------|----------------------|
| 1      | A      | Date (serial)        |
| 2      | B      | Check-in             |
| 3      | C      | Check-out            |
| 4      | D      | Total hours          |
| 5      | E      | Status ("P")         |
| 11     | K      | Activity/Remark      |
| 12     | L      | Project Name         |
| 13     | M      | Project ID           |
| 14     | N      | Aplikasi Terdampak   |
| 15     | O      | AIP Fitur            |
| 16     | P      | Divisi               |
| 17     | Q      | Departement          |
| 18     | R      | Sub Departement      |

### Signature section

| Row | Col A               | Col D               | Col G               |
|-----|---------------------|---------------------|---------------------|
| 41  | TTD PEGAWAI,        | DI PERIKSA OLEH,    | DISETUJUI OLEH,     |
| 42  | `(      )`          | `(   )`             | `(    )`            |
| 46  | DATE :              | DATE :              | DATE :              |

## Changes

### 1. Frontend — Per-row columns in activity table

Add 4 new columns to `#activityTable` after "Aktivitas":

- Project Name → column L
- Project ID → column M
- Aplikasi Terdampak → column N
- AIP Fitur → column O

Each column gets a text `<input>` only on **H (hadir)** rows. Placeholder text matches the
column header. Non-H rows show `—`.

Data is collected on download and sent to `/convert` as part of the `activities` JSON array
(extended with `projectName`, `projectId`, `affectedApp`, `aipFeature`).

### 2. Frontend — Metadata form

- **Remove PDF pre-fill** for Unit/Divisi (`#inputUnit`) and MII ID (`#inputMiiId`). Fields
  remain but default to empty instead of being populated from `previewData.metadata`.
- **Add Manager Name** input: label "Nama Manager (Diperiksa Oleh)", field `#inputManagerName`.
- **Add Department Head Name** input: label "Nama Kepala Departemen (Disetujui Oleh)",
  field `#inputDeptHeadName`.
- Both sent in `headerFields` as `managerName` and `deptHeadName`.

### 3. Backend — `fillTimesheet` changes

#### 3a. Delete column R

After loading the workbook, delete column R (18th column, 1-indexed):

```js
ws.spliceColumns(18, 1);
```

This removes the "Sub Departement" header and all data in column R. `LAST_COL` constant
changes from 18 to 17. All fill/font loops adjusted.

#### 3b. Per-row fields (L-O) for H days

On rows where `record.hasData === true`, write per-row values from the extended activities map:

| Column | Field          |
|--------|----------------|
| 12     | projectName    |
| 13     | projectId      |
| 14     | affectedApp    |
| 15     | aipFeature     |

#### 3c. Signature section

| Cell | Value                                      | Source                     |
|------|--------------------------------------------|----------------------------|
| A42  | `( <headerFields.name> )`                  | Name field                 |
| D42  | `( <headerFields.managerName> )`           | New Manager Name input     |
| G42  | `( <headerFields.deptHeadName> )`          | New Dept Head Name input   |

#### 3d. Remove unit and MII ID from header fill

Stop writing `headerFields.unit` to row 2 and `headerFields.miiId` to row 4.
Only `projectName` (row 1), `name` (row 3), and `site` (row 5) are written.
If needed, keep the loop but skip unit and miiId keys.

### 4. Backend — `/convert` endpoint

- Accept `managerName` and `deptHeadName` in `headerFields` parsing.
- Accept `projectName`, `projectId`, `affectedApp`, `aipFeature` in the `activities` JSON.

### 5. Backend — `/preview` endpoint

No changes. PDF metadata parsing remains the same. Frontend simply ignores the
auto-populated values for unit/miiId.

### 6. Column deletion side effects

After `spliceColumns(18, 1)`, all columns to the right shift left by one (former S→R,
former T→S, etc.). Since the template has columns up to W, this is safe. No data
in columns beyond R is currently written by the filler, so no content is lost.

## Files modified

| File                 | Changes                                              |
|----------------------|------------------------------------------------------|
| `public/index.html`  | Add per-row columns, add manager/dept head inputs, remove PDF pre-fill |
| `lib/filler.js`      | Delete col R, fill L-O, fill signature cells, remove unit/miiId fill |
| `server.js`          | Accept new fields in `/convert`                      |
