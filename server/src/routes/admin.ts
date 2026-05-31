import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import fs from 'fs';
import { PLANS } from '../config/plans';
import { createNotification, NotificationType } from '../services/notificationService';
import { sendPaymentApprovedEmail, sendPaymentRejectedEmail } from '../services/emailService';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// Middleware: admin only
router.use((req: AuthRequest, res: Response, next: () => void) => {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
});

// GET /api/admin/stats
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [userCount, fileCount, storageAgg, todayFiles] = await Promise.all([
      prisma.user.count(),
      prisma.file.count({ where: { isTrashed: false } }),
      prisma.user.aggregate({ _sum: { storageUsed: true } }),
      prisma.file.count({ where: { createdAt: { gte: today } } }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers: userCount,
        totalFiles: fileCount,
        totalStorageUsed: (storageAgg._sum.storageUsed ?? BigInt(0)).toString(),
        filesUploadedToday: todayFiles,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// GET /api/admin/users
router.get('/users', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { files: true } } },
    });

    res.json({
      success: true,
      data: users.map(u => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName,
        avatarColor: u.avatarColor,
        storageUsed: u.storageUsed.toString(),
        storageLimit: u.storageLimit.toString(),
        role: u.role,
        fileCount: u._count.files,
        createdAt: u.createdAt,
        lastSeen: u.lastSeen,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/storage
router.put('/users/:id/storage', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { storageLimit } = req.body as { storageLimit: number };

    if (!storageLimit || storageLimit < 1) {
      res.status(400).json({ success: false, error: 'Invalid storage limit' });
      return;
    }

    await prisma.user.update({ where: { id }, data: { storageLimit: BigInt(storageLimit) } });
    res.json({ success: true, message: 'Storage limit updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update storage limit' });
  }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role: string };

    if (!['USER', 'ADMIN'].includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    if (id === req.user!.id) {
      res.status(400).json({ success: false, error: 'Cannot change your own role' });
      return;
    }

    await prisma.user.update({ where: { id }, data: { role } });
    res.json({ success: true, message: 'Role updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    if (id === req.user!.id) {
      res.status(400).json({ success: false, error: 'Cannot delete your own account' });
      return;
    }

    const files = await prisma.file.findMany({ where: { userId: id } });
    for (const f of files) {
      if (fs.existsSync(f.storagePath)) fs.unlinkSync(f.storagePath);
    }
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

// GET /api/admin/files — recent uploads across all users
router.get('/files', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = await prisma.file.findMany({
      where: { isTrashed: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { displayName: true, email: true } } },
    });

    res.json({
      success: true,
      data: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size.toString(),
        uploaderName: f.user.displayName,
        uploaderEmail: f.user.email,
        createdAt: f.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch files' });
  }
});

// GET /api/admin/activity
router.get('/activity', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { displayName: true, email: true } } },
    });

    res.json({
      success: true,
      data: activities.map(a => ({
        id: a.id,
        userId: a.userId,
        displayName: a.user.displayName,
        email: a.user.email,
        action: a.action,
        target: a.target,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
});

// GET /api/admin/payments — list all payment requests
router.get('/payments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query as { status?: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
      where.status = status;
    }
    const requests = await prisma.paymentRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, displayName: true, username: true, email: true, avatarColor: true },
        },
      },
    });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch payment requests' });
  }
});

// PUT /api/admin/payments/:id/approve
router.put('/payments/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const request = await prisma.paymentRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, displayName: true, emailNotifications: true } } },
    });
    if (!request) { res.status(404).json({ success: false, error: 'Payment request not found' }); return; }
    if (request.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Request is not pending' });
      return;
    }

    await prisma.paymentRequest.update({ where: { id }, data: { status: 'APPROVED' } });

    if (request.type === 'UPGRADE' && request.plan && request.storageGB) {
      const planConfig = PLANS.find(p => p.id === request.plan);
      const storageLimit = BigInt(request.storageGB) * BigInt(1024 * 1024 * 1024);
      await prisma.user.update({
        where: { id: request.userId },
        data: {
          plan: request.plan,
          storageLimit,
        },
      });

      const planName = planConfig?.name ?? request.plan;

      createNotification(
        request.userId,
        null,
        NotificationType.SYSTEM,
        `Your ${planName} plan upgrade has been activated! You now have ${request.storageGB} GB of storage.`,
        '/settings?tab=billing',
      ).catch(console.error);

      if (request.user.emailNotifications) {
        sendPaymentApprovedEmail(
          request.user.email,
          request.user.displayName,
          planName,
          request.storageGB,
        ).catch(console.error);
      }
    } else if (request.type === 'DONATE') {
      createNotification(
        request.userId,
        null,
        NotificationType.SYSTEM,
        'Thank you for your donation! It has been received and confirmed.',
        '/settings?tab=billing',
      ).catch(console.error);

      if (request.user.emailNotifications) {
        sendPaymentApprovedEmail(
          request.user.email,
          request.user.displayName,
          'Donation',
          0,
        ).catch(console.error);
      }
    }

    res.json({ success: true, message: 'Payment request approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to approve payment request' });
  }
});

// PUT /api/admin/payments/:id/reject
router.put('/payments/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body as { adminNote?: string };
    const request = await prisma.paymentRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, displayName: true, emailNotifications: true } } },
    });
    if (!request) { res.status(404).json({ success: false, error: 'Payment request not found' }); return; }
    if (request.status !== 'PENDING') {
      res.status(400).json({ success: false, error: 'Request is not pending' });
      return;
    }

    await prisma.paymentRequest.update({
      where: { id },
      data: { status: 'REJECTED', adminNote: adminNote?.trim() ?? null },
    });

    createNotification(
      request.userId,
      null,
      NotificationType.SYSTEM,
      `Your payment request could not be verified.${adminNote ? ` Note: ${adminNote}` : ''}`,
      '/settings?tab=billing',
    ).catch(console.error);

    if (request.user.emailNotifications) {
      sendPaymentRejectedEmail(
        request.user.email,
        request.user.displayName,
        adminNote?.trim(),
      ).catch(console.error);
    }

    res.json({ success: true, message: 'Payment request rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to reject payment request' });
  }
});

export default router;
