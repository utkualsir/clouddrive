import { PrismaClient } from '@prisma/client';
import { broadcastToUser } from '../websocket';

const prisma = new PrismaClient();

export const NotificationType = {
  FRIEND_REQUEST:   'FRIEND_REQUEST',
  FRIEND_ACCEPTED:  'FRIEND_ACCEPTED',
  FOLLOW:           'FOLLOW',
  FILE_SHARED:      'FILE_SHARED',
  FOLDER_SHARED:    'FOLDER_SHARED',
  FILE_COMMENT:     'FILE_COMMENT',
  COMMENT_REPLY:    'COMMENT_REPLY',
  COMMENT_MENTION:  'COMMENT_MENTION',
  STORAGE_WARNING:  'STORAGE_WARNING',
  FORUM_REPLY:      'FORUM_REPLY',
  FORUM_ANSWER:     'FORUM_ANSWER',
  NEW_MESSAGE:      'NEW_MESSAGE',
  SYSTEM:           'SYSTEM',
} as const;

export async function createNotification(
  userId: string,
  fromId: string | null,
  type: string,
  message: string,
  link?: string,
): Promise<void> {
  try {
    if (userId === fromId) return; // never notify yourself
    const notification = await prisma.notification.create({
      data: { userId, fromId: fromId ?? null, type, message, link: link ?? null },
      include: {
        from: { select: { id: true, displayName: true, avatarColor: true, avatarUrl: true, username: true } },
      },
    });
    broadcastToUser(userId, { type: 'notification', notification });
  } catch (err) {
    console.error('createNotification error:', err);
  }
}
