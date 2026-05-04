const ExcelJS = require('exceljs');
const { dateToExcelSerial, timeToExcelFraction, getRecordMonth } = require('./parser');

function detectLayout(ws) {
  const dates = [];

  for (let row = 9; row <= ws.rowCount; row++) {
    const val = ws.getCell(row, 1).value;
    if (val === null || val === undefined) break;

    if (val instanceof Date) {
      dates.push({ row, month: val.getMonth(), year: val.getFullYear() });
    } else if (typeof val === 'number') {
      let serial = val;
      if (serial > 60) serial -= 1;
      const epoch = Date.UTC(1899, 11, 30);
      const ms = serial * 86400000 + epoch;
      const jsDate = new Date(ms);
      dates.push({ row, month: jsDate.getUTCMonth(), year: jsDate.getUTCFullYear() });
    } else {
      break;
    }
  }

  if (dates.length === 0) {
    const err = new Error('Tidak ada baris tanggal yang terdeteksi di template');
    err.statusCode = 422;
    throw err;
  }

  return {
    month: dates[0].month,
    year: dates[0].year,
    dataStart: dates[0].row,
    dataEnd: dates[dates.length - 1].row,
    formulaRow: dates[dates.length - 1].row + 1,
    dayCount: dates.length
  };
}

async function previewTemplate(templateBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const ws = wb.getWorksheet(1);

  const layout = detectLayout(ws);

  const rows = [];
  for (let row = layout.dataStart; row <= layout.dataEnd; row++) {
    const dateCell = ws.getCell(row, 1);
    const dateVal = dateCell.value;

    let serial;
    if (dateVal instanceof Date) {
      serial = dateToExcelSerial(dateVal);
    } else if (typeof dateVal === 'number') {
      serial = dateVal;
    } else {
      continue;
    }

    const kCell = ws.getCell(row, 11);
    const activity = (kCell.value && typeof kCell.value === 'string' && kCell.value.trim() !== '')
      ? kCell.value
      : null;

    rows.push({ serial, activity });
  }

  return { month: layout.month, year: layout.year, rows };
}

async function fillTimesheet(templateBuffer, records, activitiesMap, headerFields = {}, rowFields = {}) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const ws = wb.getWorksheet(1);
  ws.spliceColumns(18, 1);

  if (headerFields) {
    const HEADER_ROWS = {
      projectName: 1,
      unit: 2,
      name: 3,
      miiId: 4,
      site: 5
    };

    for (const [key, rowNum] of Object.entries(HEADER_ROWS)) {
      const value = headerFields[key];
      if (value) {
        const cell = ws.getCell(rowNum, 3);
        cell.value = ': ' + value;
      }
    }

    if (headerFields.name) {
      ws.getCell(42, 1).value = '( ' + headerFields.name + ' )';
    }
    if (headerFields.managerName) {
      ws.getCell(42, 4).value = '( ' + headerFields.managerName + ' )';
    }
    if (headerFields.deptHeadName) {
      ws.getCell(42, 7).value = '( ' + headerFields.deptHeadName + ' )';
    }
  }

  const layout = detectLayout(ws);

  const pdfMonth = getRecordMonth(records);
  if (!pdfMonth) {
    const err = new Error('Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?');
    err.statusCode = 422;
    throw err;
  }

  if (pdfMonth.month !== layout.month || pdfMonth.year !== layout.year) {
    const INDONESIAN_MONTHS_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const err = new Error(
      `Bulan tidak cocok: PDF bulan ${INDONESIAN_MONTHS_NAMES[pdfMonth.month]} ${pdfMonth.year}, ` +
      `template bulan ${INDONESIAN_MONTHS_NAMES[layout.month]} ${layout.year}`
    );
    err.statusCode = 422;
    throw err;
  }

  const recordMap = {};
  for (const r of records) {
    recordMap[r.excelSerial] = r;
  }

  let presentCount = 0;

  for (let row = layout.dataStart; row <= layout.dataEnd; row++) {
    const dateCell = ws.getCell(row, 1);
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
    if (!record) continue;

    if (record.hasData) {
      const checkInFrac = timeToExcelFraction(record.checkIn);
      const checkOutFrac = timeToExcelFraction(record.checkOut);

      ws.getCell(row, 2).value = checkInFrac;
      ws.getCell(row, 3).value = checkOutFrac;
      ws.getCell(row, 4).value = checkOutFrac - checkInFrac;
      ws.getCell(row, 5).value = 'P';

      if (rowFields.divisi) {
        const divCell = ws.getCell(row, 16);
        divCell.value = rowFields.divisi;
        divCell.font = { bold: true };
        divCell.alignment = { horizontal: 'center' };
      }
      if (rowFields.departement) {
        const depCell = ws.getCell(row, 17);
        depCell.value = rowFields.departement;
        depCell.font = { bold: true };
        depCell.alignment = { horizontal: 'center' };
      }

      if (activitiesMap && activitiesMap.has(rowSerial)) {
        const ext = activitiesMap.get(rowSerial);
        if (ext.activity) {
          const activityCell = ws.getCell(row, 11);
          activityCell.value = ext.activity;
          const existingFont = activityCell.font || {};
          activityCell.font = { ...existingFont, bold: true };
        }
        if (ext.projectName) ws.getCell(row, 12).value = ext.projectName;
        if (ext.projectId) ws.getCell(row, 13).value = ext.projectId;
        if (ext.affectedApp) ws.getCell(row, 14).value = ext.affectedApp;
        if (ext.aipFeature) ws.getCell(row, 15).value = ext.aipFeature;
      } else {
        const remarkCell = ws.getCell(row, 11);
        if (!remarkCell.value || remarkCell.value === '') {
          remarkCell.value = null;
        }
      }

      presentCount++;
    } else {
      for (let c = 2; c <= 10; c++) {
        ws.getCell(row, c).value = null;
      }
      if (record.status === 'S') {
        ws.getCell(row, 6).value = 'S';
        ws.getCell(row, 11).value = 'Sakit';
      } else {
        ws.getCell(row, 11).value = null;
      }
    }
  }

  const LAST_COL = 17;

  for (let r = layout.dataStart; r <= layout.dataEnd; r++) {
    const dateCell = ws.getCell(r, 1);

    let fillColor = 'FFFFFFFF';
    if (dateCell.value) {
      let rowSerial;
      if (dateCell.value instanceof Date) {
        rowSerial = dateToExcelSerial(dateCell.value);
      } else if (typeof dateCell.value === 'number') {
        rowSerial = dateCell.value;
      }
      if (rowSerial != null) {
        const record = recordMap[rowSerial];
        if (record && record.status === 'LIB') {
          fillColor = 'FFBFBFBF';
        }
      }
    }

    for (let c = 1; c <= LAST_COL; c++) {
      const cell = ws.getCell(r, c);
      const sx = cell.style || {};
      cell.style = {
        ...sx,
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fillColor }
        }
      };
    }
  }

  for (let r = 1; r <= layout.formulaRow; r++) {
    for (let c = 1; c <= LAST_COL; c++) {
      const cell = ws.getCell(r, c);
      const existingFont = cell.font || {};
      cell.font = { ...existingFont, size: 9 };
      const existingAlign = cell.alignment || {};
      cell.alignment = { ...existingAlign, wrapText: true };
    }
  }

  // COUNTIF formula in the row below last data row
  const totalCell = ws.getCell(layout.formulaRow, 5);
  totalCell.value = {
    formula: `COUNTIF(E${layout.dataStart}:E${layout.dataEnd},"P")`,
    result: presentCount
  };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { fillTimesheet, previewTemplate };
