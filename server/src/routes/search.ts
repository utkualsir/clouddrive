import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/search?q=...&type=files|folders|users|forum|all
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { q, type = 'all' } = req.query as { q?: string; type?: string };

    if (!q || q.trim().length < 1) {
      res.json({ success: true, data: { files: [], folders: [], users: [], threads: [] } });
      return;
    }

    const searchTerm = q.trim();
    const wantFiles   = type === 'all' || type === 'files';
    const wantFolders = type === 'all' || type === 'folders';
    const wantUsers   = type === 'all' || type === 'users';
    const wantForum   = type === 'all' || type === 'forum';

    const [files, folders, users, threads] = await Promise.all([
      wantFiles
        ? prisma.file.findMany({
            where: { userId, isTrashed: false, parentFileId: null, name: { contains: searchTerm } },
            orderBy: { updatedAt: 'desc' },
            take: type === 'files' ? 40 : 6,
            include: { _count: { select: { likes: true } } },
          })
        : [],
      wantFolders
        ? prisma.folder.findMany({
            where: { userId, isTrashed: false, name: { contains: searchTerm } },
            orderBy: { updatedAt: 'desc' },
            take: type === 'folders' ? 40 : 6,
          })
        : [],
      wantUsers
        ? prisma.user.findMany({
            where: {
              id: { not: userId },
              OR: [{ displayName: { contains: searchTerm } }, { username: { contains: searchTerm } }],
            },
            select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true, occupation: true, location: true },
            take: type === 'users' ? 40 : 6,
          })
        : [],
      wantForum
        ? prisma.forumThread.findMany({
            where: { OR: [{ title: { contains: searchTerm } }, { content: { contains: searchTerm } }] },
            orderBy: { lastPostAt: 'desc' },
            take: type === 'forum' ? 40 : 6,
            include: {
              author: { select: { id: true, displayName: true, username: true, avatarColor: true, avatarUrl: true, createdAt: true } },
              category: { select: { id: true, name: true, color: true, icon: true } },
              _count: { select: { posts: true } },
            },
          })
        : [],
    ]);

    // Resolve isFollowing for users
    let followedIds = new Set<string>();
    if (wantUsers && Array.isArray(users) && users.length > 0) {
      const follows = await prisma.follow.findMany({
        where: { followerId: userId, followingId: { in: (users as { id: string }[]).map(u => u.id) } },
        select: { followingId: true },
      });
      followedIds = new Set(follows.map(f => f.followingId));
    }

    res.json({
      success: true,
      data: {
        files: Array.isArray(files)
          ? (files as (typeof files[0])[]).map(({ _count, ...f }) => ({ ...f, size: f.size.toString(), versionCount: f.currentVersion, likeCount: _count.likes }))
          : [],
        folders: Array.isArray(folders) ? folders : [],
        users: Array.isArray(users) ? (users as (typeof users[0])[]).map(u => ({ ...u, isFollowing: followedIds.has(u.id) })) : [],
        threads: Array.isArray(threads)
          ? (threads as (typeof threads[0])[]).map(({ _count, tags, ...t }) => ({ ...t, tags: JSON.parse(tags || '[]') as string[], postCount: _count.posts }))
          : [],
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
