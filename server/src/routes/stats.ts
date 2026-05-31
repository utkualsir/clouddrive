import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { formatFileSize } from '../utils/helpers';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      user,
      totalFiles,
      totalFolders,
      totalDownloads,
      totalSharedFiles,
      filesByType,
      uploadsLast30,
      topFolderFiles,
      largestFiles,
      recentActivity,
      mostViewedFiles,
      mostDownloadedFiles,
      mostLikedFiles,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { storageUsed: true, storageLimit: true },
      }),
      prisma.file.count({ where: { userId, isTrashed: false, parentFileId: null } }),
      prisma.folder.count({ where: { userId, isTrashed: false } }),
      prisma.file.aggregate({
        where: { userId, isTrashed: false },
        _sum: { downloadCount: true },
      }),
      prisma.file.count({ where: { userId, isTrashed: false, shareToken: { not: null } } }),
      prisma.file.groupBy({
        by: ['mimeType'],
        where: { userId, isTrashed: false, parentFileId: null },
        _sum: { size: true },
        _count: true,
      }),
      prisma.file.findMany({
        where: { userId, isTrashed: false, parentFileId: null, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, size: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.file.findMany({
        where: { userId, isTrashed: false, parentFileId: null, folderId: { not: null } },
        select: { folderId: true, size: true, folder: { select: { name: true } } },
      }),
      prisma.file.findMany({
        where: { userId, isTrashed: false, parentFileId: null },
        orderBy: { size: 'desc' },
        take: 5,
        select: { id: true, name: true, originalName: true, mimeType: true, size: true, createdAt: true },
      }),
      prisma.activity.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.file.findMany({
        where: { userId, isTrashed: false, parentFileId: null },
        orderBy: { viewCount: 'desc' },
        take: 5,
        select: { id: true, name: true, mimeType: true, size: true, viewCount: true },
      }),
      prisma.file.findMany({
        where: { userId, isTrashed: false, parentFileId: null },
        orderBy: { downloadCount: 'desc' },
        take: 5,
        select: { id: true, name: true, mimeType: true, size: true, downloadCount: true },
      }),
      prisma.file.findMany({
        where: { userId, isTrashed: false, parentFileId: null },
        orderBy: { likes: { _count: 'desc' } },
        take: 5,
        select: { id: true, name: true, mimeType: true, size: true, _count: { select: { likes: true } } },
      }),
    ]);

    if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    // Normalize file types into categories
    const typeMap: Record<string, { count: number; size: bigint }> = {};
    for (const stat of filesByType) {
      let category = 'other';
      if (stat.mimeType.startsWith('image/')) category = 'Images';
      else if (stat.mimeType.startsWith('video/')) category = 'Videos';
      else if (stat.mimeType.startsWith('audio/')) category = 'Audio';
      else if (stat.mimeType === 'application/pdf' || stat.mimeType.includes('document') || stat.mimeType.includes('word') || stat.mimeType.includes('text')) category = 'Documents';
      else if (stat.mimeType.includes('zip') || stat.mimeType.includes('rar') || stat.mimeType.includes('archive') || stat.mimeType.includes('tar')) category = 'Archives';
      else category = 'Other';

      if (!typeMap[category]) typeMap[category] = { count: 0, size: 0n };
      typeMap[category].count += stat._count;
      typeMap[category].size += stat._sum.size ?? 0n;
    }
    const filesByTypeSorted = Object.entries(typeMap).map(([type, { count, size }]) => ({
      type,
      count,
      size: Number(size),
    })).sort((a, b) => b.size - a.size);

    // Uploads per day last 30 days
    const dayMap: Record<string, { count: number; size: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { count: 0, size: 0 };
    }
    for (const f of uploadsLast30) {
      const key = f.createdAt.toISOString().slice(0, 10);
      if (dayMap[key]) {
        dayMap[key].count++;
        dayMap[key].size += Number(f.size);
      }
    }
    const uploadsByDay = Object.entries(dayMap).map(([date, { count, size }]) => ({ date, count, size }));

    // Top folders by size
    const folderSizeMap: Record<string, { name: string; fileCount: number; size: bigint }> = {};
    for (const f of topFolderFiles) {
      if (!f.folderId || !f.folder) continue;
      if (!folderSizeMap[f.folderId]) folderSizeMap[f.folderId] = { name: f.folder.name, fileCount: 0, size: 0n };
      folderSizeMap[f.folderId].fileCount++;
      folderSizeMap[f.folderId].size += f.size;
    }
    const topFolders = Object.values(folderSizeMap)
      .sort((a, b) => Number(b.size - a.size))
      .slice(0, 5)
      .map(f => ({ name: f.name, fileCount: f.fileCount, size: Number(f.size) }));

    const storageUsed = user.storageUsed;
    const storageLimit = user.storageLimit;

    res.json({
      success: true,
      data: {
        totalFiles,
        totalFolders,
        storageUsed: storageUsed.toString(),
        storageLimit: storageLimit.toString(),
        storageUsedFormatted: formatFileSize(storageUsed),
        storageLimitFormatted: formatFileSize(storageLimit),
        storagePercentage: Number(storageLimit) > 0
          ? Math.round((Number(storageUsed) / Number(storageLimit)) * 100)
          : 0,
        filesByType: filesByTypeSorted,
        uploadsByDay,
        topFolders,
        recentActivity,
        totalDownloads: totalDownloads._sum.downloadCount ?? 0,
        totalSharedFiles,
        largestFiles: largestFiles.map(f => ({ ...f, size: f.size.toString() })),
        mostViewedFiles: mostViewedFiles.map(f => ({ ...f, size: f.size.toString() })),
        mostDownloadedFiles: mostDownloadedFiles.map(f => ({ ...f, size: f.size.toString() })),
        mostLikedFiles: mostLikedFiles.map(({ _count, ...f }) => ({ ...f, size: f.size.toString(), likeCount: _count.likes })),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export default router;
