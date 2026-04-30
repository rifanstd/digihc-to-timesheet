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

async function fillTimesheet(templateBuffer, records, activitiesMap) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);
  const ws = wb.getWorksheet(1);

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

      if (activitiesMap && activitiesMap.has(rowSerial)) {
        const activityCell = ws.getCell(row, 11);
        activityCell.value = activitiesMap.get(rowSerial);
        activityCell.font = { bold: true };
      } else {
        const remarkCell = ws.getCell(row, 11);
        if (!remarkCell.value || remarkCell.value === '') {
          remarkCell.value = null;
        }
      }

      presentCount++;
    } else {
      for (let c = 2; c <= 11; c++) {
        ws.getCell(row, c).value = null;
      }
    }
  }

  const LAST_COL = 18;

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

  // COUNTIF formula in the row below last data row
  const totalCell = ws.getCell(layout.formulaRow, 5);
  totalCell.value = {
    formula: `COUNTIF(E${layout.dataStart}:E${layout.dataEnd},"P")`,
    result: presentCount
  };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { fillTimesheet, previewTemplate };
