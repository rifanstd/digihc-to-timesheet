const express = require('express');
const multer = require('multer');
const path = require('path');
const { parsePdf, getRecordMonth, serialToIndonesianDate } = require('./lib/parser');
const { fillTimesheet, previewTemplate } = require('./lib/filler');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.post('/preview', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'template', maxCount: 1 }
]), async (req, res) => {
  try {
    const pdfFile = req.files['pdf']?.[0];
    const templateFile = req.files['template']?.[0];

    if (!pdfFile || !templateFile) {
      return res.status(400).json({ error: 'File PDF dan template harus diunggah.' });
    }

    const { records, errors } = await parsePdf(pdfFile.buffer);

    if (records.length === 0) {
      return res.status(422).json({ error: 'Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?' });
    }

    const layout = await previewTemplate(templateFile.buffer);

    const pdfMonth = getRecordMonth(records);
    if (pdfMonth && (pdfMonth.month !== layout.month || pdfMonth.year !== layout.year)) {
      const INDONESIAN_MONTHS_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return res.status(422).json({
        error: `Bulan tidak cocok: PDF bulan ${INDONESIAN_MONTHS_NAMES[pdfMonth.month]} ${pdfMonth.year}, ` +
               `template bulan ${INDONESIAN_MONTHS_NAMES[layout.month]} ${layout.year}`
      });
    }

    const recordMap = {};
    for (const r of records) {
      recordMap[r.excelSerial] = r;
    }

    const rows = layout.rows.map(lr => {
      const rec = recordMap[lr.serial];
      return {
        serial: lr.serial,
        date: rec ? rec.date : serialToIndonesianDate(lr.serial),
        checkIn: rec && rec.hasData ? rec.checkIn : null,
        checkOut: rec && rec.hasData ? rec.checkOut : null,
        status: rec ? rec.status : null,
        activity: lr.activity
      };
    });

    res.json({ month: { month: layout.month, year: layout.year }, rows });
  } catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Terjadi kesalahan internal server' });
  }
});

app.post('/convert', upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'template', maxCount: 1 }
]), async (req, res) => {
  try {
    const pdfFile = req.files['pdf']?.[0];
    const templateFile = req.files['template']?.[0];

    if (!pdfFile || !templateFile) {
      return res.status(400).json({ error: 'File PDF dan template harus diunggah.' });
    }

    let activitiesMap = null;
    if (req.body.activities) {
      try {
        const activities = JSON.parse(req.body.activities);
        activitiesMap = new Map();
        for (const a of activities) {
          if (a.activity && a.serial != null) {
            activitiesMap.set(a.serial, a.activity);
          }
        }
      } catch {
        return res.status(400).json({ error: 'Format data aktivitas tidak valid' });
      }
    }

    const { records, errors } = await parsePdf(pdfFile.buffer);

    if (records.length === 0) {
      return res.status(422).json({ error: 'Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?' });
    }

    const outputBuffer = await fillTimesheet(templateFile.buffer, records, activitiesMap);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="timesheet-filled.xlsx"');
    res.send(outputBuffer);
  } catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Terjadi kesalahan internal server' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
