import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PenSquare, Search, X, Send, Paperclip, ArrowLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { conversationsApi } from '@/api/conversations';
import { filesApi } from '@/api/files';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { Conversation, Message, MessageParticipant } from '@/types';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import toast from 'react-hot-toast';
import Sidebar from '@/components/layout/Sidebar';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

function formatMsgTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
}

function dateSeparator(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

function isSameDay(a: string, b: string): boolean {
  return format(new Date(a), 'yyyy-MM-dd') === format(new Date(b), 'yyyy-MM-dd');
}

function Avatar({ user, size = 32 }: { user: { displayName: string; avatarColor: string; avatarUrl: string | null; id: string }; size?: number }) {
  const src = user.avatarUrl ? `${apiBase}${user.avatarUrl}` : null;
  if (src) return <img src={src} alt={user.displayName} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0" />;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, backgroundColor: user.avatarColor, fontSize: Math.max(10, size * 0.36) }}
    >
      {user.displayName[0]?.toUpperCase()}
    </div>
  );
}

interface NewMessageModalProps {
  onClose: () => void;
  onSelect: (userId: string) => void;
}

function NewMessageModal({ onClose, onSelect }: NewMessageModalProps) {
  const [q, setQ] = useState('');
  const { data: resultsData } = useQuery({
    queryKey: ['user-search', q],
    queryFn: () => fetch(`${apiBase}/api/users/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    }).then(r => r.json()).then((d: { data?: MessageParticipant[] }) => d.data ?? []),
    enabled: q.trim().length > 0,
  });
  const results: MessageParticipant[] = resultsData ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-2xl w-full max-w-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">New Message</p>
          <button onClick={onClose} className="p-1 rounded text-[#AAAAAA] hover:text-[#6B6B6B] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AAAAAA]" strokeWidth={1.5} />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search users..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-[#F3F4F6] dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] outline-none focus:border-[#4F46E5]"
          />
        </div>
        <div className="space-y-0.5 max-h-52 overflow-y-auto">
          {results.map(u => (
            <button
              key={u.id}
              onClick={() => { onSelect(u.id); onClose(); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors text-left"
            >
              <Avatar user={{ ...u, id: u.id }} size={28} />
              <div>
                <p className="text-xs font-medium text-[#0A0A0A] dark:text-[#F5F5F5]">{u.displayName}</p>
                <p className="text-[11px] text-[#9CA3AF]">@{u.username}</p>
              </div>
            </button>
          ))}
          {q.trim().length > 0 && results.length === 0 && (
            <p className="text-xs text-[#9CA3AF] text-center py-3">No users found</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface AttachFileModalProps {
  onClose: () => void;
  onSelect: (fileId: string, fileName: string) => void;
}

function AttachFileModal({ onClose, onSelect }: AttachFileModalProps) {
  const [q, setQ] = useState('');
  const { data } = useQuery({
    queryKey: ['files', null, q],
    queryFn: () => filesApi.getAll(undefined, { q: q || undefined }),
  });
  const files = data?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-2xl w-full max-w-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Attach from Drive</p>
          <button onClick={onClose} className="p-1 rounded text-[#AAAAAA] hover:text-[#6B6B6B] transition-colors">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AAAAAA]" strokeWidth={1.5} />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search files..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-[#F3F4F6] dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] outline-none focus:border-[#4F46E5]"
          />
        </div>
        <div className="space-y-0.5 max-h-52 overflow-y-auto">
          {files.map(f => (
            <button
              key={f.id}
              onClick={() => { onSelect(f.id, f.name); onClose(); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors text-left"
            >
              <div className="w-7 h-7 rounded bg-[#EEF2FF] dark:bg-[#1e1b4b]/30 flex items-center justify-center shrink-0">
                <span className="text-[#4F46E5] text-[9px] font-bold">{f.name.split('.').pop()?.toUpperCase().slice(0, 3)}</span>
              </div>
              <p className="text-xs text-[#0A0A0A] dark:text-[#F5F5F5] truncate">{f.name}</p>
            </button>
          ))}
          {files.length === 0 && (
            <p className="text-xs text-[#9CA3AF] text-center py-3">No files found</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSeparator: boolean;
  separatorLabel: string;
}

function MessageBubble({ message, isOwn, showSeparator, separatorLabel }: MessageBubbleProps) {
  const token = localStorage.getItem('token');
  return (
    <>
      {showSeparator && (
        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
          <span className="text-[10px] font-medium text-[#9CA3AF] dark:text-[#555555] px-2">{separatorLabel}</span>
          <div className="flex-1 h-px bg-[#E5E7EB] dark:bg-[#2A2A2A]" />
        </div>
      )}
      <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
          {message.attachment && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
              isOwn
                ? 'bg-[#4F46E5]/10 border-[#4F46E5]/20 text-[#4F46E5]'
                : 'bg-[#F3F4F6] dark:bg-[#1E1E1E] border-[#E5E7EB] dark:border-[#2A2A2A] text-[#374151] dark:text-[#C0C0C0]'
            }`}>
              <Paperclip className="w-3 h-3 shrink-0" strokeWidth={1.5} />
              <span className="truncate max-w-[140px]">{message.attachment.name}</span>
              <a
                href={`${apiBase}/api/files/${message.attachment.id}/download`}
                onClick={e => {
                  e.preventDefault();
                  fetch(`${apiBase}/api/files/${message.attachment!.id}/download`, {
                    headers: { Authorization: `Bearer ${token}` },
                  }).then(r => r.blob()).then(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = message.attachment!.name; a.click();
                    URL.revokeObjectURL(url);
                  });
                }}
                className="ml-1 shrink-0 underline text-[10px] hover:opacity-80"
              >
                Download
              </a>
            </div>
          )}
          <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${
            isOwn
              ? 'bg-[#4F46E5] text-white rounded-br-sm'
              : 'bg-[#F3F4F6] dark:bg-[#252525] text-[#0A0A0A] dark:text-[#F5F5F5] rounded-bl-sm'
          }`}>
            {message.content}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#9CA3AF] dark:text-[#555555]">{formatMsgTime(message.createdAt)}</span>
            {isOwn && (
              <span className="text-[10px] text-[#9CA3AF]">{message.read ? '✓✓' : '✓'}</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function MessagesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [convSearch, setConvSearch] = useState('');
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachment, setAttachment] = useState<{ id: string; name: string } | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [mobileShowConv, setMobileShowConv] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  const { lastMessage, lastMessageConversationId, messageBump, typingUsers, sendTyping } = useWebSocket();

  const activeConvId = searchParams.get('c') ?? null;
  const setActiveConv = (id: string | null) => {
    if (id) { setSearchParams({ c: id }, { replace: true }); setMobileShowConv(false); }
    else { setSearchParams({}, { replace: true }); setMobileShowConv(true); }
  };

  const { data: convsData, refetch: refetchConvs } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationsApi.getAll(),
    enabled: !!user,
  });
  const conversations: Conversation[] = convsData?.data ?? [];

  const { data: msgsData, refetch: refetchMsgs } = useQuery({
    queryKey: ['messages', activeConvId],
    queryFn: () => conversationsApi.getMessages(activeConvId!),
    enabled: !!activeConvId,
  });
  const messages: Message[] = msgsData?.data ?? [];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Real-time: new message event
  useEffect(() => {
    if (!lastMessage || !lastMessageConversationId) return;
    if (lastMessageConversationId === activeConvId) {
      refetchMsgs();
    }
    refetchConvs();
    qc.invalidateQueries({ queryKey: ['msg-unread-count'] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageBump]);

  const createConvMutation = useMutation({
    mutationFn: (userId: string) => conversationsApi.create(userId),
    onSuccess: d => {
      if (d.data) { setActiveConv(d.data.id); refetchConvs(); }
    },
    onError: () => toast.error('Failed to start conversation'),
  });

  const sendMsgMutation = useMutation({
    mutationFn: ({ content, attachmentId }: { content: string; attachmentId?: string }) =>
      conversationsApi.sendMessage(activeConvId!, content, attachmentId),
    onSuccess: () => {
      setInputValue('');
      setAttachment(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      refetchMsgs();
      refetchConvs();
      qc.invalidateQueries({ queryKey: ['msg-unread-count'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const handleSend = () => {
    const content = inputValue.trim();
    if (!content && !attachment) return;
    if (!activeConvId) return;
    sendMsgMutation.mutate({ content: content || ' ', attachmentId: attachment?.id });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTyping = useCallback(() => {
    if (!activeConvId) return;
    sendTyping(activeConvId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => { typingTimerRef.current = null; }, 500);
  }, [activeConvId, sendTyping]);

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
    handleTyping();
  };

  const activeConv = conversations.find(c => c.id === activeConvId);
  const activeParticipant = activeConv?.participant;

  const filteredConvs = conversations.filter(c => {
    if (!convSearch.trim()) return true;
    return c.participant?.displayName.toLowerCase().includes(convSearch.toLowerCase()) ||
      c.participant?.username.toLowerCase().includes(convSearch.toLowerCase());
  });

  const typingInConv = typingUsers.filter(t => t.conversationId === activeConvId);

  return (
    <div className="flex h-screen bg-[#F9FAFB] dark:bg-[#050505] overflow-hidden">
      {/* App Sidebar */}
      <div className="hidden md:block">
        <Sidebar
          currentView="drive"
          onViewChange={() => undefined}
        />
      </div>

      {/* Messages two-panel layout */}
      <div className="flex flex-1 min-w-0 overflow-hidden">

        {/* Left panel */}
        <div className={`flex flex-col w-full md:w-80 shrink-0 bg-white dark:bg-[#0A0A0A] border-r border-[#E5E7EB] dark:border-[#2A2A2A] ${!mobileShowConv ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-[#E5E7EB] dark:border-[#2A2A2A]">
            <h1 className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5]">Messages</h1>
            <button
              onClick={() => setNewMsgOpen(true)}
              className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#555555] hover:text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#1e1b4b]/20 transition-all"
              title="New message"
            >
              <PenSquare className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#AAAAAA]" strokeWidth={1.5} />
              <input
                value={convSearch}
                onChange={e => setConvSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-[#F3F4F6] dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-lg text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] outline-none focus:border-[#4F46E5]"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {filteredConvs.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <p className="text-xs text-[#9CA3AF] dark:text-[#555555]">No conversations yet</p>
                <button
                  onClick={() => setNewMsgOpen(true)}
                  className="text-xs text-[#4F46E5] hover:underline"
                >
                  Start one
                </button>
              </div>
            )}
            {filteredConvs.map(conv => {
              const isActive = conv.id === activeConvId;
              const p = conv.participant;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive
                      ? 'bg-[#EEF2FF] dark:bg-[#1e1b4b]/20'
                      : 'hover:bg-[#F9FAFB] dark:hover:bg-[#141414]'
                  }`}
                >
                  {p ? (
                    <Avatar user={{ ...p, id: p.id }} size={36} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-[#E5E7EB] dark:bg-[#2A2A2A] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-xs font-medium truncate ${isActive ? 'text-[#4F46E5]' : 'text-[#0A0A0A] dark:text-[#F5F5F5]'}`}>
                        {p?.displayName ?? 'Unknown'}
                      </p>
                      <span className="text-[10px] text-[#9CA3AF] shrink-0 ml-1">
                        {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false }) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-[#9CA3AF] dark:text-[#555555] truncate pr-2">
                        {conv.lastMessage ?? 'No messages yet'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#4F46E5] text-white text-[10px] font-bold leading-none">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div className={`flex flex-col flex-1 min-w-0 ${mobileShowConv && !activeConvId ? 'hidden md:flex' : 'flex'}`}>
          {!activeConvId ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 flex items-center justify-center">
                <PenSquare className="w-7 h-7 text-[#4F46E5]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-[#6B7280] dark:text-[#888888]">Select a conversation</p>
              <button
                onClick={() => setNewMsgOpen(true)}
                className="text-xs text-[#4F46E5] hover:underline"
              >
                or start a new one
              </button>
            </div>
          ) : (
            <>
              {/* Conversation header */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A]">
                <button
                  className="md:hidden p-1 rounded text-[#6B7280] hover:text-[#374151] transition-colors"
                  onClick={() => { setActiveConv(null); setMobileShowConv(true); }}
                >
                  <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                </button>
                {activeParticipant && (
                  <Avatar user={{ ...activeParticipant, id: activeParticipant.id }} size={32} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0A0A0A] dark:text-[#F5F5F5] truncate">
                    {activeParticipant?.displayName ?? 'Unknown'}
                  </p>
                </div>
                {activeParticipant && (
                  <Link
                    to={`/profile/${activeParticipant.id}`}
                    className="text-xs text-[#4F46E5] hover:underline flex items-center gap-0.5 shrink-0"
                  >
                    View Profile <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                  </Link>
                )}
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {messages.map((msg, i) => {
                  const isOwn = msg.senderId === user?.id;
                  const prevMsg = messages[i - 1];
                  const showSep = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                  return (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={isOwn}
                      showSeparator={showSep}
                      separatorLabel={dateSeparator(msg.createdAt)}
                    />
                  );
                })}
                {typingInConv.length > 0 && (
                  <div className="flex items-center gap-2 py-1">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[11px] text-[#9CA3AF]">
                      {typingInConv.map(t => t.displayName).join(', ')} {typingInConv.length === 1 ? 'is' : 'are'} typing...
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Attachment preview */}
              {attachment && (
                <div className="mx-4 mb-1 flex items-center gap-2 px-3 py-1.5 bg-[#EEF2FF] dark:bg-[#1e1b4b]/20 rounded-lg border border-[#4F46E5]/20">
                  <Paperclip className="w-3 h-3 text-[#4F46E5] shrink-0" strokeWidth={1.5} />
                  <span className="text-xs text-[#4F46E5] flex-1 truncate">{attachment.name}</span>
                  <button onClick={() => setAttachment(null)} className="text-[#9CA3AF] hover:text-red-500 transition-colors">
                    <X className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              )}

              {/* Input area */}
              <div className="px-4 py-3 border-t border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A]">
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setAttachOpen(true)}
                    className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#1e1b4b]/20 transition-all shrink-0 mb-0.5"
                    title="Attach file from drive"
                  >
                    <Paperclip className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={autoResize}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                    className="flex-1 resize-none text-sm px-3 py-2 bg-[#F3F4F6] dark:bg-[#1E1E1E] border border-[#E5E7EB] dark:border-[#2A2A2A] rounded-xl text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] outline-none focus:border-[#4F46E5] transition-colors leading-relaxed"
                    style={{ maxHeight: 96 }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() && !attachment}
                    className="p-2 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 mb-0.5"
                  >
                    <Send className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {newMsgOpen && (
        <NewMessageModal
          onClose={() => setNewMsgOpen(false)}
          onSelect={userId => createConvMutation.mutate(userId)}
        />
      )}
      {attachOpen && (
        <AttachFileModal
          onClose={() => setAttachOpen(false)}
          onSelect={(id, name) => setAttachment({ id, name })}
        />
      )}
    </div>
  );
}
