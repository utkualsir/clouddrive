import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  displayName: string;
  avatarColor: string;
}

const clients = new Map<string, ConnectedClient>();
const folderPresence = new Map<string, Set<string>>();

function broadcastToFolderExcept(folderId: string, exceptUserId: string, event: Record<string, unknown>): void {
  const users = folderPresence.get(folderId);
  if (!users) return;
  const payload = JSON.stringify(event);
  for (const uid of users) {
    if (uid === exceptUserId) continue;
    const client = clients.get(uid);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

function leaveAllFolders(userId: string): void {
  for (const [folderId, users] of folderPresence.entries()) {
    if (users.has(userId)) {
      users.delete(userId);
      if (users.size === 0) folderPresence.delete(folderId);
      broadcastToFolderExcept(folderId, userId, { type: 'user_left_folder', userId });
    }
  }
}

export function setupWebSocket(server: http.Server): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    let userId: string | null = null;

    const cleanup = () => {
      if (userId) {
        leaveAllFolders(userId);
        clients.delete(userId);
      }
      userId = null;
    };

    ws.on('message', async (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type: string;
          token?: string;
          conversationId?: string;
          folderId?: string;
          x?: number;
          y?: number;
        };

        if (msg.type === 'auth' && msg.token && !userId) {
          const secret = process.env.JWT_SECRET;
          if (!secret) return;
          try {
            const decoded = jwt.verify(msg.token, secret) as { id: string };
            userId = decoded.id;
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { displayName: true, avatarColor: true },
            });
            clients.set(userId, {
              ws,
              userId,
              displayName: user?.displayName ?? 'User',
              avatarColor: user?.avatarColor ?? '#6366f1',
            });
            ws.send(JSON.stringify({ type: 'auth_ok' }));
          } catch {
            ws.send(JSON.stringify({ type: 'auth_error' }));
          }
        } else if (msg.type === 'typing' && userId && msg.conversationId) {
          const participants = await prisma.conversationParticipant.findMany({
            where: { conversationId: msg.conversationId, userId: { not: userId } },
            select: { userId: true },
          });
          const client = clients.get(userId);
          for (const p of participants) {
            broadcastToUser(p.userId, {
              type: 'typing',
              conversationId: msg.conversationId,
              userId,
              displayName: client?.displayName ?? 'User',
            });
          }
        } else if (msg.type === 'join_folder' && userId && msg.folderId) {
          const folderId = msg.folderId;
          if (!folderPresence.has(folderId)) folderPresence.set(folderId, new Set());
          folderPresence.get(folderId)!.add(userId);
          const client = clients.get(userId);
          broadcastToFolderExcept(folderId, userId, {
            type: 'user_joined_folder',
            userId,
            displayName: client?.displayName ?? 'User',
            avatarColor: client?.avatarColor ?? '#6366f1',
          });
        } else if (msg.type === 'leave_folder' && userId && msg.folderId) {
          const folderId = msg.folderId;
          const users = folderPresence.get(folderId);
          if (users) {
            users.delete(userId);
            if (users.size === 0) folderPresence.delete(folderId);
          }
          broadcastToFolderExcept(folderId, userId, { type: 'user_left_folder', userId });
        } else if (msg.type === 'cursor_move' && userId && msg.folderId) {
          const client = clients.get(userId);
          broadcastToFolderExcept(msg.folderId, userId, {
            type: 'cursor_move',
            userId,
            displayName: client?.displayName ?? 'User',
            avatarColor: client?.avatarColor ?? '#6366f1',
            x: msg.x ?? 0,
            y: msg.y ?? 0,
          });
        }
      } catch { /* malformed message */ }
    });

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });
}

export function broadcastToUser(userId: string, event: Record<string, unknown>): void {
  const client = clients.get(userId);
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(event));
  }
}

export function broadcastToAll(event: Record<string, unknown>): void {
  const payload = JSON.stringify(event);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  }
}

export function getConnectedClient(userId: string): ConnectedClient | undefined {
  return clients.get(userId);
}

export function getFolderPresence(folderId: string): { userId: string; displayName: string; avatarColor: string }[] {
  const users = folderPresence.get(folderId);
  if (!users) return [];
  return Array.from(users)
    .map(uid => {
      const c = clients.get(uid);
      if (!c) return null;
      return { userId: uid, displayName: c.displayName, avatarColor: c.avatarColor };
    })
    .filter((x): x is { userId: string; displayName: string; avatarColor: string } => x !== null);
}
