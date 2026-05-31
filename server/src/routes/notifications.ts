import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const fromSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarColor: true,
  avatarUrl: true,
};

router.use(authenticateToken);

// GET /api/notifications
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unread === 'true';
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1'));
    const limit = Math.min(50, Math.max(1, parseInt((req.query.limit as string) ?? '30')));
    const skip = (page - 1) * limit;

    const where = { userId, ...(unreadOnly ? { read: false } : {}) };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: { from: { select: fromSelect } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({ success: true, data: { notifications, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user!.id, read: false } });
    res.json({ success: true, data: { count } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.notification.updateMany({ where: { id, userId: req.user!.id }, data: { read: true } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
});

// DELETE /api/notifications/read — delete all read
router.delete('/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.deleteMany({ where: { userId: req.user!.id, read: true } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete read notifications' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.notification.deleteMany({ where: { id, userId: req.user!.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
});

export default router;
