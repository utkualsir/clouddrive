import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { broadcastToUser } from '../websocket';
import { createNotification, NotificationType } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

const PARTICIPANT_SELECT = {
  id: true,
  displayName: true,
  username: true,
  avatarColor: true,
  avatarUrl: true,
};

router.use(authenticateToken);

// GET /api/conversations/unread-count
router.get('/unread-count', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const myConvIds = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const ids = myConvIds.map(p => p.conversationId);
    const count = await prisma.message.count({
      where: { conversationId: { in: ids }, senderId: { not: userId }, read: false },
    });
    res.json({ success: true, data: { count } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
  }
});

// GET /api/conversations
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const participations = await prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: { select: PARTICIPANT_SELECT } } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
    });

    const data = await Promise.all(participations.map(async p => {
      const conv = p.conversation;
      const other = conv.participants.find(pt => pt.userId !== userId);
      const unreadCount = await prisma.message.count({
        where: { conversationId: conv.id, senderId: { not: userId }, read: false },
      });
      return {
        id: conv.id,
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt,
        createdAt: conv.createdAt,
        participant: other?.user ?? null,
        unreadCount,
      };
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

// POST /api/conversations
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { userId: targetId } = req.body as { userId: string };

    if (!targetId) { res.status(400).json({ success: false, error: 'userId is required' }); return; }
    if (targetId === userId) { res.status(400).json({ success: false, error: 'Cannot message yourself' }); return; }

    const target = await prisma.user.findUnique({ where: { id: targetId }, select: PARTICIPANT_SELECT });
    if (!target) { res.status(404).json({ success: false, error: 'User not found' }); return; }

    // Find existing conversation between these two users
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: targetId } } },
        ],
      },
      include: { participants: { include: { user: { select: PARTICIPANT_SELECT } } } },
    });

    if (existing) {
      const other = existing.participants.find(p => p.userId !== userId);
      res.json({ success: true, data: { id: existing.id, participant: other?.user ?? null } });
      return;
    }

    const conv = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: targetId }],
        },
      },
      include: { participants: { include: { user: { select: PARTICIPANT_SELECT } } } },
    });

    const other = conv.participants.find(p => p.userId !== userId);
    res.status(201).json({ success: true, data: { id: conv.id, participant: other?.user ?? null } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { cursor } = req.query as { cursor?: string };

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    if (!participant) { res.status(403).json({ success: false, error: 'Not a participant' }); return; }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        sender: { select: PARTICIPANT_SELECT },
        attachment: {
          select: { id: true, name: true, originalName: true, mimeType: true, size: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Mark all unread messages from the other user as read
    await prisma.message.updateMany({
      where: { conversationId: id, senderId: { not: userId }, read: false },
      data: { read: true },
    });

    // Update lastReadAt for this participant
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: id, userId } },
      data: { lastReadAt: new Date() },
    });

    const data = messages.map(m => ({
      ...m,
      attachment: m.attachment ? { ...m.attachment, size: m.attachment.size.toString() } : null,
    }));

    res.json({ success: true, data: data.reverse() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// POST /api/conversations/:id/messages
router.post('/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { content, attachmentId } = req.body as { content: string; attachmentId?: string };

    if (!content?.trim()) { res.status(400).json({ success: false, error: 'Content is required' }); return; }

    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: id, userId } },
    });
    if (!participant) { res.status(403).json({ success: false, error: 'Not a participant' }); return; }

    if (attachmentId) {
      const file = await prisma.file.findUnique({ where: { id: attachmentId } });
      if (!file || file.userId !== userId) {
        res.status(400).json({ success: false, error: 'Invalid attachment' }); return;
      }
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: userId,
        content: content.trim(),
        attachmentId: attachmentId ?? null,
      },
      include: {
        sender: { select: PARTICIPANT_SELECT },
        attachment: {
          select: { id: true, name: true, originalName: true, mimeType: true, size: true },
        },
      },
    });

    await prisma.conversation.update({
      where: { id },
      data: { lastMessage: content.trim().slice(0, 100), lastMessageAt: new Date() },
    });

    const msgData = {
      ...message,
      attachment: message.attachment ? { ...message.attachment, size: message.attachment.size.toString() } : null,
    };

    // Find the other participant and notify them
    const allParticipants = await prisma.conversationParticipant.findMany({
      where: { conversationId: id, userId: { not: userId } },
      select: { userId: true },
    });

    const sender = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });

    for (const p of allParticipants) {
      broadcastToUser(p.userId, { type: 'new_message', conversationId: id, message: msgData });
      createNotification(
        p.userId,
        userId,
        NotificationType.NEW_MESSAGE,
        `${sender?.displayName ?? 'Someone'} sent you a message`,
        `/messages`,
      ).catch(console.error);
    }

    res.status(201).json({ success: true, data: msgData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// DELETE /api/conversations/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await prisma.conversationParticipant.deleteMany({ where: { conversationId: id, userId } });

    const remaining = await prisma.conversationParticipant.count({ where: { conversationId: id } });
    if (remaining === 0) {
      await prisma.conversation.delete({ where: { id } });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to delete conversation' });
  }
});

export default router;
