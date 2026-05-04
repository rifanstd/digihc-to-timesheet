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

function parseMetadata(text) {
  const lines = text.split('\n');
  const topLines = lines.slice(0, 15);
  
  let name = null;
  let unit = null;
  let miiId = null;
  
  let labelBlockEnded = false;
  let pastTimeZone = false;
  
  for (let i = 0; i < topLines.length; i++) {
    const line = topLines[i].trim();
    
    if (!labelBlockEnded) {
      if (line.startsWith('NPP / Nama')) labelBlockEnded = true;
      continue;
    }
    
    if (!name && line.length > 0 && line !== 'WIB' && !line.startsWith('Unit') && !line.startsWith('Time Zone')) {
      name = line;
      continue;
    }
    
    if (name && !pastTimeZone && line === 'WIB') {
      pastTimeZone = true;
      continue;
    }
    
    if (pastTimeZone && !unit && line.length > 0) {
      unit = line;
      continue;
    }
    
    if (unit && line.startsWith('/')) {
      miiId = line.replace('/', '').trim();
      break;
    }
  }
  
  return { name, unit, miiId };
}

async function parsePdf(buffer) {
  const pdf = new PDFParse(new Uint8Array(buffer));
  const result = await pdf.getText();
  const text = result.pages[0].text;
  const metadata = parseMetadata(text);

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

    if (timeMatches && timeMatches.length >= 1) {
      const fields = line.split('\t');
      const checkOutCandidate = fields[0];

      const afterDate = line.substring(dateMatch.index + dateMatch[0].length);
      const checkInMatch = afterDate.match(TIME_REGEX);

      if (checkInMatch) {
        checkIn = checkInMatch[0];
        hasData = true;

        if (TIME_REGEX.test(checkOutCandidate)) {
          checkOut = checkOutCandidate;
        } else {
          checkOut = '17:00:00';
        }
      }
    }

    const statusMatch = line.match(/ (H|LIB|TK|S)(\t|$)/);
    records.push({
      excelSerial,
      date: dateMatch[0],
      checkIn,
      checkOut,
      hasData,
      status: statusMatch ? statusMatch[1] : null
    });
  }

  return { records, errors, metadata };
}

function getRecordMonth(records) {
  if (!records || records.length === 0) return null;
  const date = parseIndonesianDate(records[0].date);
  if (!date) return null;
  return { month: date.getMonth(), year: date.getFullYear() };
}

module.exports = { parsePdf, parseMetadata, dateToExcelSerial, timeToExcelFraction, getRecordMonth, serialToIndonesianDate };
