import { Router, Response, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import bcrypt from 'bcryptjs';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { generateToken, awardBadge } from '../utils/helpers';
import { broadcastToAll, broadcastToUser, getConnectedClient } from '../websocket';
import { sendStorageWarningEmail } from '../services/emailService';
import { createNotification, NotificationType } from '../services/notificationService';

async function checkStorageWarning(prismaClient: PrismaClient, userId: string): Promise<void> {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { email: true, displayName: true, storageUsed: true, storageLimit: true, emailNotifications: true },
  });
  if (!user) return;
  const pct = Math.floor(Number(user.storageUsed) / Number(user.storageLimit) * 100);
  if (pct >= 80) {
    if (user.emailNotifications) {
      sendStorageWarningEmail(
        user.email,
        user.displayName,
        pct,
        `${(Number(user.storageUsed) / 1073741824).toFixed(2)} GB`,
        `${(Number(user.storageLimit) / 1073741824).toFixed(2)} GB`,
      ).catch(console.error);
    }
    createNotification(
      userId,
      null,
      NotificationType.STORAGE_WARNING,
      `You're using ${pct}% of your storage. Consider upgrading your plan.`,
      `/settings?tab=billing`,
    ).catch(console.error);
  }
}

const router = Router();
const prisma = new PrismaClient();

const EDITABLE_MIMES = [
  'text/plain', 'text/markdown', 'text/csv',
  'application/json', 'text/html', 'text/css', 'text/javascript',
];
const MAX_EDIT_SIZE = 5 * 1024 * 1024; // 5MB

// Helper: generate thumbnail using sharp
async function generateThumbnail(filePath: string, userId: string, fileId: string): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const thumbDir = path.join(process.env.UPLOAD_DIR ?? './uploads', userId, 'thumbs');
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });
    const thumbPath = path.join(thumbDir, `${fileId}.jpg`);
    await sharp(filePath).resize(200, 200, { fit: 'cover' }).jpeg({ quality: 80 }).toFile(thumbPath);
    return thumbPath;
  } catch {
    return null;
  }
}

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

router.use(authenticateToken);

// POST /upload — with FileVersion-based versioning + thumbnail
router.post('/upload', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: 'No file uploaded' }); return; }

    const userId = req.user!.id;
    const { folderId, visibility } = req.body as { folderId?: string; visibility?: string };
    const fileVisibility = ['PUBLIC', 'FRIENDS', 'PRIVATE'].includes(visibility ?? '') ? visibility! : 'PRIVATE';

    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder) { fs.unlinkSync(req.file.path); res.status(404).json({ success: false, error: 'Folder not found' }); return; }
      if (folder.userId !== userId) {
        const share = await prisma.folderShare.findFirst({ where: { folderId, sharedWithId: userId } });
        if (!share || share.permission === 'VIEW') {
          fs.unlinkSync(req.file.path);
          res.status(403).json({ success: false, error: 'Upload not permitted in this folder' });
          return;
        }
      }
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { fs.unlinkSync(req.file.path); res.status(404).json({ success: false, error: 'User not found' }); return; }

    const newStorageUsed = user.storageUsed + BigInt(req.file.size);
    if (newStorageUsed > user.storageLimit) {
      fs.unlinkSync(req.file.path);
      res.status(413).json({ success: false, error: 'Storage limit exceeded' });
      return;
    }

    // Check for existing file with same name in same folder (for versioning)
    const existing = await prisma.file.findFirst({
      where: { userId, folderId: folderId ?? null, name: req.file.originalname, isTrashed: false, parentFileId: null },
      include: { versions: { orderBy: { versionNumber: 'asc' } } },
    });

    let file;

    if (existing) {
      // Enforce max 5 versions (4 old + 1 current): delete oldest if at limit
      if (existing.versions.length >= 4) {
        const oldest = existing.versions[0];
        if (fs.existsSync(oldest.storagePath)) fs.unlinkSync(oldest.storagePath);
        await prisma.fileVersion.delete({ where: { id: oldest.id } });
      }

      // Save current file state as a new FileVersion
      await prisma.fileVersion.create({
        data: {
          fileId: existing.id,
          versionNumber: existing.currentVersion,
          storagePath: existing.storagePath,
          size: existing.size,
        },
      });

      // Generate thumbnail for new version if image
      let thumbnailPath = existing.thumbnailPath;
      if (IMAGE_MIMES.includes(req.file.mimetype)) {
        const newThumb = await generateThumbnail(req.file.path, userId, `${existing.id}-temp`);
        if (newThumb) {
          const finalThumb = path.join(path.dirname(newThumb), `${existing.id}.jpg`);
          if (fs.existsSync(newThumb)) fs.renameSync(newThumb, finalThumb);
          thumbnailPath = finalThumb;
        }
      }

      // Update file record with new content
      file = await prisma.file.update({
        where: { id: existing.id },
        data: {
          storagePath: req.file.path,
          size: BigInt(req.file.size),
          thumbnailPath,
          currentVersion: existing.currentVersion + 1,
          updatedAt: new Date(),
        },
      });

      // Old file is now a version on disk, new file is also on disk — add new file size
      await prisma.user.update({ where: { id: userId }, data: { storageUsed: { increment: BigInt(req.file.size) } } });

      await prisma.activity.create({ data: { userId, action: 'uploaded file', target: file.name } });

      // Badge: Storage Pro (1GB+) on version update
      const updatedUserV = await prisma.user.findUnique({ where: { id: userId }, select: { storageUsed: true } });
      if (updatedUserV && updatedUserV.storageUsed >= BigInt(1073741824)) await awardBadge(prisma, userId, 'storage_pro');

      checkStorageWarning(prisma, userId).catch(console.error);

      // WebSocket broadcast
      broadcastToAll({
        type: 'file_uploaded',
        fileName: file.name,
        fileSize: req.file.size,
        userId,
        displayName: user.displayName,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({
        success: true,
        data: { ...file, size: file.size.toString(), versionCount: file.currentVersion },
      });
      return;
    }

    // Generate thumbnail for images (new file)
    let thumbnailPath: string | null = null;
    if (IMAGE_MIMES.includes(req.file.mimetype)) {
      const tempId = `temp-${Date.now()}`;
      thumbnailPath = await generateThumbnail(req.file.path, userId, tempId);
    }

    const [newFile] = await prisma.$transaction([
      prisma.file.create({
        data: {
          name: req.file.originalname,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: BigInt(req.file.size),
          storagePath: req.file.path,
          thumbnailPath,
          folderId: folderId ?? null,
          userId,
          currentVersion: 1,
          visibility: fileVisibility,
        },
      }),
      prisma.user.update({ where: { id: userId }, data: { storageUsed: newStorageUsed } }),
    ]);

    // Rename thumbnail to use real fileId
    if (thumbnailPath) {
      const thumbDir = path.dirname(thumbnailPath);
      const newThumbPath = path.join(thumbDir, `${newFile.id}.jpg`);
      if (fs.existsSync(thumbnailPath)) fs.renameSync(thumbnailPath, newThumbPath);
      await prisma.file.update({ where: { id: newFile.id }, data: { thumbnailPath: newThumbPath } });
      (newFile as typeof newFile & { thumbnailPath: string | null }).thumbnailPath = newThumbPath;
    }

    await prisma.activity.create({ data: { userId, action: 'uploaded file', target: newFile.name } });

    // Badge: First Upload
    await awardBadge(prisma, userId, 'first_upload');
    // Badge: Power User (10+ files)
    const fileCount = await prisma.file.count({ where: { userId, isTrashed: false, parentFileId: null } });
    if (fileCount >= 10) await awardBadge(prisma, userId, 'power_user');
    // Badge: Storage Pro (1GB+)
    const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { storageUsed: true } });
    if (updatedUser && updatedUser.storageUsed >= BigInt(1073741824)) await awardBadge(prisma, userId, 'storage_pro');

    checkStorageWarning(prisma, userId).catch(console.error);

    // WebSocket broadcast
    broadcastToAll({
      type: 'file_uploaded',
      fileName: newFile.name,
      fileSize: req.file.size,
      userId,
      displayName: user.displayName,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      data: { ...newFile, size: newFile.size.toString(), versionCount: 1 },
    });
  } catch (err) {
    console.error(err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
});

// GET / — list files with optional search/filter/sort (supports shared folders)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { folderId, q, type, sortBy, dateRange, tagId, visibility } = req.query as {
      folderId?: string; q?: string; type?: string; sortBy?: string; dateRange?: string; tagId?: string; visibility?: string;
    };

    // Check if folderId belongs to another user but is shared with current user
    if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (folder && folder.userId !== userId) {
        const share = await prisma.folderShare.findFirst({
          where: { folderId, sharedWithId: userId },
        });
        if (!share) {
          res.status(403).json({ success: false, error: 'Access denied' });
          return;
        }
        // Return files in the shared folder (owned by folder owner)
        const files = await prisma.file.findMany({
          where: { folderId, isTrashed: false, parentFileId: null },
          orderBy: { createdAt: 'desc' },
        });
        res.json({
          success: true,
          data: files.map(f => ({ ...f, size: f.size.toString(), versionCount: f.currentVersion })),
        });
        return;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { userId, isTrashed: false, folderId: folderId ?? null, parentFileId: null };

    if (q) where.name = { contains: q };

    if (type && type !== 'all') {
      const docMimes = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'];
      const archiveMimes = ['application/zip','application/x-rar-compressed','application/x-7z-compressed','application/x-tar','application/gzip'];
      if (type === 'images') where.mimeType = { startsWith: 'image/' };
      else if (type === 'videos') where.mimeType = { startsWith: 'video/' };
      else if (type === 'audio') where.mimeType = { startsWith: 'audio/' };
      else if (type === 'documents') where.mimeType = { in: docMimes };
      else if (type === 'archives') where.mimeType = { in: archiveMimes };
    }

    if (dateRange && dateRange !== 'all') {
      const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 365;
      where.createdAt = { gte: new Date(Date.now() - days * 86400000) };
    }

    if (tagId) {
      where.tags = { some: { tagId } };
    }

    if (visibility && ['PUBLIC', 'FRIENDS', 'PRIVATE'].includes(visibility)) {
      where.visibility = visibility;
    }

    const orderByMap: Record<string, object> = {
      name_asc: { name: 'asc' }, name_desc: { name: 'desc' },
      newest: { createdAt: 'desc' }, oldest: { createdAt: 'asc' },
      largest: { size: 'desc' }, smallest: { size: 'asc' },
    };
    const orderBy = orderByMap[sortBy ?? ''] ?? { createdAt: 'desc' };

    const files = await prisma.file.findMany({ where, orderBy, include: { tags: { include: { tag: true } }, _count: { select: { likes: true } } } });

    res.json({
      success: true,
      data: files.map(({ _count, ...f }) => ({ ...f, size: f.size.toString(), versionCount: f.currentVersion, likeCount: _count.likes })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch files' });
  }
});

// GET /starred
router.get('/starred', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = await prisma.file.findMany({
      where: { userId: req.user!.id, isStarred: true, isTrashed: false, parentFileId: null },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { likes: true } } },
    });
    res.json({ success: true, data: files.map(({ _count, ...f }) => ({ ...f, size: f.size.toString(), versionCount: f.currentVersion, likeCount: _count.likes })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch starred files' });
  }
});

// GET /recent
router.get('/recent', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = await prisma.file.findMany({
      where: { userId: req.user!.id, isTrashed: false, parentFileId: null },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { _count: { select: { likes: true } } },
    });
    res.json({ success: true, data: files.map(({ _count, ...f }) => ({ ...f, size: f.size.toString(), versionCount: f.currentVersion, likeCount: _count.likes })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch recent files' });
  }
});

// GET /trash
router.get('/trash', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const [files, folders] = await Promise.all([
      prisma.file.findMany({ where: { userId, isTrashed: true }, orderBy: { trashedAt: 'desc' } }),
      prisma.folder.findMany({ where: { userId, isTrashed: true }, orderBy: { trashedAt: 'desc' } }),
    ]);
    res.json({
      success: true,
      data: {
        files: files.map(f => ({ ...f, size: f.size.toString(), versionCount: f.currentVersion })),
        folders,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch trash' });
  }
});

// GET /activity — user's own activity feed
router.get('/activity', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activities = await prisma.activity.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ success: true, data: activities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

// POST /activity/read — mark all as read
router.post('/activity/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.activity.updateMany({ where: { userId: req.user!.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
});

// POST /bulk/zip — download multiple files as ZIP
router.post('/bulk/zip', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!ids || ids.length === 0) { res.status(400).json({ success: false, error: 'No file IDs provided' }); return; }

    const files = await prisma.file.findMany({ where: { id: { in: ids }, userId: req.user!.id, isTrashed: false } });
    if (files.length === 0) { res.status(404).json({ success: false, error: 'No files found' }); return; }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="clouddrive-files.zip"');

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    for (const file of files) {
      if (fs.existsSync(file.storagePath)) {
        archive.file(path.resolve(file.storagePath), { name: file.originalName });
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ success: false, error: 'ZIP creation failed' });
  }
});

// POST /bulk/trash
router.post('/bulk/trash', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids = [], folderIds = [] } = req.body as { ids?: string[]; folderIds?: string[] };
    const userId = req.user!.id;
    const trashedAt = new Date();
    await Promise.all([
      ids.length > 0 && prisma.file.updateMany({ where: { id: { in: ids }, userId }, data: { isTrashed: true, trashedAt } }),
      folderIds.length > 0 && prisma.folder.updateMany({ where: { id: { in: folderIds }, userId }, data: { isTrashed: true, trashedAt } }),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to trash items' });
  }
});

// POST /bulk/restore
router.post('/bulk/restore', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids = [], folderIds = [] } = req.body as { ids?: string[]; folderIds?: string[] };
    const userId = req.user!.id;
    await Promise.all([
      ids.length > 0 && prisma.file.updateMany({ where: { id: { in: ids }, userId }, data: { isTrashed: false, trashedAt: null } }),
      folderIds.length > 0 && prisma.folder.updateMany({ where: { id: { in: folderIds }, userId }, data: { isTrashed: false, trashedAt: null } }),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to restore items' });
  }
});

// POST /bulk/star
router.post('/bulk/star', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids = [], folderIds = [] } = req.body as { ids?: string[]; folderIds?: string[] };
    const userId = req.user!.id;
    await Promise.all([
      ids.length > 0 && prisma.file.updateMany({ where: { id: { in: ids }, userId }, data: { isStarred: true } }),
      folderIds.length > 0 && prisma.folder.updateMany({ where: { id: { in: folderIds }, userId }, data: { isStarred: true } }),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to star items' });
  }
});

// POST /bulk/move
router.post('/bulk/move', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ids = [], folderIds = [], folderId } = req.body as { ids?: string[]; folderIds?: string[]; folderId: string | null };
    const userId = req.user!.id;
    if (folderId) {
      const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
      if (!folder) { res.status(404).json({ success: false, error: 'Folder not found' }); return; }
    }
    await Promise.all([
      ids.length > 0 && prisma.file.updateMany({ where: { id: { in: ids }, userId }, data: { folderId: folderId ?? null } }),
      folderIds.length > 0 && prisma.folder.updateMany({ where: { id: { in: folderIds }, userId }, data: { parentId: folderId ?? null } }),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to move items' });
  }
});

// POST /:id/like — toggle like
router.post('/:id/like', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const existing = await prisma.fileLike.findUnique({ where: { fileId_userId: { fileId: id, userId } } });
    if (existing) {
      await prisma.fileLike.delete({ where: { fileId_userId: { fileId: id, userId } } });
    } else {
      const file = await prisma.file.findFirst({ where: { id, isTrashed: false } });
      if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
      await prisma.fileLike.create({ data: { fileId: id, userId } });
    }
    const likeCount = await prisma.fileLike.count({ where: { fileId: id } });
    res.json({ success: true, data: { liked: !existing, likeCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to toggle like' });
  }
});

// GET /:id/likes
router.get('/:id/likes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const [likeCount, myLike] = await Promise.all([
      prisma.fileLike.count({ where: { fileId: id } }),
      prisma.fileLike.findUnique({ where: { fileId_userId: { fileId: id, userId } } }),
    ]);
    res.json({ success: true, data: { likeCount, isLiked: !!myLike } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch likes' });
  }
});

// PUT /:id/view — increment view count (fire-and-forget from client)
router.put('/:id/view', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.file.updateMany({ where: { id, userId: req.user!.id }, data: { viewCount: { increment: 1 } } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to record view' });
  }
});

// GET /my-likes — all file IDs the current user has liked
router.get('/my-likes', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const likes = await prisma.fileLike.findMany({ where: { userId: req.user!.id }, select: { fileId: true } });
    res.json({ success: true, data: likes.map(l => l.fileId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch liked files' });
  }
});

// GET /:id/content — read editable file content
router.get('/:id/content', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    if (!EDITABLE_MIMES.includes(file.mimeType)) {
      res.status(415).json({ success: false, error: 'File type not editable' });
      return;
    }
    if (!fs.existsSync(file.storagePath)) {
      res.status(404).json({ success: false, error: 'File not found on disk' });
      return;
    }
    const stat = fs.statSync(file.storagePath);
    if (stat.size > MAX_EDIT_SIZE) {
      res.status(413).json({ success: false, error: 'File too large to edit (max 5MB)' });
      return;
    }
    const content = fs.readFileSync(file.storagePath, 'utf-8');
    res.json({ success: true, data: { content, encoding: 'utf-8', name: file.name, mimeType: file.mimeType } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to read file' });
  }
});

// PUT /:id/content — write editable file content
router.put('/:id/content', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { content } = req.body as { content: string };
    if (typeof content !== 'string') {
      res.status(400).json({ success: false, error: 'Content must be a string' });
      return;
    }
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    if (!EDITABLE_MIMES.includes(file.mimeType)) {
      res.status(415).json({ success: false, error: 'File type not editable' });
      return;
    }
    const newSize = Buffer.byteLength(content, 'utf-8');
    const sizeDelta = BigInt(newSize) - file.size;

    fs.writeFileSync(file.storagePath, content, 'utf-8');

    const updated = await prisma.file.update({
      where: { id },
      data: { size: BigInt(newSize), updatedAt: new Date() },
    });

    if (sizeDelta !== 0n) {
      await prisma.user.update({ where: { id: userId }, data: { storageUsed: { increment: sizeDelta } } });
    }

    await prisma.activity.create({ data: { userId, action: 'edited file', target: file.name } });

    res.json({ success: true, data: { newSize, updatedAt: updated.updatedAt } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to save file' });
  }
});

// GET /:id/versions — list FileVersion records
router.get('/:id/versions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }

    const versions = await prisma.fileVersion.findMany({
      where: { fileId: id },
      orderBy: { versionNumber: 'desc' },
    });

    res.json({
      success: true,
      data: {
        currentVersion: file.currentVersion,
        versions: versions.map(v => ({ ...v, size: v.size.toString() })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch versions' });
  }
});

// GET /:id/versions/:versionId/download — download a specific version
router.get('/:id/versions/:versionId/download', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, versionId } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }

    const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId: id } });
    if (!version) { res.status(404).json({ success: false, error: 'Version not found' }); return; }

    if (!fs.existsSync(version.storagePath)) {
      res.status(404).json({ success: false, error: 'Version file not found on disk' });
      return;
    }

    const ext = path.extname(file.originalName);
    const base = path.basename(file.originalName, ext);
    res.download(path.resolve(version.storagePath), `${base}_v${version.versionNumber}${ext}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Download failed' });
  }
});

// POST /:id/versions/:versionId/restore — restore old version as current
router.post('/:id/versions/:versionId/restore', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, versionId } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }

    const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId: id } });
    if (!version) { res.status(404).json({ success: false, error: 'Version not found' }); return; }

    // Save current as a new old version
    await prisma.fileVersion.create({
      data: {
        fileId: id,
        versionNumber: file.currentVersion,
        storagePath: file.storagePath,
        size: file.size,
      },
    });

    const sizeDelta = version.size - file.size;

    // Restore the old version's data as current
    const updated = await prisma.file.update({
      where: { id },
      data: {
        storagePath: version.storagePath,
        size: version.size,
        currentVersion: file.currentVersion + 1,
        updatedAt: new Date(),
      },
    });

    // Remove the restored version record
    await prisma.fileVersion.delete({ where: { id: versionId } });

    if (sizeDelta !== 0n) {
      await prisma.user.update({ where: { id: userId }, data: { storageUsed: { increment: sizeDelta } } });
    }

    await prisma.activity.create({ data: { userId, action: 'restored file version', target: file.name } });

    res.json({ success: true, data: { ...updated, size: updated.size.toString(), versionCount: updated.currentVersion } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to restore version' });
  }
});

// DELETE /:id/versions/:versionId — delete a specific old version
router.delete('/:id/versions/:versionId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, versionId } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }

    const version = await prisma.fileVersion.findFirst({ where: { id: versionId, fileId: id } });
    if (!version) { res.status(404).json({ success: false, error: 'Version not found' }); return; }

    if (fs.existsSync(version.storagePath)) fs.unlinkSync(version.storagePath);
    await prisma.fileVersion.delete({ where: { id: versionId } });
    await prisma.user.update({ where: { id: userId }, data: { storageUsed: { decrement: version.size } } });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete version' });
  }
});

// GET /:id/download
router.get('/:id/download', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    if (!fs.existsSync(file.storagePath)) { res.status(404).json({ success: false, error: 'File not found on disk' }); return; }
    await prisma.file.update({ where: { id }, data: { downloadCount: { increment: 1 } } });
    await prisma.activity.create({ data: { userId, action: 'downloaded file', target: file.name } });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    broadcastToAll({
      type: 'file_downloaded',
      fileName: file.name,
      userId,
      displayName: user?.displayName ?? 'User',
      timestamp: new Date().toISOString(),
    });

    res.download(path.resolve(file.storagePath), file.originalName);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Download failed' });
  }
});

// PUT /:id/visibility
router.put('/:id/visibility', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { visibility } = req.body as { visibility: string };
    if (!['PUBLIC', 'FRIENDS', 'PRIVATE'].includes(visibility)) {
      res.status(400).json({ success: false, error: 'Invalid visibility value' }); return;
    }
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    const updated = await prisma.file.update({ where: { id }, data: { visibility } });
    res.json({ success: true, data: { ...updated, size: updated.size.toString(), versionCount: updated.currentVersion } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update visibility' });
  }
});

// PUT /:id/star
router.put('/:id/star', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    const updated = await prisma.file.update({ where: { id }, data: { isStarred: !file.isStarred } });
    res.json({ success: true, data: { ...updated, size: updated.size.toString(), versionCount: updated.currentVersion } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to star file' });
  }
});

// PUT /:id/move
router.put('/:id/move', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { folderId } = req.body as { folderId: string | null };
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    if (folderId) {
      const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
      if (!folder) { res.status(404).json({ success: false, error: 'Target folder not found' }); return; }
    }
    const updated = await prisma.file.update({ where: { id }, data: { folderId: folderId ?? null } });
    res.json({ success: true, data: { ...updated, size: updated.size.toString(), versionCount: updated.currentVersion } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to move file' });
  }
});

// PUT /:id/share
router.put('/:id/share', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { expiresIn, password } = req.body as { expiresIn?: number; password?: string };

    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }

    const shareToken = file.shareToken ?? generateToken(32);
    const shareExpires = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    const sharePassword = password ? await bcrypt.hash(password, 10) : null;

    await prisma.file.update({ where: { id }, data: { shareToken, shareExpires, sharePassword } });
    await prisma.activity.create({ data: { userId, action: 'shared file', target: file.name } });
    await awardBadge(prisma, userId, 'sharer');

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const shareUrl = `${frontendUrl}/share/${shareToken}`;

    // Email the owner when they share a file (confirm share was created)
    const { sendFileSharedEmail } = await import('../services/emailService');
    const sharer = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, displayName: true, emailNotifications: true } });
    if (sharer?.emailNotifications) {
      sendFileSharedEmail(sharer.email, sharer.displayName, file.name, shareUrl).catch(console.error);
    }

    res.json({ success: true, data: { shareToken, shareExpires, shareUrl } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
});

// DELETE /:id/share
router.delete('/:id/share', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    await prisma.file.update({ where: { id }, data: { shareToken: null, shareExpires: null, sharePassword: null } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to remove share link' });
  }
});

// DELETE /:id — trash
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    await prisma.file.update({ where: { id }, data: { isTrashed: true, trashedAt: new Date() } });
    await prisma.activity.create({ data: { userId, action: 'trashed file', target: file.name } });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    broadcastToAll({
      type: 'file_deleted',
      fileName: file.name,
      userId,
      displayName: user?.displayName ?? 'User',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'File moved to trash' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete file' });
  }
});

// DELETE /:id/permanent
router.delete('/:id/permanent', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({
      where: { id, userId },
      include: { childFiles: true, versions: true },
    });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }

    // Delete main file + all child files (old self-referential versions) + FileVersion records from disk
    let totalSize = file.size;
    if (fs.existsSync(file.storagePath)) fs.unlinkSync(file.storagePath);
    if (file.thumbnailPath && fs.existsSync(file.thumbnailPath)) fs.unlinkSync(file.thumbnailPath);

    for (const child of file.childFiles) {
      if (fs.existsSync(child.storagePath)) fs.unlinkSync(child.storagePath);
      if (child.thumbnailPath && fs.existsSync(child.thumbnailPath)) fs.unlinkSync(child.thumbnailPath);
      totalSize += child.size;
    }

    for (const ver of file.versions) {
      if (fs.existsSync(ver.storagePath)) fs.unlinkSync(ver.storagePath);
      totalSize += ver.size;
    }

    await prisma.$transaction([
      prisma.fileVersion.deleteMany({ where: { fileId: id } }),
      prisma.file.deleteMany({ where: { parentFileId: id } }),
      prisma.file.delete({ where: { id } }),
      prisma.user.update({ where: { id: userId }, data: { storageUsed: { decrement: totalSize } } }),
    ]);

    res.json({ success: true, message: 'File permanently deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to permanently delete file' });
  }
});

// GET /:id/comments
router.get('/:id/comments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = await prisma.file.findFirst({ where: { id, userId } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    const comments = await prisma.fileComment.findMany({
      where: { fileId: id },
      include: { user: { select: { id: true, displayName: true, avatarColor: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ success: true, data: comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

// POST /:id/comments
router.post('/:id/comments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { content } = req.body as { content: string };
    if (!content || content.trim().length === 0) { res.status(400).json({ success: false, error: 'Content is required' }); return; }
    if (content.length > 500) { res.status(400).json({ success: false, error: 'Comment too long (max 500 chars)' }); return; }
    // Allow commenting on any non-trashed file (not just own files)
    const file = await prisma.file.findFirst({ where: { id, isTrashed: false } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    const comment = await prisma.fileComment.create({
      data: { fileId: id, userId, content: content.trim() },
      include: { user: { select: { id: true, displayName: true, avatarColor: true } } },
    });
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    broadcastToAll({ type: 'file_commented', fileId: id, userId, displayName: userRecord?.displayName ?? 'User', timestamp: new Date().toISOString() });

    // Notify file owner if commenter is not the owner
    if (file.userId !== userId) {
      const trimmedContent = content.trim().length > 60 ? content.trim().slice(0, 60) + '…' : content.trim();
      createNotification(
        file.userId,
        userId,
        NotificationType.FILE_COMMENT,
        `${userRecord?.displayName ?? 'Someone'} commented on "${file.name}": ${trimmedContent}`,
        `/drive`,
      ).catch(console.error);
    }

    // Check for @mentions
    const mentionRegex = /@(\w+)/g;
    let match;
    const mentioned = new Set<string>();
    while ((match = mentionRegex.exec(content)) !== null) {
      mentioned.add(match[1]);
    }
    if (mentioned.size > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: { username: { in: Array.from(mentioned) }, id: { not: userId } },
        select: { id: true, displayName: true },
      });
      for (const mu of mentionedUsers) {
        createNotification(
          mu.id,
          userId,
          NotificationType.COMMENT_MENTION,
          `${userRecord?.displayName ?? 'Someone'} mentioned you in a comment`,
          `/drive`,
        ).catch(console.error);
      }
    }

    res.status(201).json({ success: true, data: comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to post comment' });
  }
});

// DELETE /:id/comments/:commentId
router.delete('/:id/comments/:commentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user!.id;
    const isAdmin = req.user!.role === 'ADMIN';
    const comment = await prisma.fileComment.findFirst({ where: { id: commentId, fileId: id } });
    if (!comment) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }
    if (comment.userId !== userId && !isAdmin) { res.status(403).json({ success: false, error: 'Not authorized' }); return; }
    await prisma.fileComment.delete({ where: { id: commentId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

// GET /thumbnail/:id — serve thumbnail
router.get('/thumbnail/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const file = await prisma.file.findFirst({ where: { id, userId: req.user!.id } });
    if (!file || !file.thumbnailPath || !fs.existsSync(file.thumbnailPath)) {
      res.status(404).json({ success: false, error: 'Thumbnail not found' });
      return;
    }
    res.sendFile(path.resolve(file.thumbnailPath));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to serve thumbnail' });
  }
});

// POST /api/files/:id/tags — add tag to file
router.post('/:id/tags', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { tagId } = req.body as { tagId?: string };
    if (!tagId) { res.status(400).json({ success: false, error: 'tagId required' }); return; }
    const file = await prisma.file.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    const tag = await prisma.tag.findFirst({ where: { id: tagId, userId: req.user!.id } });
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found' }); return; }
    await prisma.fileTag.upsert({
      where: { fileId_tagId: { fileId: req.params.id, tagId } },
      create: { fileId: req.params.id, tagId },
      update: {},
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to add tag' });
  }
});

// DELETE /api/files/:id/tags/:tagId — remove tag from file
router.delete('/:id/tags/:tagId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const file = await prisma.file.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
    if (!file) { res.status(404).json({ success: false, error: 'File not found' }); return; }
    await prisma.fileTag.deleteMany({ where: { fileId: req.params.id, tagId: req.params.tagId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to remove tag' });
  }
});

export default router;
