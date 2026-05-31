import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { WsEvent, AppNotification, Message, FolderViewer, LiveCursor } from '@/types';
import { showDesktopNotification } from '@/services/notificationService';

export interface TypingState {
  conversationId: string;
  userId: string;
  displayName: string;
}

interface WsContextValue {
  lastEvent: WsEvent | null;
  isConnected: boolean;
  events: WsEvent[];
  lastNotification: AppNotification | null;
  unreadBump: number;
  lastMessage: Message | null;
  lastMessageConversationId: string | null;
  messageBump: number;
  typingUsers: TypingState[];
  sendTyping: (conversationId: string) => void;
  sendMessage: (msg: Record<string, unknown>) => void;
  folderViewers: FolderViewer[];
  liveCursors: LiveCursor[];
}

const WebSocketContext = createContext<WsContextValue>({
  lastEvent: null,
  isConnected: false,
  events: [],
  lastNotification: null,
  unreadBump: 0,
  lastMessage: null,
  lastMessageConversationId: null,
  messageBump: 0,
  typingUsers: [],
  sendTyping: () => undefined,
  sendMessage: () => undefined,
  folderViewers: [],
  liveCursors: [],
});

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<WsEvent[]>([]);
  const [lastNotification, setLastNotification] = useState<AppNotification | null>(null);
  const [unreadBump, setUnreadBump] = useState(0);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [lastMessageConversationId, setLastMessageConversationId] = useState<string | null>(null);
  const [messageBump, setMessageBump] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingState[]>([]);
  const [folderViewers, setFolderViewers] = useState<FolderViewer[]>([]);
  const [liveCursors, setLiveCursors] = useState<LiveCursor[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const typingTimers = useRef<Map<string, number>>(new Map());
  const cursorTimers = useRef<Map<string, number>>(new Map());

  const triggerDesktopNotification = (notif: AppNotification) => {
    const from = notif.from?.displayName ?? 'Someone';
    const link = notif.link ?? undefined;
    switch (notif.type) {
      case 'FOLLOW':
        showDesktopNotification('👤 New Follower', `${from} started following you`, link);
        break;
      case 'FRIEND_REQUEST':
        showDesktopNotification('👋 Friend Request', `${from} sent you a friend request`, link ?? '/friends');
        break;
      case 'FRIEND_ACCEPTED':
        showDesktopNotification('✅ Friend Request Accepted', `${from} accepted your request`, link);
        break;
      case 'FILE_SHARED':
      case 'FOLDER_SHARED':
        showDesktopNotification('📁 File Shared', `${from} shared a file with you`, link ?? '/drive');
        break;
      case 'FORUM_REPLY':
        showDesktopNotification('💬 Forum Reply', `${from} replied to your thread`, link);
        break;
      default:
        break;
    }
  };

  const connect = () => {
    if (!mountedRef.current) return;
    const token = localStorage.getItem('token');
    if (!token) {
      reconnectTimer.current = window.setTimeout(connect, 3000);
      return;
    }

    const apiUrl = (import.meta.env.VITE_API_URL as string) || null;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = apiUrl
      ? apiUrl.replace(/^http/, 'ws')
      : `${proto}://${window.location.hostname}:3001`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setIsConnected(true);
        const t = localStorage.getItem('token');
        if (t) ws.send(JSON.stringify({ type: 'auth', token: t }));
      };

      ws.onmessage = (e: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const event = JSON.parse(e.data as string) as WsEvent;
          if (event.type === 'auth_ok' || event.type === 'auth_error') return;

          if (event.type === 'notification' && event.notification) {
            setLastNotification(event.notification);
            setUnreadBump(n => n + 1);
            triggerDesktopNotification(event.notification);
            return;
          }
          if (event.type === 'new_message' && event.message && event.conversationId) {
            setLastMessage(event.message);
            setLastMessageConversationId(event.conversationId);
            setMessageBump(n => n + 1);
            const sender = event.message.sender?.displayName ?? 'Someone';
            const preview = event.message.content.length > 60
              ? event.message.content.slice(0, 60) + '…'
              : event.message.content;
            showDesktopNotification(`💬 New Message`, `${sender}: ${preview}`, '/messages');
            return;
          }
          if (event.type === 'typing' && event.conversationId && event.userId) {
            const key = `${event.conversationId}:${event.userId}`;
            setTypingUsers(prev => {
              const filtered = prev.filter(t => !(t.conversationId === event.conversationId && t.userId === event.userId));
              return [...filtered, { conversationId: event.conversationId!, userId: event.userId!, displayName: event.displayName ?? 'User' }];
            });
            const existing = typingTimers.current.get(key);
            if (existing) clearTimeout(existing);
            const timer = window.setTimeout(() => {
              setTypingUsers(prev => prev.filter(t => !(t.conversationId === event.conversationId && t.userId === event.userId)));
              typingTimers.current.delete(key);
            }, 3000);
            typingTimers.current.set(key, timer);
            return;
          }

          // Folder presence events
          if (event.type === 'user_joined_folder' && event.userId) {
            setFolderViewers(prev => {
              if (prev.some(v => v.userId === event.userId)) return prev;
              return [...prev, { userId: event.userId!, displayName: event.displayName ?? 'User', avatarColor: event.avatarColor ?? '#6366f1' }];
            });
            return;
          }
          if (event.type === 'user_left_folder' && event.userId) {
            setFolderViewers(prev => prev.filter(v => v.userId !== event.userId));
            setLiveCursors(prev => prev.filter(c => c.userId !== event.userId));
            return;
          }

          // Cursor events
          if (event.type === 'cursor_move' && event.userId) {
            const uid = event.userId;
            setLiveCursors(prev => {
              const filtered = prev.filter(c => c.userId !== uid);
              const updated: LiveCursor = {
                userId: uid,
                displayName: event.displayName ?? 'User',
                avatarColor: event.avatarColor ?? '#6366f1',
                x: event.x ?? 0,
                y: event.y ?? 0,
                lastSeen: Date.now(),
              };
              return [...filtered, updated].slice(-5);
            });
            // Reset fade-out timer
            const existing = cursorTimers.current.get(uid);
            if (existing) clearTimeout(existing);
            const timer = window.setTimeout(() => {
              setLiveCursors(prev => prev.filter(c => c.userId !== uid));
              cursorTimers.current.delete(uid);
            }, 3000);
            cursorTimers.current.set(uid, timer);
            return;
          }

          setLastEvent(event);
          setEvents(prev => [event, ...prev].slice(0, 50));
        } catch { /* malformed */ }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;
        reconnectTimer.current = window.setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = window.setTimeout(connect, 3000);
    }
  };

  const sendTyping = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', conversationId }));
    }
  }, []);

  const sendMessage = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      typingTimers.current.forEach(t => clearTimeout(t));
      cursorTimers.current.forEach(t => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <WebSocketContext.Provider value={{
      lastEvent, isConnected, events, lastNotification, unreadBump,
      lastMessage, lastMessageConversationId, messageBump, typingUsers, sendTyping,
      sendMessage, folderViewers, liveCursors,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export const useWebSocket = () => useContext(WebSocketContext);
