import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { createNotification, NotificationType } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

const friendUserSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarColor: true,
  avatarUrl: true,
  occupation: true,
};

// GET /api/friends — accepted friends list
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: {
        fromUser: { select: friendUserSelect },
        toUser: { select: friendUserSelect },
      },
    });
    const friends = friendships.map(f => ({
      friendshipId: f.id,
      user: f.fromUserId === userId ? f.toUser : f.fromUser,
    }));
    res.json({ success: true, data: friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch friends' });
  }
});

// GET /api/friends/requests — pending incoming requests
router.get('/requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const requests = await prisma.friendship.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      include: { fromUser: { select: friendUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
});

// GET /api/friends/sent — pending outgoing requests
router.get('/sent', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const sent = await prisma.friendship.findMany({
      where: { fromUserId: userId, status: 'PENDING' },
      include: { toUser: { select: friendUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: sent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch sent requests' });
  }
});

// POST /api/friends/request/:userId — send friend request
router.post('/request/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const fromUserId = req.user!.id;
    const { userId: toUserId } = req.params;

    if (fromUserId === toUserId) {
      res.status(400).json({ success: false, error: 'Cannot send friend request to yourself' });
      return;
    }

    const target = await prisma.user.findUnique({ where: { id: toUserId } });
    if (!target) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        res.status(409).json({ success: false, error: 'Already friends' });
      } else if (existing.status === 'PENDING') {
        res.status(409).json({ success: false, error: 'Request already pending' });
      } else {
        res.status(409).json({ success: false, error: 'Cannot send request' });
      }
      return;
    }

    const friendship = await prisma.friendship.create({
      data: { fromUserId, toUserId, status: 'PENDING' },
    });

    // Notify recipient
    const sender = await prisma.user.findUnique({ where: { id: fromUserId }, select: { displayName: true } });
    createNotification(
      toUserId,
      fromUserId,
      NotificationType.FRIEND_REQUEST,
      `${sender?.displayName ?? 'Someone'} sent you a friend request`,
      `/friends`,
    ).catch(console.error);

    res.status(201).json({ success: true, data: friendship });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send request' });
  }
});

// PUT /api/friends/request/:friendshipId/accept
router.put('/request/:friendshipId/accept', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user!.id;

    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    if (friendship.toUserId !== userId) { res.status(403).json({ success: false, error: 'Not authorized' }); return; }
    if (friendship.status !== 'PENDING') { res.status(400).json({ success: false, error: 'Request is not pending' }); return; }

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
    });

    // Notify the original sender that their request was accepted
    const accepter = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    createNotification(
      friendship.fromUserId,
      userId,
      NotificationType.FRIEND_ACCEPTED,
      `${accepter?.displayName ?? 'Someone'} accepted your friend request`,
      `/profile/${userId}`,
    ).catch(console.error);

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to accept request' });
  }
});

// PUT /api/friends/request/:friendshipId/decline — decline or cancel
router.put('/request/:friendshipId/decline', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { friendshipId } = req.params;
    const userId = req.user!.id;

    const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
    if (!friendship) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    if (friendship.toUserId !== userId && friendship.fromUserId !== userId) {
      res.status(403).json({ success: false, error: 'Not authorized' });
      return;
    }

    await prisma.friendship.delete({ where: { id: friendshipId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to decline request' });
  }
});

// DELETE /api/friends/:userId — remove friend
router.delete('/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const myId = req.user!.id;
    const { userId } = req.params;

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { fromUserId: myId, toUserId: userId },
          { fromUserId: userId, toUserId: myId },
        ],
      },
    });

    if (!friendship) { res.status(404).json({ success: false, error: 'Friendship not found' }); return; }

    await prisma.friendship.delete({ where: { id: friendship.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to remove friend' });
  }
});

// POST /api/friends/block/:userId
router.post('/block/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const fromUserId = req.user!.id;
    const { userId: toUserId } = req.params;

    if (fromUserId === toUserId) {
      res.status(400).json({ success: false, error: 'Cannot block yourself' });
      return;
    }

    // Remove any existing friendship first
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { fromUserId, toUserId },
          { fromUserId: toUserId, toUserId: fromUserId },
        ],
      },
    });

    const friendship = await prisma.friendship.create({
      data: { fromUserId, toUserId, status: 'BLOCKED' },
    });

    res.status(201).json({ success: true, data: friendship });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to block user' });
  }
});

export default router;
