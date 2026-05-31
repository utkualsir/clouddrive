import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { formatFileSize } from '../utils/helpers';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [user, fileStats, recentActivity, totalFiles, totalFolders] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { storageUsed: true, storageLimit: true },
      }),
      prisma.file.groupBy({
        by: ['mimeType'],
        where: { userId, isTrashed: false },
        _sum: { size: true },
        _count: true,
      }),
      prisma.activity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.file.count({ where: { userId, isTrashed: false } }),
      prisma.folder.count({ where: { userId, isTrashed: false } }),
    ]);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const breakdown = fileStats.map(stat => ({
      mimeType: stat.mimeType,
      count: stat._count,
      size: stat._sum.size?.toString() ?? '0',
      sizeFormatted: formatFileSize(stat._sum.size ?? 0n),
    }));

    res.json({
      success: true,
      data: {
        storageUsed: user.storageUsed.toString(),
        storageLimit: user.storageLimit.toString(),
        storageUsedFormatted: formatFileSize(user.storageUsed),
        storageLimitFormatted: formatFileSize(user.storageLimit),
        percentage: Number(user.storageLimit) > 0
          ? Math.round((Number(user.storageUsed) / Number(user.storageLimit)) * 100)
          : 0,
        totalFiles,
        totalFolders,
        breakdown,
        recentActivity,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch storage stats' });
  }
});

export default router;
