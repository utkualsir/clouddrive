import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// GET /api/reviews — public, optional auth for hasLiked
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sort = 'newest', page = '1', limit = '20', rating } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Optional auth to determine hasLiked
    let currentUserId: string | null = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const secret = process.env.JWT_SECRET ?? '';
        const decoded = jwt.default.verify(authHeader.slice(7), secret) as { id: string };
        currentUserId = decoded.id;
      } catch { /* ignore invalid tokens */ }
    }

    const where: Record<string, unknown> = {};
    if (rating) where.rating = parseInt(rating);

    const orderBy: Record<string, string> =
      sort === 'oldest'     ? { createdAt: 'asc' }  :
      sort === 'highest'    ? { rating: 'desc' }     :
      sort === 'lowest'     ? { rating: 'asc' }      :
      sort === 'most_liked' ? { likes: 'desc' }      :
                              { createdAt: 'desc' };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy,
        skip,
        take: limitNum,
        include: {
          user: { select: { displayName: true, avatarColor: true, createdAt: true } },
          likedBy: currentUserId ? { where: { userId: currentUserId } } : false,
        },
      }),
      prisma.review.count({ where }),
    ]);

    // Calculate overall average
    const agg = await prisma.review.aggregate({ _avg: { rating: true }, _count: { id: true } });

    const data = reviews.map(r => ({
      id: r.id,
      userId: r.userId,
      displayName: r.user.displayName,
      avatarColor: r.user.avatarColor,
      memberSince: r.user.createdAt,
      rating: r.rating,
      comment: r.comment,
      likes: r.likes,
      hasLiked: currentUserId ? (r.likedBy as { userId: string }[]).length > 0 : false,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.json({
      success: true,
      data: {
        reviews: data,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        averageRating: agg._avg.rating ?? 0,
        totalCount: agg._count.id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
});

// GET /api/reviews/mine — check if current user has reviewed
router.get('/mine', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await prisma.review.findUnique({
      where: { userId: req.user!.id },
    });
    res.json({ success: true, data: review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch review' });
  }
});

// POST /api/reviews
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rating, comment } = req.body as { rating: number; comment: string };

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
      return;
    }
    if (!comment || comment.trim().length < 10) {
      res.status(400).json({ success: false, error: 'Comment must be at least 10 characters' });
      return;
    }
    if (comment.trim().length > 500) {
      res.status(400).json({ success: false, error: 'Comment must be at most 500 characters' });
      return;
    }

    const existing = await prisma.review.findUnique({ where: { userId: req.user!.id } });
    if (existing) {
      res.status(409).json({ success: false, error: 'You have already submitted a review' });
      return;
    }

    const review = await prisma.review.create({
      data: { userId: req.user!.id, rating: Math.round(rating), comment: comment.trim() },
      include: { user: { select: { displayName: true, avatarColor: true, createdAt: true } } },
    });

    res.status(201).json({
      success: true,
      data: {
        id: review.id,
        userId: review.userId,
        displayName: review.user.displayName,
        avatarColor: review.user.avatarColor,
        memberSince: review.user.createdAt,
        rating: review.rating,
        comment: review.comment,
        likes: review.likes,
        hasLiked: false,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create review' });
  }
});

// PUT /api/reviews/:id
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body as { rating: number; comment: string };

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review || review.userId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Not authorized' });
      return;
    }

    if (rating && (rating < 1 || rating > 5)) {
      res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
      return;
    }
    if (comment && comment.trim().length < 10) {
      res.status(400).json({ success: false, error: 'Comment must be at least 10 characters' });
      return;
    }

    const updated = await prisma.review.update({
      where: { id },
      data: {
        ...(rating && { rating: Math.round(rating) }),
        ...(comment && { comment: comment.trim() }),
      },
      include: { user: { select: { displayName: true, avatarColor: true, createdAt: true } } },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        userId: updated.userId,
        displayName: updated.user.displayName,
        avatarColor: updated.user.avatarColor,
        memberSince: updated.user.createdAt,
        rating: updated.rating,
        comment: updated.comment,
        likes: updated.likes,
        hasLiked: false,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to update review' });
  }
});

// DELETE /api/reviews/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review || review.userId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Not authorized' });
      return;
    }
    await prisma.review.delete({ where: { id } });
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
});

// POST /api/reviews/:id/like — toggle like
router.post('/:id/like', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      res.status(404).json({ success: false, error: 'Review not found' });
      return;
    }
    if (review.userId === userId) {
      res.status(400).json({ success: false, error: 'Cannot like your own review' });
      return;
    }

    const existing = await prisma.reviewLike.findUnique({ where: { reviewId_userId: { reviewId: id, userId } } });

    if (existing) {
      await prisma.$transaction([
        prisma.reviewLike.delete({ where: { id: existing.id } }),
        prisma.review.update({ where: { id }, data: { likes: { decrement: 1 } } }),
      ]);
      res.json({ success: true, data: { liked: false, likes: review.likes - 1 } });
    } else {
      await prisma.$transaction([
        prisma.reviewLike.create({ data: { reviewId: id, userId } }),
        prisma.review.update({ where: { id }, data: { likes: { increment: 1 } } }),
      ]);
      res.json({ success: true, data: { liked: true, likes: review.likes + 1 } });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to toggle like' });
  }
});

export default router;
