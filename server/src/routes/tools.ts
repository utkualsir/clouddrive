import { Router, Request, Response } from 'express';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import mammoth from 'mammoth';
import path from 'path';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// POST /api/tools/image-to-pdf
router.post('/image-to-pdf', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(req.file.mimetype)) {
    res.status(400).json({ success: false, error: 'Unsupported file type. Use JPEG, PNG, or WEBP.' });
    return;
  }
  try {
    const baseName = path.parse(req.file.originalname).name;
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
    doc.pipe(res);

    // A4: 595.28 x 841.89 pts
    doc.image(req.file.buffer, 0, 0, { fit: [595.28, 841.89], align: 'center', valign: 'center' });
    doc.end();
  } catch (err) {
    console.error('[tools] image-to-pdf error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Conversion failed' });
  }
});

// POST /api/tools/docx-to-pdf
router.post('/docx-to-pdf', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }
  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!['.docx', '.doc', '.txt'].includes(ext)) {
    res.status(400).json({ success: false, error: 'Unsupported file type. Use DOCX, DOC, or TXT.' });
    return;
  }
  try {
    let text = '';
    if (ext === '.txt') {
      text = req.file.buffer.toString('utf-8');
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    }

    const baseName = path.parse(req.file.originalname).name;
    const doc = new PDFDocument({ size: 'A4', margin: 50, autoFirstPage: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.pdf"`);
    doc.pipe(res);

    doc.font('Helvetica').fontSize(11).text(text || '(Empty document)', {
      width: 495,
      align: 'left',
      lineGap: 3,
    });
    doc.end();
  } catch (err) {
    console.error('[tools] docx-to-pdf error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Conversion failed' });
  }
});

// POST /api/tools/pdf-to-images — stub
router.post('/pdf-to-images', (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, error: 'Coming soon' });
});

// POST /api/tools/image-compress
router.post('/image-compress', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(req.file.mimetype)) {
    res.status(400).json({ success: false, error: 'Unsupported image type. Use JPEG, PNG, or WEBP.' });
    return;
  }
  const quality = Math.min(100, Math.max(1, parseInt((req.body.quality as string) ?? '80', 10)));
  try {
    const sharp = (await import('sharp')).default;
    let pipeline = sharp(req.file.buffer);

    if (req.file.mimetype === 'image/jpeg') {
      pipeline = pipeline.jpeg({ quality });
    } else if (req.file.mimetype === 'image/png') {
      pipeline = pipeline.png({ quality });
    } else {
      pipeline = pipeline.webp({ quality });
    }

    const compressed = await pipeline.toBuffer();
    const baseName = path.parse(req.file.originalname).name;
    const ext = path.extname(req.file.originalname);

    res.setHeader('Content-Type', req.file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}_compressed${ext}"`);
    res.setHeader('X-Original-Size', String(req.file.size));
    res.setHeader('X-Compressed-Size', String(compressed.length));
    res.send(compressed);
  } catch (err) {
    console.error('[tools] image-compress error:', err);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'Compression failed' });
  }
});

export default router;
