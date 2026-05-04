const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { parsePdf, getRecordMonth, serialToIndonesianDate } = require('./lib/parser');
const { fillTimesheet, previewTemplate } = require('./lib/filler');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

const sessions = new Map();
const SESSION_TTL = 15 * 60 * 1000;

function setTimer(id) {
  const session = sessions.get(id);
  if (!session) return;
  if (session.timer) clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    sessions.delete(id);
  }, SESSION_TTL);
}

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

    const { records, errors, metadata } = await parsePdf(pdfFile.buffer);

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

    const previewData = {
      month: { month: layout.month, year: layout.year },
      rows,
      metadata,
      defaults: {
        projectName: 'PT Bank Negara Indonesia (Persero) Tbk',
        site: 'BNI'
      }
    };

    const id = crypto.randomUUID();
    sessions.set(id, {
      pdfBuffer: pdfFile.buffer,
      templateBuffer: templateFile.buffer,
      records,
      previewData
    });

    setTimer(id);
    res.redirect('/preview/' + id);
  } catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Terjadi kesalahan internal server' });
  }
});

app.get('/preview/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(410).send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;background:#0d1117;color:#e6edf3"><h2>Sesi telah berakhir</h2><p>Silakan <a href="/" style="color:#58a6ff">unggah ulang</a> file PDF dan template.</p></body></html>');
  }
  setTimer(req.params.id);
  let html = fs.readFileSync(path.join(__dirname, 'public', 'preview.html'), 'utf8');
  const injected = html.replace('</head>',
    '<script>window.__PREVIEW_DATA__ = ' +
    JSON.stringify(session.previewData) +
    ';</script></head>');
  res.send(injected);
});

app.post('/convert/:id', upload.none(), async (req, res) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(410).json({ error: 'Sesi telah berakhir, silakan unggah ulang.' });
    }

    let activitiesMap = null;
    if (req.body.activities) {
      try {
        const activities = JSON.parse(req.body.activities);
        activitiesMap = new Map();
        for (const a of activities) {
          if (a.serial != null) {
            activitiesMap.set(a.serial, {
              activity: a.activity || null,
              projectName: a.projectName || null,
              projectId: a.projectId || null,
              affectedApp: a.affectedApp || null,
              aipFeature: a.aipFeature || null
            });
          }
        }
      } catch {
        return res.status(400).json({ error: 'Format data aktivitas tidak valid' });
      }
    }

    let headerFields = {
      projectName: 'PT Bank Negara Indonesia (Persero) Tbk',
      site: 'BNI',
      unit: '',
      name: '',
      miiId: '',
      managerName: '',
      deptHeadName: ''
    };
    if (req.body.headerFields) {
      try {
        const parsed = JSON.parse(req.body.headerFields);
        if (parsed.projectName) headerFields.projectName = parsed.projectName;
        if (parsed.site) headerFields.site = parsed.site;
        if (parsed.unit) headerFields.unit = parsed.unit;
        if (parsed.name) headerFields.name = parsed.name;
        if (parsed.miiId) headerFields.miiId = parsed.miiId;
        if (parsed.managerName) headerFields.managerName = parsed.managerName;
        if (parsed.deptHeadName) headerFields.deptHeadName = parsed.deptHeadName;
      } catch {
        return res.status(400).json({ error: 'Format data header tidak valid' });
      }
    }

    let rowFields = {
      divisi: '',
      departement: ''
    };
    if (req.body.rowFields) {
      try {
        const parsed = JSON.parse(req.body.rowFields);
        if (parsed.divisi) rowFields.divisi = parsed.divisi;
        if (parsed.departement) rowFields.departement = parsed.departement;
      } catch {
        return res.status(400).json({ error: 'Format data rowFields tidak valid' });
      }
    }

    const signatureDate = req.body.signatureDate || '';

    const outputBuffer = await fillTimesheet(session.templateBuffer, session.records, activitiesMap, headerFields, rowFields, signatureDate);

    if (session.timer) clearTimeout(session.timer);
    sessions.delete(req.params.id);

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
