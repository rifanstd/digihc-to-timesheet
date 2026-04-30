const express = require('express');
const multer = require('multer');
const path = require('path');
const { parsePdf } = require('./lib/parser');
const { fillTimesheet } = require('./lib/filler');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

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

    const { records, errors } = await parsePdf(pdfFile.buffer);

    if (records.length === 0) {
      return res.status(422).json({ error: 'Data kehadiran tidak ditemukan di PDF. Apakah ini laporan DigiHC?' });
    }

    const outputBuffer = await fillTimesheet(templateFile.buffer, records);

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
