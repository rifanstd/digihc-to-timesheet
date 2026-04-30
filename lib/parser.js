const { PDFParse } = require('pdf-parse');

const INDONESIAN_MONTHS = {
  'Januari': 0, 'Februari': 1, 'Maret': 2, 'April': 3,
  'Mei': 4, 'Juni': 5, 'Juli': 6, 'Agustus': 7,
  'September': 8, 'Oktober': 9, 'November': 10, 'Desember': 11
};

const MONTH_NAMES = Object.keys(INDONESIAN_MONTHS).join('|');
const DATE_REGEX = new RegExp(`(\\d{2})\\s+(${MONTH_NAMES})\\s+(\\d{4})`);
const TIME_REGEX = /(\d{2}:\d{2}:\d{2})/g;
const DATA_LINE_REGEX = /^(\d{2}:\d{2}:\d{2}|-)\t/;

function parseIndonesianDate(dateStr) {
  const match = dateStr.match(DATE_REGEX);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = INDONESIAN_MONTHS[match[2]];
  const year = parseInt(match[3], 10);
  return new Date(year, month, day);
}

function dateToExcelSerial(date) {
  // Build UTC midnight from local date components to avoid timezone shift
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const epoch = Date.UTC(1899, 11, 30);
  const days = Math.round((utcDate - epoch) / 86400000);
  let serial = days - 1;
  // Excel bug: 1900 is treated as a leap year (serial 60 exists but Feb 29 1900 does not)
  if (serial >= 60) serial += 1;
  return serial;
}

function timeToExcelFraction(timeStr) {
  const [h, m, s] = timeStr.split(':').map(Number);
  return (h * 3600 + m * 60 + s) / 86400;
}

function serialToIndonesianDate(serial) {
  let s = serial;
  if (s > 60) s -= 1;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = s * 86400000 + epoch;
  const jsDate = new Date(ms);
  const day = String(jsDate.getUTCDate()).padStart(2, '0');
  const monthName = Object.keys(INDONESIAN_MONTHS)[jsDate.getUTCMonth()];
  const year = jsDate.getUTCFullYear();
  return `${day} ${monthName} ${year}`;
}

async function parsePdf(buffer) {
  const pdf = new PDFParse(new Uint8Array(buffer));
  const result = await pdf.getText();
  const text = result.pages[0].text;

  const lines = text.split('\n');
  const records = [];
  const errors = [];

  for (const line of lines) {
    if (!DATA_LINE_REGEX.test(line)) continue;

    const dateMatch = line.match(DATE_REGEX);
    if (!dateMatch) {
      errors.push('Could not parse date from line: ' + line.substring(0, 80));
      continue;
    }

    const date = parseIndonesianDate(dateMatch[0]);
    if (!date) {
      errors.push('Invalid date: ' + dateMatch[0]);
      continue;
    }

    const excelSerial = dateToExcelSerial(date);
    const timeMatches = line.match(TIME_REGEX);

    let checkIn = null;
    let checkOut = null;
    let hasData = false;

    if (timeMatches && timeMatches.length >= 2) {
      // First time in the actual data section is check-in, second is check-out
      // But the schedule also has time ranges like "08:00-17:00"
      // The data fields are tab-separated; field 1 is checkOut
      const fields = line.split('\t');
      const checkOutCandidate = fields[0];

      // Find check-in: the time that appears after the date in field 2
      const afterDate = line.substring(dateMatch.index + dateMatch[0].length);
      const checkInMatch = afterDate.match(TIME_REGEX);

      if (TIME_REGEX.test(checkOutCandidate) && checkInMatch) {
        checkOut = checkOutCandidate;
        checkIn = checkInMatch[0];
        hasData = true;
      }
    }

    const statusMatch = line.match(/ (H|LIB|TK)(\t|$)/);
    records.push({
      excelSerial,
      date: dateMatch[0],
      checkIn,
      checkOut,
      hasData,
      status: statusMatch ? statusMatch[1] : null
    });
  }

  return { records, errors };
}

function getRecordMonth(records) {
  if (!records || records.length === 0) return null;
  const date = parseIndonesianDate(records[0].date);
  if (!date) return null;
  return { month: date.getMonth(), year: date.getFullYear() };
}

module.exports = { parsePdf, dateToExcelSerial, timeToExcelFraction, getRecordMonth, serialToIndonesianDate };
