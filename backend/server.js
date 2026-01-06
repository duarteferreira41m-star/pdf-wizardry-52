const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const jsPDF = require('jspdf');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const { createWorker } = require('tesseract.js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExts = new Set([
      '.jpeg', '.jpg', '.png', '.gif', '.webp',
      '.pdf', '.docx', '.xlsx', '.xls', '.txt', '.csv'
    ]);
    const allowedMimes = new Set([
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/plain', 'text/csv'
    ]);
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isAllowed = allowedExts.has(ext) || allowedMimes.has(mime);

    if (isAllowed) {
      return cb(null, true);
    }
    cb(new Error('Tipo de arquivo nao suportado'));
  }
});

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'PDF Wizardry Backend is running' });
});

// Create PDF
app.post('/api/create-pdf', upload.fields([
  { name: 'documents', maxCount: 10 },
  { name: 'images', maxCount: 10 }
]), async (req, res) => {
  try {
    const documents = req.files.documents || [];
    const images = req.files.images || [];
    
    if (documents.length === 0 && images.length === 0) {
      return res.status(400).json({ error: 'Adicione imagens ou documentos para gerar o PDF' });
    }

    const pdf = new jsPDF();
    let yPosition = 20;

    // Process documents
    let extractedText = '';
    for (const doc of documents) {
      const text = await extractTextFromDocument(doc);
      if (text) {
        extractedText += (extractedText ? '\n\n' : '') + text;
      }
    }

    // Add extracted text
    if (extractedText.trim()) {
      const lines = pdf.splitTextToSize(extractedText, 170);
      pdf.text(lines, 20, yPosition);
      yPosition += lines.length * 7;
      
      if (images.length > 0 && yPosition < 270) {
        yPosition += 10;
      }
    }

    // Add images
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imgData = `data:${img.mimetype};base64,${img.buffer.toString('base64')}`;
      const imgType = getJsPdfImageType(img.mimetype, img.originalname);

      if (i === 0) {
        if (images.length > 1) {
          pdf.addPage();
          yPosition = 20;
        } else if (extractedText.trim() && yPosition > 100) {
          pdf.addPage();
          yPosition = 20;
        }
      } else {
        pdf.addPage();
        yPosition = 20;
      }

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth() - 40;
      let pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const pageHeight = pdf.internal.pageSize.getHeight() - 40;
      if (pdfHeight > pageHeight) {
        const scale = pageHeight / pdfHeight;
        pdfHeight *= scale;
      }

      pdf.addImage(imgData, imgType, 20, yPosition, pdfWidth, pdfHeight);
    }

    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=documento.pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error creating PDF:', error);
    res.status(500).json({ error: 'Erro ao gerar o PDF' });
  }
});

// Merge PDFs
app.post('/api/merge-pdfs', upload.array('pdfs', 10), async (req, res) => {
  try {
    const pdfFiles = req.files;
    
    if (!pdfFiles || pdfFiles.length < 2) {
      return res.status(400).json({ error: 'Adicione pelo menos 2 PDFs para juntar' });
    }

    const mergedPdf = await PDFDocument.create();

    for (const file of pdfFiles) {
      const pdf = await PDFDocument.load(file.buffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=documento-mesclado.pdf');
    res.send(Buffer.from(mergedPdfBytes));
  } catch (error) {
    console.error('Error merging PDFs:', error);
    res.status(500).json({ error: 'Erro ao mesclar os PDFs' });
  }
});

// Split PDF
app.post('/api/split-pdf', upload.single('pdf'), async (req, res) => {
  try {
    const pdfFile = req.file;
    const selectedPages = req.body.selectedPages ? JSON.parse(req.body.selectedPages) : [];
    
    if (!pdfFile) {
      return res.status(400).json({ error: 'Arquivo PDF necessÃƒÆ’Ã‚Â¡rio' });
    }
    
    if (!selectedPages || selectedPages.length === 0) {
      return res.status(400).json({ error: 'Selecione pelo menos uma pÃƒÆ’Ã‚Â¡gina' });
    }

    const originalPdf = await PDFDocument.load(pdfFile.buffer);
    const newPdf = await PDFDocument.create();

    for (const pageNum of selectedPages) {
      const [copiedPage] = await newPdf.copyPages(originalPdf, [pageNum - 1]);
      newPdf.addPage(copiedPage);
    }

    const pdfBytes = await newPdf.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=documento-separado.pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Error splitting PDF:', error);
    res.status(500).json({ error: 'Erro ao processar o PDF' });
  }
});

// OCR
app.post('/api/ocr', upload.single('file'), async (req, res) => {
  let worker;
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Arquivo necessÃ‡Â­rio' });
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const isPdf = file.mimetype === 'application/pdf' || extension === '.pdf';

    worker = await createWorker('por', 1);

    if (isPdf) {
      const pageImages = await renderPdfToPngBuffers(file.buffer);
      let fullText = '';

      for (let i = 0; i < pageImages.length; i++) {
        const { data: { text } } = await worker.recognize(pageImages[i]);
        const trimmed = (text || '').trim();
        if (!trimmed) {
          continue;
        }
        if (fullText) {
          fullText += `\n\n--- Page ${i + 1} ---\n\n`;
        }
        fullText += trimmed;
      }

      res.json({ text: fullText });
    } else {
      const { data: { text } } = await worker.recognize(file.buffer);
      res.json({ text });
    }
  } catch (error) {
    console.error('Error processing OCR:', error);
    res.status(500).json({ error: 'Erro ao processar o arquivo' });
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
});

// Helper function to extract text from documents
async function extractTextFromDocument(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  
  try {
    if (extension === '.docx') {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    } else if (extension === '.xlsx' || extension === '.xls') {
      const workbook = XLSX.read(file.buffer);
      let text = '';
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        text += XLSX.utils.sheet_to_txt(worksheet) + '\n';
      });
      return text;
    } else if (extension === '.txt' || extension === '.csv') {
      return file.buffer.toString('utf-8');
    } else {
      return '';
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    return '';
  }
}

function getJsPdfImageType(mimetype, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  if (mimetype === 'image/png' || ext === '.png') return 'PNG';
  if (mimetype === 'image/webp' || ext === '.webp') return 'WEBP';
  return 'JPEG';
}

async function renderPdfToPngBuffers(pdfBuffer) {
  let pdfjsLib;
  let createCanvas;

  try {
    pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    ({ createCanvas } = require('canvas'));
  } catch (error) {
    throw new Error('PDF OCR requires "pdfjs-dist" and "canvas" dependencies.');
  }

  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer, disableWorker: true });
  const pdf = await loadingTask.promise;
  const buffers = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({ canvasContext: context, viewport }).promise;
    buffers.push(canvas.toBuffer('image/png'));
  }

  return buffers;
}
// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande (mÃƒÆ’Ã‚Â¡ximo 10MB)' });
    }
  }
  res.status(500).json({ error: error.message });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
