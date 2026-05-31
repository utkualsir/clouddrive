import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

const router = Router();
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// GET /api/share/:token — get shared file info (public)
router.get('/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    if (token === 'verify') { res.status(400).json({ success: false, error: 'Invalid token' }); return; }

    const file = await prisma.file.findUnique({
      where: { shareToken: token },
      include: { user: { select: { displayName: true } } },
    });

    if (!file || file.isTrashed) {
      res.status(404).json({ success: false, error: 'Share link not found or has been removed' });
      return;
    }
    if (file.shareExpires && file.shareExpires < new Date()) {
      res.status(410).json({ success: false, error: 'This share link has expired' });
      return;
    }

    // Increment view count (non-blocking)
    prisma.file.update({ where: { id: file.id }, data: { shareViews: { increment: 1 } } }).catch(() => null);

    res.json({
      success: true,
      data: {
        id: file.id,
        name: file.name,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size.toString(),
        uploaderName: file.user.displayName,
        hasPassword: !!file.sharePassword,
        shareExpires: file.shareExpires,
        shareViews: file.shareViews,
        createdAt: file.createdAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch share info' });
  }
});

// POST /api/share/:token/verify — verify password and return file info
router.post('/:token/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body as { password?: string };

    const file = await prisma.file.findUnique({
      where: { shareToken: token },
      include: { user: { select: { displayName: true } } },
    });

    if (!file || file.isTrashed) {
      res.status(404).json({ success: false, error: 'Share link not found' });
      return;
    }
    if (file.shareExpires && file.shareExpires < new Date()) {
      res.status(410).json({ success: false, error: 'This share link has expired' });
      return;
    }
    if (!file.sharePassword) {
      res.json({ success: true, data: { verified: true, fileName: file.name, fileSize: file.size.toString(), mimeType: file.mimeType } });
      return;
    }
    if (!password) {
      res.status(401).json({ success: false, error: 'Password required' });
      return;
    }
    const match = await bcrypt.compare(password, file.sharePassword);
    if (!match) {
      res.status(401).json({ success: false, error: 'Incorrect password' });
      return;
    }
    res.json({ success: true, data: { verified: true, fileName: file.name, fileSize: file.size.toString(), mimeType: file.mimeType } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// GET /api/share/:token/qr — return QR code as base64 data URL
router.get('/:token/qr', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const file = await prisma.file.findUnique({ where: { shareToken: token } });
    if (!file) { res.status(404).json({ success: false, error: 'Share link not found' }); return; }

    const shareUrl = `${FRONTEND_URL}/share/${token}`;
    const dataUrl = await QRCode.toDataURL(shareUrl, { width: 160, margin: 1 });
    res.json({ success: true, data: { qrCode: dataUrl, shareUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

// POST /api/share/:token/download — download shared file (public, password check if needed)
router.post('/:token/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { password } = req.body as { password?: string };

    const file = await prisma.file.findUnique({ where: { shareToken: token } });
    if (!file || file.isTrashed) {
      res.status(404).json({ success: false, error: 'Share link not found' });
      return;
    }
    if (file.shareExpires && file.shareExpires < new Date()) {
      res.status(410).json({ success: false, error: 'This share link has expired' });
      return;
    }
    if (file.sharePassword) {
      if (!password) { res.status(401).json({ success: false, error: 'Password required' }); return; }
      const match = await bcrypt.compare(password, file.sharePassword);
      if (!match) { res.status(401).json({ success: false, error: 'Incorrect password' }); return; }
    }

    if (!fs.existsSync(file.storagePath)) {
      res.status(404).json({ success: false, error: 'File not found on disk' });
      return;
    }

    await prisma.file.update({ where: { id: file.id }, data: { downloadCount: { increment: 1 } } });
    res.download(path.resolve(file.storagePath), file.originalName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Download failed' });
  }
});

export default router;
