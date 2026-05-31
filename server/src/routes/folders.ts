import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { broadcastToAll, getFolderPresence } from '../websocket';
import { awardBadge } from '../utils/helpers';
import { sendFolderSharedEmail } from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { parentId } = req.query as { parentId?: string };
    const userId = req.user!.id;

    const where = {
      userId,
      isTrashed: false,
      parentId: parentId ?? null,
    };

    const folders = await prisma.folder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch folders' });
  }
});

// GET /api/folders/shared-with-me
router.get('/shared-with-me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const shares = await prisma.folderShare.findMany({
      where: { sharedWithId: userId },
      include: {
        folder: true,
        sharedBy: { select: { id: true, displayName: true, avatarColor: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const data = shares.map(s => ({
      shareId: s.id,
      permission: s.permission,
      folder: s.folder,
      owner: s.sharedBy,
    }));
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch shared folders' });
  }
});

router.get('/starred', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const folders = await prisma.folder.findMany({
      where: { userId: req.user!.id, isStarred: true, isTrashed: false },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ success: true, data: folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch starred folders' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color, parentId } = req.body as { name: string; color?: string; parentId?: string };
    const userId = req.user!.id;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Folder name is required' });
      return;
    }

    if (parentId) {
      const parent = await prisma.folder.findFirst({ where: { id: parentId, userId } });
      if (!parent) {
        res.status(404).json({ success: false, error: 'Parent folder not found' });
        return;
      }
    }

    const folder = await prisma.folder.create({
      data: { name: name.trim(), color: color ?? '#6366f1', parentId: parentId ?? null, userId },
    });

    await prisma.activity.create({ data: { userId, action: 'created folder', target: folder.name } });

    // Badge: Organizer (5+ folders)
    const folderCount = await prisma.folder.count({ where: { userId, isTrashed: false } });
    if (folderCount >= 5) await awardBadge(prisma, userId, 'organizer');

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    broadcastToAll({
      type: 'folder_created',
      folderName: folder.name,
      userId,
      displayName: user?.displayName ?? 'User',
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ success: true, data: folder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { name, color } = req.body as { name?: string; color?: string };

    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) {
      res.status(404).json({ success: false, error: 'Folder not found' });
      return;
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { name: name?.trim() ?? folder.name, color: color ?? folder.color },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update folder' });
  }
});

router.put('/:id/star', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) {
      res.status(404).json({ success: false, error: 'Folder not found' });
      return;
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { isStarred: !folder.isStarred },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to star folder' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) {
      res.status(404).json({ success: false, error: 'Folder not found' });
      return;
    }

    await prisma.folder.update({
      where: { id },
      data: { isTrashed: true, trashedAt: new Date() },
    });

    await prisma.activity.create({ data: { userId, action: 'trashed folder', target: folder.name } });
    res.json({ success: true, message: 'Folder moved to trash' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete folder' });
  }
});

router.delete('/:id/permanent', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) {
      res.status(404).json({ success: false, error: 'Folder not found' });
      return;
    }

    await prisma.folder.delete({ where: { id } });
    res.json({ success: true, message: 'Folder permanently deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to permanently delete folder' });
  }
});

router.post('/:id/lock', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { password } = req.body as { password: string };

    if (!password || password.length < 4) {
      res.status(400).json({ success: false, error: 'Password must be at least 4 characters' });
      return;
    }

    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) {
      res.status(404).json({ success: false, error: 'Folder not found' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const updated = await prisma.folder.update({
      where: { id },
      data: { isEncrypted: true, password: hashed },
    });

    res.json({ success: true, data: { ...updated, password: undefined } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to lock folder' });
  }
});

router.post('/:id/unlock', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { password } = req.body as { password: string };

    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) {
      res.status(404).json({ success: false, error: 'Folder not found' });
      return;
    }

    if (!folder.isEncrypted || !folder.password) {
      res.status(400).json({ success: false, error: 'Folder is not locked' });
      return;
    }

    const match = await bcrypt.compare(password, folder.password);
    if (!match) {
      res.status(401).json({ success: false, error: 'Incorrect password' });
      return;
    }

    res.json({ success: true, message: 'Folder unlocked', data: { id: folder.id } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to unlock folder' });
  }
});

// POST /api/folders/:id/share — share folder with a user
router.post('/:id/share', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ownerId = req.user!.id;
    const { userId, permission } = req.body as { userId: string; permission: string };

    const validPerms = ['VIEW', 'UPLOAD', 'MANAGE'];
    if (!userId || !validPerms.includes(permission)) {
      res.status(400).json({ success: false, error: 'userId and valid permission required' });
      return;
    }

    const folder = await prisma.folder.findFirst({ where: { id, userId: ownerId } });
    if (!folder) { res.status(404).json({ success: false, error: 'Folder not found' }); return; }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const existing = await prisma.folderShare.findFirst({ where: { folderId: id, sharedWithId: userId } });
    let share;
    if (existing) {
      share = await prisma.folderShare.update({
        where: { id: existing.id },
        data: { permission },
      });
    } else {
      share = await prisma.folderShare.create({
        data: { folderId: id, sharedWithId: userId, sharedById: ownerId, permission },
      });
    }

    const owner = await prisma.user.findUnique({ where: { id: ownerId }, select: { displayName: true, emailNotifications: true } });
    if (target.emailNotifications) {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      sendFolderSharedEmail(
        target.email,
        owner?.displayName ?? 'Someone',
        folder.name,
        `${frontendUrl}/drive`,
      ).catch(console.error);
    }

    res.status(201).json({ success: true, data: share });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to share folder' });
  }
});

// GET /api/folders/:id/shares — list shared users for a folder
router.get('/:id/shares', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) { res.status(404).json({ success: false, error: 'Folder not found' }); return; }
    const shares = await prisma.folderShare.findMany({
      where: { folderId: id },
      include: { sharedWith: { select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true } } },
    });
    res.json({ success: true, data: shares });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch shares' });
  }
});

// DELETE /api/folders/:id/shares/:userId — remove user access
router.delete('/:id/shares/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, userId: targetUserId } = req.params;
    const ownerId = req.user!.id;
    const folder = await prisma.folder.findFirst({ where: { id, userId: ownerId } });
    if (!folder) { res.status(404).json({ success: false, error: 'Folder not found' }); return; }
    await prisma.folderShare.deleteMany({ where: { folderId: id, sharedWithId: targetUserId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to remove share' });
  }
});

// PUT /api/folders/:id/move
router.put('/:id/move', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { parentId } = req.body as { parentId: string | null };

    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) { res.status(404).json({ success: false, error: 'Folder not found' }); return; }

    if (parentId) {
      if (parentId === id) {
        res.status(400).json({ success: false, error: 'Cannot move folder into itself' });
        return;
      }
      const target = await prisma.folder.findFirst({ where: { id: parentId, userId } });
      if (!target) { res.status(404).json({ success: false, error: 'Target folder not found' }); return; }

      // Walk up from parentId to check it is not a descendant of id
      let cursor: string | null = parentId;
      while (cursor) {
        if (cursor === id) {
          res.status(400).json({ success: false, error: 'Cannot move folder into its own subfolder' });
          return;
        }
        const f: { parentId: string | null } | null = await prisma.folder.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = f?.parentId ?? null;
      }
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { parentId: parentId ?? null },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to move folder' });
  }
});

// GET /api/folders/:id/presence — who is currently viewing this folder
router.get('/:id/presence', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const viewers = getFolderPresence(id).filter(v => v.userId !== userId);
    res.json({ success: true, data: viewers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to get presence' });
  }
});

export default router;
