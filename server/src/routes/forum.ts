import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createNotification, NotificationType } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

const authorSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarColor: true,
  avatarUrl: true,
  createdAt: true,
};

function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = (req.headers['authorization'] ?? '').split(' ')[1];
  if (token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (secret) req.user = jwt.verify(token, secret) as { id: string; email: string; role: string };
    } catch { /* ignore */ }
  }
  next();
}

export async function seedForumCategories(): Promise<void> {
  const count = await prisma.forumCategory.count();
  if (count > 0) return;
  await prisma.forumCategory.createMany({
    data: [
      { name: 'General Discussion', description: 'Talk about anything', icon: 'ti-messages', color: '#6366f1', order: 1 },
      { name: 'Help & Support', description: 'Get help from the community', icon: 'ti-help', color: '#3B82F6', order: 2 },
      { name: 'File Sharing', description: 'Share and discover files', icon: 'ti-share', color: '#10B981', order: 3 },
      { name: 'Feature Requests', description: 'Suggest new features', icon: 'ti-bulb', color: '#F59E0B', order: 4 },
      { name: 'Announcements', description: 'Official announcements', icon: 'ti-speakerphone', color: '#EF4444', order: 5 },
    ],
  });
  console.info('Forum categories seeded');
}

// GET /api/forum/stats
router.get('/stats', async (_req, res: Response): Promise<void> => {
  try {
    const [threadCount, postCount, memberCount, onlineCount] = await Promise.all([
      prisma.forumThread.count(),
      prisma.forumPost.count(),
      prisma.user.count(),
      prisma.user.count({ where: { lastSeen: { gte: new Date(Date.now() - 5 * 60 * 1000) } } }),
    ]);
    res.json({ success: true, data: { threadCount, postCount, memberCount, onlineCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// GET /api/forum/users/:userId/stats
router.get('/users/:userId/stats', async (req, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const [threadCount, postCount] = await Promise.all([
      prisma.forumThread.count({ where: { authorId: userId } }),
      prisma.forumPost.count({ where: { authorId: userId } }),
    ]);
    res.json({ success: true, data: { threadCount, postCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch user forum stats' });
  }
});

// GET /api/forum/tags — unique tags across all threads
router.get('/tags', async (_req, res: Response): Promise<void> => {
  try {
    const threads = await prisma.forumThread.findMany({ select: { tags: true } });
    const tagSet = new Set<string>();
    for (const t of threads) {
      const tags = JSON.parse(t.tags || '[]') as string[];
      for (const tag of tags) if (tag) tagSet.add(tag);
    }
    res.json({ success: true, data: [...tagSet].sort() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
});

// GET /api/forum/categories
router.get('/categories', async (_req, res: Response): Promise<void> => {
  try {
    const categories = await prisma.forumCategory.findMany({ orderBy: { order: 'asc' } });
    const result = await Promise.all(
      categories.map(async cat => {
        const [threadCount, latestThread] = await Promise.all([
          prisma.forumThread.count({ where: { categoryId: cat.id } }),
          prisma.forumThread.findFirst({
            where: { categoryId: cat.id },
            orderBy: { lastPostAt: 'desc' },
            select: {
              id: true,
              title: true,
              lastPostAt: true,
              author: { select: { displayName: true, username: true } },
            },
          }),
        ]);
        return { ...cat, threadCount, latestThread };
      }),
    );
    res.json({ success: true, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
});

// POST /api/forum/categories — admin only
router.post('/categories', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'ADMIN') { res.status(403).json({ success: false, error: 'Admin only' }); return; }
    const { name, description, icon, color, order } = req.body;
    if (!name || !description) { res.status(400).json({ success: false, error: 'Name and description required' }); return; }
    const category = await prisma.forumCategory.create({
      data: { name, description, icon: icon ?? 'ti-messages', color: color ?? '#6366f1', order: order ?? 0 },
    });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
});

// GET /api/forum/threads
router.get('/threads', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { categoryId, sort = 'latest', search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};
    if (categoryId) where.categoryId = categoryId;
    if (search?.trim()) where.title = { contains: search.trim() };
    if (sort === 'unanswered') where.posts = { none: {} };

    let orderBy: Record<string, string> = { lastPostAt: 'desc' };
    if (sort === 'popular') orderBy = { views: 'desc' };

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, orderBy],
        take: limitNum,
        skip,
        include: {
          author: { select: authorSelect },
          category: { select: { id: true, name: true, color: true, icon: true } },
          _count: { select: { posts: true } },
        },
      }),
      prisma.forumThread.count({ where }),
    ]);

    const data = threads.map(({ _count, tags, ...rest }) => ({
      ...rest,
      tags: JSON.parse(tags || '[]') as string[],
      postCount: _count.posts,
    }));

    res.json({ success: true, data: { threads: data, total, page: pageNum, pages: Math.ceil(total / limitNum) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch threads' });
  }
});

// GET /api/forum/threads/:id
router.get('/threads/:id', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // fire-and-forget view increment
    prisma.forumThread.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});

    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: authorSelect },
        category: { select: { id: true, name: true, color: true, icon: true } },
        _count: { select: { posts: true } },
      },
    });

    if (!thread) { res.status(404).json({ success: false, error: 'Thread not found' }); return; }

    const { _count, tags, ...rest } = thread;
    res.json({ success: true, data: { ...rest, tags: JSON.parse(tags || '[]') as string[], postCount: _count.posts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch thread' });
  }
});

// POST /api/forum/threads
router.post('/threads', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, content, categoryId, tags = [] } = req.body;
    if (!title || title.length < 10 || title.length > 200) {
      res.status(400).json({ success: false, error: 'Title must be 10–200 characters' }); return;
    }
    if (!content || content.length < 20 || content.length > 10000) {
      res.status(400).json({ success: false, error: 'Content must be 20–10000 characters' }); return;
    }
    if (!categoryId) { res.status(400).json({ success: false, error: 'Category required' }); return; }
    if (!Array.isArray(tags) || tags.length > 5) {
      res.status(400).json({ success: false, error: 'Max 5 tags allowed' }); return;
    }
    const category = await prisma.forumCategory.findUnique({ where: { id: categoryId } });
    if (!category) { res.status(404).json({ success: false, error: 'Category not found' }); return; }

    const thread = await prisma.forumThread.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        categoryId,
        authorId: req.user!.id,
        tags: JSON.stringify(tags.slice(0, 5)),
      },
      include: {
        author: { select: authorSelect },
        category: { select: { id: true, name: true, color: true, icon: true } },
      },
    });

    const { tags: tagsStr, ...rest } = thread;
    res.status(201).json({ success: true, data: { ...rest, tags: JSON.parse(tagsStr || '[]') as string[], postCount: 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create thread' });
  }
});

// PUT /api/forum/threads/:id
router.put('/threads/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) { res.status(404).json({ success: false, error: 'Thread not found' }); return; }
    if (thread.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }
    const { title, content, categoryId, tags } = req.body;
    const data: Record<string, unknown> = {};
    if (title !== undefined) {
      if (title.length < 10 || title.length > 200) { res.status(400).json({ success: false, error: 'Title must be 10–200 characters' }); return; }
      data.title = title.trim();
    }
    if (content !== undefined) {
      if (content.length < 20 || content.length > 10000) { res.status(400).json({ success: false, error: 'Content must be 20–10000 characters' }); return; }
      data.content = content.trim();
    }
    if (categoryId !== undefined) data.categoryId = categoryId;
    if (tags !== undefined) data.tags = JSON.stringify((tags as string[]).slice(0, 5));

    const updated = await prisma.forumThread.update({ where: { id }, data });
    const { tags: tagsStr, ...rest } = updated;
    res.json({ success: true, data: { ...rest, tags: JSON.parse(tagsStr || '[]') as string[] } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update thread' });
  }
});

// DELETE /api/forum/threads/:id
router.delete('/threads/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) { res.status(404).json({ success: false, error: 'Thread not found' }); return; }
    if (thread.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }
    await prisma.forumThread.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete thread' });
  }
});

// PUT /api/forum/threads/:id/pin — admin only
router.put('/threads/:id/pin', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'ADMIN') { res.status(403).json({ success: false, error: 'Admin only' }); return; }
    const { id } = req.params;
    const thread = await prisma.forumThread.findUnique({ where: { id }, select: { isPinned: true } });
    if (!thread) { res.status(404).json({ success: false, error: 'Thread not found' }); return; }
    const updated = await prisma.forumThread.update({ where: { id }, data: { isPinned: !thread.isPinned } });
    res.json({ success: true, data: { isPinned: updated.isPinned } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to toggle pin' });
  }
});

// PUT /api/forum/threads/:id/lock — admin only
router.put('/threads/:id/lock', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'ADMIN') { res.status(403).json({ success: false, error: 'Admin only' }); return; }
    const { id } = req.params;
    const thread = await prisma.forumThread.findUnique({ where: { id }, select: { isLocked: true } });
    if (!thread) { res.status(404).json({ success: false, error: 'Thread not found' }); return; }
    const updated = await prisma.forumThread.update({ where: { id }, data: { isLocked: !thread.isLocked } });
    res.json({ success: true, data: { isLocked: updated.isLocked } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to toggle lock' });
  }
});

// PUT /api/forum/threads/:id/solve — thread author only
router.put('/threads/:id/solve', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const thread = await prisma.forumThread.findUnique({ where: { id }, select: { authorId: true, isSolved: true } });
    if (!thread) { res.status(404).json({ success: false, error: 'Thread not found' }); return; }
    if (thread.authorId !== req.user!.id) { res.status(403).json({ success: false, error: 'Only the thread author can mark as solved' }); return; }
    const updated = await prisma.forumThread.update({ where: { id }, data: { isSolved: !thread.isSolved } });
    res.json({ success: true, data: { isSolved: updated.isSolved } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to toggle solved' });
  }
});

// GET /api/forum/threads/:id/posts
router.get('/threads/:id/posts', optionalAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1'));
    const limit = 20;
    const skip = (page - 1) * limit;

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { threadId: id },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip,
        include: {
          author: { select: authorSelect },
          _count: { select: { likes: true } },
        },
      }),
      prisma.forumPost.count({ where: { threadId: id } }),
    ]);

    const userId = req.user?.id;
    let likedSet = new Set<string>();
    if (userId && posts.length > 0) {
      const likes = await prisma.forumLike.findMany({
        where: { postId: { in: posts.map(p => p.id) }, userId },
        select: { postId: true },
      });
      likedSet = new Set(likes.map(l => l.postId));
    }

    const data = posts.map(({ _count, ...rest }) => ({
      ...rest,
      likeCount: _count.likes,
      isLiked: likedSet.has(rest.id),
    }));

    res.json({ success: true, data: { posts: data, total, page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch posts' });
  }
});

// POST /api/forum/threads/:id/posts
router.post('/threads/:id/posts', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content || content.length < 5 || content.length > 5000) {
      res.status(400).json({ success: false, error: 'Content must be 5–5000 characters' }); return;
    }
    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) { res.status(404).json({ success: false, error: 'Thread not found' }); return; }
    if (thread.isLocked) { res.status(403).json({ success: false, error: 'Thread is locked' }); return; }

    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });

    const post = await prisma.forumPost.create({
      data: { content: content.trim(), threadId: id, authorId: userId },
      include: { author: { select: authorSelect }, _count: { select: { likes: true } } },
    });

    await prisma.forumThread.update({
      where: { id },
      data: { lastPostAt: new Date(), lastPostBy: user?.displayName ?? userId },
    });

    if (thread.authorId !== userId) {
      createNotification(
        thread.authorId,
        userId,
        NotificationType.FORUM_REPLY,
        `${user?.displayName ?? 'Someone'} replied to your thread "${thread.title}"`,
        `/forum/thread/${id}`,
      ).catch(() => {});
    }

    const { _count, ...rest } = post;
    res.status(201).json({ success: true, data: { ...rest, likeCount: _count.likes, isLiked: false } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

// PUT /api/forum/posts/:id
router.put('/posts/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content || content.length < 5 || content.length > 5000) {
      res.status(400).json({ success: false, error: 'Content must be 5–5000 characters' }); return;
    }
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) { res.status(404).json({ success: false, error: 'Post not found' }); return; }
    if (post.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }
    const updated = await prisma.forumPost.update({ where: { id }, data: { content: content.trim() } });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update post' });
  }
});

// DELETE /api/forum/posts/:id
router.delete('/posts/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) { res.status(404).json({ success: false, error: 'Post not found' }); return; }
    if (post.authorId !== req.user!.id && req.user!.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden' }); return;
    }
    const firstPost = await prisma.forumPost.findFirst({
      where: { threadId: post.threadId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (firstPost?.id === id) {
      res.status(400).json({ success: false, error: 'Cannot delete first reply — delete the thread instead' }); return;
    }
    await prisma.forumPost.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
});

// POST /api/forum/posts/:id/like — toggle like
router.post('/posts/:id/like', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const existing = await prisma.forumLike.findUnique({
      where: { postId_userId: { postId: id, userId } },
    });
    if (existing) {
      await prisma.forumLike.delete({ where: { postId_userId: { postId: id, userId } } });
    } else {
      await prisma.forumLike.create({ data: { postId: id, userId } });
    }
    const likeCount = await prisma.forumLike.count({ where: { postId: id } });
    res.json({ success: true, data: { liked: !existing, likeCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to toggle like' });
  }
});

// PUT /api/forum/posts/:id/answer — toggle answer (thread author only)
router.put('/posts/:id/answer', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const post = await prisma.forumPost.findUnique({
      where: { id },
      include: { thread: { select: { id: true, authorId: true, title: true } } },
    });
    if (!post) { res.status(404).json({ success: false, error: 'Post not found' }); return; }
    if (post.thread.authorId !== userId) {
      res.status(403).json({ success: false, error: 'Only the thread author can mark answers' }); return;
    }
    const newIsAnswer = !post.isAnswer;
    await prisma.forumPost.update({ where: { id }, data: { isAnswer: newIsAnswer } });
    await prisma.forumThread.update({ where: { id: post.threadId }, data: { isSolved: newIsAnswer } });

    if (newIsAnswer && post.authorId !== userId) {
      const threadAuthor = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
      createNotification(
        post.authorId,
        userId,
        NotificationType.FORUM_ANSWER,
        `Your reply was marked as the answer by ${threadAuthor?.displayName ?? 'the thread author'}`,
        `/forum/thread/${post.threadId}`,
      ).catch(() => {});
    }

    res.json({ success: true, data: { isAnswer: newIsAnswer } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to toggle answer' });
  }
});

export default router;
